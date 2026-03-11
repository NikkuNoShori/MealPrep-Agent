/**
 * Extract stage — LLM-based structured recipe extraction.
 * Takes IntermediateContent from any adapter, returns ExtractedRecipe.
 */
import type { OpenRouterClient } from "../../_shared/openrouter-client.ts";
import type { IntermediateContent, ExtractedRecipe } from "../../_shared/recipe-schema.ts";
import { createPipelineError } from "../../_shared/recipe-schema.ts";
import { RECIPE_EXTRACTION_PROMPT, IMAGE_EXTRACTION_PROMPT } from "../../_shared/recipe-prompts.ts";

/** Maximum number of recipes allowed per request */
const MAX_RECIPES_PER_REQUEST = 5;

/** Vision models to try in order — fallback if first returns 500 */
const VISION_MODELS = [
  "qwen/qwen-2.5-vl-7b-instruct",
  "google/gemini-flash-1.5-8b",
];

export async function extract(
  content: IntermediateContent,
  openRouter: OpenRouterClient
): Promise<ExtractedRecipe | ExtractedRecipe[]> {
  // For URL sources, prefer text-only extraction (JSON-LD/HTML text is sufficient,
  // no need to send external image URLs to vision model)
  const isUrlSource = content.source_metadata.source_type === "url";
  const hasUserImages = !isUrlSource && content.images.length > 0;

  // Truncate very long text to stay within context window (~6k chars ≈ 2k tokens)
  const rawText = content.raw_text.length > 6000
    ? content.raw_text.substring(0, 6000) + "\n\n[Content truncated]"
    : content.raw_text;

  // Use specialized image prompt when images are present
  const systemPrompt = hasUserImages ? IMAGE_EXTRACTION_PROMPT : RECIPE_EXTRACTION_PROMPT;

  const userPrompt = hasUserImages
    ? `${rawText || "Extract the recipe from the provided images."}\n\n[${content.images.length} image(s) provided]\n\nExtract the recipe(s) and return structured JSON.`
    : `${rawText}\n\nExtract the recipe(s) and return structured JSON. If there are multiple recipes, return them in a "recipes" array.`;

  let response: string;

  if (hasUserImages) {
    // Try each vision model in order until one succeeds
    const errors: string[] = [];
    for (const model of VISION_MODELS) {
      try {
        console.log(`Trying vision model: ${model}`);
        // Note: vision models on OpenRouter don't reliably support response_format,
        // so we omit it here and rely on the prompt + JSON parsing fallback.
        response = await openRouter.chatWithImages(
          systemPrompt,
          userPrompt,
          content.images,
          model,
          { temperature: 0.1, max_tokens: 4000 }
        );
        return parseRecipeResponse(response!);
      } catch (error) {
        console.warn(`Vision model ${model} failed: ${error.message}`);
        errors.push(`${model}: ${error.message}`);
      }
    }
    throw createPipelineError(
      "extract",
      "EXTRACTION_FAILED",
      `All vision models failed: ${errors.join(" | ")}`,
      {}
    );
  }

  // Text-only extraction with retry
  let retries = 0;
  while (retries < 2) {
    try {
      response = await openRouter.chat(
        systemPrompt,
        userPrompt,
        "qwen/qwen-2.5-7b-instruct",
        { temperature: 0.1, max_tokens: 4000, response_format: { type: "json_object" } }
      );
      return parseRecipeResponse(response!);
    } catch (error) {
      retries++;
      if (retries >= 2) {
        throw createPipelineError(
          "extract",
          "EXTRACTION_FAILED",
          `Recipe extraction failed after ${retries} attempts: ${error.message}`,
          { raw_response: response! }
        );
      }
      console.warn(`Extract attempt ${retries} failed, retrying...`);
    }
  }

  // Unreachable, but satisfies TypeScript
  throw createPipelineError("extract", "EXTRACTION_FAILED", "Unexpected extraction failure");
}

