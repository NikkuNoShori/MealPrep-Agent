/**
 * Extract stage — LLM-based structured recipe extraction.
 * Takes IntermediateContent from any adapter, returns ExtractedRecipe.
 */
import type { OpenRouterClient } from "../../_shared/openrouter-client.ts";
import type { IntermediateContent, ExtractedRecipe } from "../../_shared/recipe-schema.ts";
import { createPipelineError } from "../../_shared/recipe-schema.ts";
import { RECIPE_EXTRACTION_PROMPT } from "../../_shared/recipe-prompts.ts";

export async function extract(
  content: IntermediateContent,
  openRouter: OpenRouterClient
): Promise<ExtractedRecipe> {
  // For URL sources, prefer text-only extraction (JSON-LD/HTML text is sufficient,
  // no need to send external image URLs to vision model)
  const isUrlSource = content.source_metadata.source_type === "url";
  const hasUserImages = !isUrlSource && content.images.length > 0;

  // Truncate very long text to stay within context window (~6k chars ≈ 2k tokens)
  const rawText = content.raw_text.length > 6000
    ? content.raw_text.substring(0, 6000) + "\n\n[Content truncated]"
    : content.raw_text;

  const userPrompt = hasUserImages
    ? `${rawText || "Extract the recipe from the provided images."}\n\n[${content.images.length} image(s) provided]\n\nExtract the recipe and return structured JSON.`
    : `${rawText}\n\nExtract the recipe and return structured JSON.`;

  let response: string;
  let retries = 0;

  while (retries < 2) {
    try {
      if (hasUserImages) {
        response = await openRouter.chatWithImages(
          RECIPE_EXTRACTION_PROMPT,
          userPrompt,
          content.images,
          "qwen/qwen-2.5-vl-7b-instruct",
          { temperature: 0.1, max_tokens: 3000, response_format: { type: "json_object" } }
        );
      } else {
        response = await openRouter.chat(
          RECIPE_EXTRACTION_PROMPT,
          userPrompt,
          "qwen/qwen-2.5-7b-instruct",
          { temperature: 0.1, max_tokens: 3000, response_format: { type: "json_object" } }
        );
      }

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

function parseRecipeResponse(response: string): ExtractedRecipe {
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

  // Deep-search for the recipe object — models sometimes nest unpredictably
  const raw = findRecipeObject(parsed);

  // Normalize field name aliases — models don't always follow the prompt exactly
  const recipe = normalizeFieldNames(raw);

  console.log("Normalized recipe keys:", Object.keys(recipe));

  if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
    const fields = Object.keys(recipe);
    const preview = response.substring(0, 300);
    throw createPipelineError(
      "extract",
      "INCOMPLETE_EXTRACTION",
      `Missing required fields. Found keys: [${fields.join(", ")}]. Raw response preview: ${preview}`,
      { fields_present: fields, raw_response: response.substring(0, 1000) }
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

/**
 * Parse a quantity string like "1 medium, diced" or "2 cups" into amount/unit/notes.
 */
function parseQuantityString(quantity: string): { amount: number | null; unit: string; notes: string } {
  if (!quantity) return { amount: null, unit: "", notes: "" };

  const q = quantity.trim();

  // Match patterns like "2 cups", "1/2 tsp", "1.5 lbs", "8 cloves, minced"
  const match = q.match(/^(\d+(?:[./]\d+)?)\s*(cups?|tbsp|tsp|oz|lb|lbs|g|kg|ml|L|cloves?|cans?|medium|large|small|stalks?|pieces?|slices?)?\s*[,]?\s*(.*)?$/i);

  if (match) {
    let amount: number | null = null;
    const rawAmount = match[1];
    if (rawAmount.includes("/")) {
      const [num, den] = rawAmount.split("/");
      amount = Number(num) / Number(den);
    } else {
      amount = parseFloat(rawAmount);
    }
    return {
      amount: isNaN(amount) ? null : amount,
      unit: match[2] || "",
      notes: match[3] || "",
    };
  }

  // No numeric match — entire string is a note (e.g., "to taste", "as needed")
  return { amount: null, unit: "", notes: q };
}

/**
 * Parse a plain ingredient string like "2 tbsp olive oil" into structured format.
 */
function parseIngredientString(text: string): { name: string; amount: number | null; unit: string; category: string; notes: string } {
  const parsed = parseQuantityString(text);
  // Whatever's left after amount+unit is the ingredient name
  const remaining = text.replace(/^\d+(?:[./]\d+)?\s*(?:cups?|tbsp|tsp|oz|lb|lbs|g|kg|ml|L)?\s*/i, "").trim();
  return {
    name: remaining || text,
    amount: parsed.amount,
    unit: parsed.unit,
    category: "",
    notes: parsed.notes,
  };
}