function parseRecipeResponse(response: string): ExtractedRecipe | ExtractedRecipe[] {
  let parsed: any;

  // Log raw response for debugging
  console.log("Raw LLM response (first 1000 chars):", response.substring(0, 1000));

  try {
    parsed = JSON.parse(response);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch {
        throw createPipelineError(
          "extract",
          "INVALID_LLM_RESPONSE",
          "LLM returned invalid JSON inside code block",
          { raw_response: response.substring(0, 500) }
        );
      }
    } else {
      throw createPipelineError(
        "extract",
        "INVALID_LLM_RESPONSE",
        "LLM did not return valid JSON",
        { raw_response: response.substring(0, 500) }
      );
    }
  }

  // ── Multi-recipe detection ──
  // Check if the response contains a "recipes" array
  const recipesArray = parsed.recipes || parsed.data?.recipes || parsed.result?.recipes;
  if (Array.isArray(recipesArray) && recipesArray.length > 1) {
    console.log(`Multi-recipe detected: ${recipesArray.length} recipes`);
    const capped = recipesArray.slice(0, MAX_RECIPES_PER_REQUEST);
    const results: ExtractedRecipe[] = [];
    for (const rawRecipe of capped) {
      try {
        results.push(normalizeExtractedRecipe(rawRecipe));
      } catch (e) {
        console.warn("Skipping malformed recipe in multi-recipe response:", e.message);
      }
    }
    if (results.length === 0) {
      throw createPipelineError(
        "extract",
        "INCOMPLETE_EXTRACTION",
        "Multi-recipe response contained no valid recipes",
        { raw_response: response.substring(0, 1000) }
      );
    }
    return results;
  }

  // ── Single recipe path ──
  // Deep-search for the recipe object — models sometimes nest unpredictably
  const raw = findRecipeObject(parsed);
  return normalizeExtractedRecipe(raw);
}

/**
 * Normalize a raw recipe object into an ExtractedRecipe.
 * Shared by both single and multi-recipe paths.
 */
function normalizeExtractedRecipe(raw: any): ExtractedRecipe {
  // Normalize field name aliases — models don't always follow the prompt exactly
  const recipe = normalizeFieldNames(raw);

  console.log("Normalized recipe keys:", Object.keys(recipe));

  if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
    const fields = Object.keys(recipe);
    throw createPipelineError(
      "extract",
      "INCOMPLETE_EXTRACTION",
      `Missing required fields. Found keys: [${fields.join(", ")}]`,
      { fields_present: fields }
    );
  }

  // Normalize ingredients — handle string[], {name, quantity}[], or {name, amount, unit}[]
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((ing: any) => {
        if (typeof ing === "string") {
          return parseIngredientString(ing);
        }
        // Model returned { name, quantity } instead of { name, amount, unit }
        if (ing.quantity && !ing.amount && !ing.unit) {
          const parsed = parseQuantityString(ing.quantity);
          return {
            name: ing.name || ing.ingredient || "",
            amount: parsed.amount,
            unit: parsed.unit,
            category: ing.category || "",
            notes: parsed.notes || ing.notes || "",
          };
        }
        return {
          name: ing.name || ing.ingredient || "",
          amount: ing.amount ?? null,
          unit: ing.unit || "",
          category: ing.category || "",
          notes: ing.notes || "",
        };
      })
    : [];

  // Normalize instructions — handle string[] or object[] formats
  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions.map((inst: any) => {
        if (typeof inst === "string") return inst;
        return inst.text || inst.step || inst.instruction || inst.description || String(inst);
      })
    : [];

  return {
    title: recipe.title,
    description: recipe.description || null,
    ingredients,
    instructions,
    prepTime: recipe.prepTime ?? recipe.prep_time ?? recipe.preptime ?? null,
    cookTime: recipe.cookTime ?? recipe.cook_time ?? recipe.cooktime ?? null,
    totalTime: recipe.totalTime ?? recipe.total_time ?? recipe.totaltime ?? null,
    servings: recipe.servings ?? null,
    difficulty: recipe.difficulty ?? null,
    tags: recipe.tags || [],
    cuisine: recipe.cuisine || null,
    nutrition: recipe.nutrition || recipe.nutrition_info || null,
    imageUrl: recipe.imageUrl ?? recipe.image_url ?? recipe.imageurl ?? null,
  };
}

/** Check if object looks like a recipe (has a title-like field + ingredients or instructions) */
function looksLikeRecipe(obj: any): boolean {
  const hasTitle = !!(obj.title || obj.recipe_name || obj.name || obj.recipe_title);
  const hasIngredients = !!obj.ingredients;
  const hasInstructions = !!(obj.instructions || obj.steps || obj.directions || obj.method);
  return hasTitle && (hasIngredients || hasInstructions);
}

/**
 * Recursively search for the recipe object in the parsed JSON.
 */
function findRecipeObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.length > 0 ? findRecipeObject(obj[0]) : {};
  }

  // Direct match
  if (looksLikeRecipe(obj)) return obj;

  // Check common wrapper keys
  for (const key of ["recipe", "data", "result", "output", "extracted_recipe"]) {
    if (obj[key] && typeof obj[key] === "object") {
      const found = findRecipeObject(obj[key]);
      if (found && looksLikeRecipe(found)) return found;
    }
  }

  // Fallback: check all object values
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (looksLikeRecipe(value)) return value;
    }
  }

  return obj;
}

/**
 * Normalize field name aliases to canonical names.
 * Models return recipe_name, steps, directions, etc. — map them all to our schema.
 */
function normalizeFieldNames(recipe: any): any {
  return {
    ...recipe,
    // Title aliases
    title: recipe.title || recipe.recipe_name || recipe.name || recipe.recipe_title || null,
    // Instructions aliases
    instructions: recipe.instructions || recipe.steps || recipe.directions || recipe.method || null,
    // Time aliases
    prepTime: recipe.prepTime ?? recipe.prep_time ?? recipe.preptime ?? recipe.preparation_time ?? null,
    cookTime: recipe.cookTime ?? recipe.cook_time ?? recipe.cooktime ?? recipe.cooking_time ?? null,
    totalTime: recipe.totalTime ?? recipe.total_time ?? recipe.totaltime ?? null,
  };
}

// ── Phase 1: Comprehensive unit list (~80 units) ──

/** All known measurement units, grouped by category. Longest-first to avoid partial matches. */
const KNOWN_UNITS = [
  // Volume
  "tablespoons?", "teaspoons?", "cups?", "tbsp", "tsp", "fluid\\s*oz", "fl\\s*oz",
  "gallons?", "gal", "quarts?", "qt", "pints?", "pt",
  "milliliters?", "liters?", "ml", "L",
  // Weight
  "ounces?", "pounds?", "oz", "lbs?", "grams?", "kilograms?", "kg", "g",
  // Containers
  "packages?", "packets?", "blocks?", "boxes?", "bags?", "jars?", "bottles?",
  "containers?", "cartons?", "pkg",
  // Cans / tins
  "cans?", "tins?",
  // Informal / small
  "dollops?", "splashe?s?", "dashe?s?", "pinche?s?", "handfuls?",
  "bunche?s?", "sprigs?", "knobs?",
  // Baking
  "sticks?", "sheets?", "layers?", "rounds?",
  // Produce
  "heads?", "ears?", "ribs?", "lea(?:f|ves)", "stalks?", "cloves?",
  // Count / size
  "pieces?", "slices?", "strips?", "cubes?", "wedges?",
  "filets?", "fillets?", "whole", "halve?s?", "quarters?",
  // Portions
  "servings?", "portions?", "scoops?", "drops?", "squeezes?",
  // Size descriptors (when used as units: "1 medium onion")
  "medium", "large", "small",
].join("|");

const UNITS_PATTERN = new RegExp(`^(${KNOWN_UNITS})$`, "i");
const UNITS_CAPTURE = new RegExp(`^(${KNOWN_UNITS})(?:\\s|,|$)`, "i");

// ── Phase 2: Unicode fractions & written numbers ──

/** Map unicode fraction characters to decimal values */
const UNICODE_FRACTIONS: Record<string, number> = {
  "\u00BD": 0.5,   // ½
  "\u2153": 0.333,  // ⅓
  "\u2154": 0.667,  // ⅔
  "\u00BC": 0.25,   // ¼
  "\u00BE": 0.75,   // ¾
  "\u2155": 0.2,    // ⅕
  "\u2156": 0.4,    // ⅖
  "\u2157": 0.6,    // ⅗
  "\u2158": 0.8,    // ⅘
  "\u2159": 0.167,  // ⅙
  "\u215A": 0.833,  // ⅚
  "\u215B": 0.125,  // ⅛
  "\u215C": 0.375,  // ⅜
  "\u215D": 0.625,  // ⅝
  "\u215E": 0.875,  // ⅞
};

const UNICODE_FRACTION_RE = new RegExp(`[${Object.keys(UNICODE_FRACTIONS).join("")}]`);

/** Map written numbers to numeric values */
const WRITTEN_NUMBERS: Record<string, number> = {
  "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
  "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
  "twelve": 12, "dozen": 12, "half": 0.5,
};

// ── Phase 4: No-amount pattern matching ──

/** Patterns indicating no specific amount */
const NO_AMOUNT_PATTERNS = [
  /^to\s+taste$/i,
  /^as\s+needed$/i,
  /^as\s+required$/i,
  /^for\s+garnish(ing)?$/i,
  /^optional$/i,
  /^some$/i,
  /^few$/i,
];

/**
 * Normalize unicode fractions and written numbers in a string.
 * "1½ cups" → "1.5 cups", "a pinch" → "1 pinch", "two cloves" → "2 cloves"
 */
function normalizeAmountText(text: string): string {
  let result = text;

  // Replace unicode fractions (handle "1½" → "1.5" and standalone "½" → "0.5")
  for (const [char, value] of Object.entries(UNICODE_FRACTIONS)) {
    if (result.includes(char)) {
      // Check if preceded by a whole number: "1½" → add to it
      const wholeMatch = result.match(new RegExp(`(\\d+)\\s*${char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      if (wholeMatch) {
        const total = parseInt(wholeMatch[1]) + value;
        result = result.replace(wholeMatch[0], String(total));
      } else {
        result = result.replace(char, String(value));
      }
    }
  }

  // Replace written numbers at the start: "two cups" → "2 cups", "a pinch" → "1 pinch"
  const firstWord = result.match(/^([a-zA-Z]+)\s/);
  if (firstWord) {
    const num = WRITTEN_NUMBERS[firstWord[1].toLowerCase()];
    if (num !== undefined) {
      result = String(num) + result.slice(firstWord[1].length);
    }
  }

  return result;
}

/**
 * Parse an amount string that may contain fractions, decimals, or ranges.
 * "1/2" → 0.5, "1.5" → 1.5, "2-3" → 2.5 (midpoint), "2 to 3" → 2.5
 */
function parseAmount(raw: string): { amount: number | null; rangeNote: string } {
  if (!raw) return { amount: null, rangeNote: "" };

  const s = raw.trim();

  // Phase 3: Range handling — "2-3" or "2 to 3"
  const rangeMatch = s.match(/^(\d+(?:[./]\d+)?)\s*(?:-|to)\s*(\d+(?:[./]\d+)?)$/i);
  if (rangeMatch) {
    const low = parseSingleAmount(rangeMatch[1]);
    const high = parseSingleAmount(rangeMatch[2]);
    if (low !== null && high !== null) {
      return { amount: (low + high) / 2, rangeNote: `${rangeMatch[1]}-${rangeMatch[2]}` };
    }
  }

  // Mixed number: "1 1/2" → 1.5
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const frac = parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    return { amount: whole + frac, rangeNote: "" };
  }

  return { amount: parseSingleAmount(s), rangeNote: "" };
}

function parseSingleAmount(s: string): number | null {
  if (s.includes("/")) {
    const [num, den] = s.split("/");
    const val = Number(num) / Number(den);
    return isNaN(val) ? null : val;
  }
  const val = parseFloat(s);
  return isNaN(val) ? null : val;
}

/**
 * Parse a quantity string like "1 medium, diced" or "2 cups" into amount/unit/notes.
 * Handles ~80 unit types, unicode fractions, ranges, and no-amount patterns.
 */
function parseQuantityString(quantity: string): { amount: number | null; unit: string; notes: string } {
  if (!quantity) return { amount: null, unit: "", notes: "" };

  // Normalize unicode fractions and written numbers first
  const q = normalizeAmountText(quantity.trim());

  // Phase 4: Check for no-amount patterns
  for (const pattern of NO_AMOUNT_PATTERNS) {
    if (pattern.test(q)) {
      return { amount: null, unit: "", notes: q };
    }
  }

  // Match: optional amount, optional unit, optional comma, optional notes
  // Amount patterns: "2", "1.5", "1/2", "2-3", "2 to 3", "1 1/2"
  const amountPattern = /^(\d+(?:\s+\d+\/\d+|\s*[./]\s*\d+)?(?:\s*(?:-|to)\s*\d+(?:[./]\d+)?)?)\s*/;
  const amountMatch = q.match(amountPattern);

  if (amountMatch) {
    const rawAmount = amountMatch[1];
    const afterAmount = q.slice(amountMatch[0].length);

    // Try to match a unit at the start of the remaining text
    const unitMatch = afterAmount.match(UNITS_CAPTURE);
    const { amount, rangeNote } = parseAmount(rawAmount);

    if (unitMatch) {
      const unit = unitMatch[1];
      const afterUnit = afterAmount.slice(unitMatch[0].length).replace(/^[,\s]+/, "").trim();
      const notes = [rangeNote, afterUnit].filter(Boolean).join(", ");
      return { amount, unit, notes };
    }

    // No unit matched — rest is notes
    const notes = [rangeNote, afterAmount.replace(/^[,\s]+/, "").trim()].filter(Boolean).join(", ");
    return { amount, unit: "", notes };
  }

  // No numeric match — entire string is a note
  return { amount: null, unit: "", notes: q };
}

/**
 * Parse a plain ingredient string like "2 tbsp olive oil" into structured format.
 * Uses the comprehensive unit list for accurate splitting of amount+unit from name.
 */
function parseIngredientString(text: string): { name: string; amount: number | null; unit: string; category: string; notes: string } {
  const normalized = normalizeAmountText(text.trim());
  const parsed = parseQuantityString(normalized);

  // Reconstruct: strip the matched amount+unit prefix to get the ingredient name
  const amountPattern = /^(\d+(?:\s+\d+\/\d+|\s*[./]\s*\d+)?(?:\s*(?:-|to)\s*\d+(?:[./]\d+)?)?)\s*/;
  const amountMatch = normalized.match(amountPattern);

  let name = normalized;
  if (amountMatch) {
    const afterAmount = normalized.slice(amountMatch[0].length);
    const unitMatch = afterAmount.match(UNITS_CAPTURE);
    if (unitMatch) {
      name = afterAmount.slice(unitMatch[0].length).replace(/^[,\s]+/, "").trim();
    } else {
      name = afterAmount.replace(/^[,\s]+/, "").trim();
    }
  }

  return {
    name: name || text,
    amount: parsed.amount,
    unit: parsed.unit,
    category: "",
    notes: parsed.notes,
  };
}
