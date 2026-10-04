/**
 * Transform stage — validates and normalizes an extracted recipe
 * into the shape expected by the database.
 */
import type {
  ExtractedRecipe,
  ValidatedRecipe,
  SourceMetadata,
} from "../../_shared/recipe-schema.ts";
import { createPipelineError } from "../../_shared/recipe-schema.ts";

export function transform(
  extracted: ExtractedRecipe,
  sourceMetadata: SourceMetadata
): ValidatedRecipe {
  // ── Required field validation ──
  if (!extracted.title?.trim()) {
    throw createPipelineError("transform", "MISSING_TITLE", "Recipe title is required");
  }
  if (!extracted.ingredients?.length) {
    throw createPipelineError("transform", "MISSING_INGREDIENTS", "At least one ingredient is required");
  }
  if (!extracted.instructions?.length) {
    throw createPipelineError("transform", "MISSING_INSTRUCTIONS", "At least one instruction is required");
  }

  // ── Normalize numeric fields ──
  const prepTime = toPositiveInt(extracted.prepTime);
  const cookTime = toPositiveInt(extracted.cookTime);
  const totalTime =
    toPositiveInt(extracted.totalTime) ||
    (prepTime || cookTime ? (prepTime || 0) + (cookTime || 0) : null);

  const servings = toPositiveInt(extracted.servings) || 4;

  // ── Normalize difficulty ──
  const validDifficulties = ["easy", "medium", "hard"] as const;
  const difficulty = validDifficulties.includes(extracted.difficulty as any)
    ? (extracted.difficulty as "easy" | "medium" | "hard")
    : "medium";

  // ── Normalize ingredients ──
  const ingredients = extracted.ingredients.map((ing) => ({
    name: String(ing.name || "").trim(),
    amount: typeof ing.amount === "number" ? ing.amount : null,
    unit: String(ing.unit || "").trim(),
    category: String(ing.category || "pantry").trim(),
    ...(ing.notes ? { notes: ing.notes } : {}),
  }));

  // ── Normalize instructions to string[] ──
  const instructions = extracted.instructions.map((inst) =>
    typeof inst === "string" ? inst.trim() : JSON.stringify(inst)
  );

  // ── Decode HTML entities ──
  // URL scrapers sometimes return raw HTML-encoded text (e.g. &amp; → &).
  const decodedTitle = decodeHtmlEntities(extracted.title.trim());

  // ── Extract inline diet labels from the title ──
  // Titles scraped from sites often embed diet badges: "Soup {Gluten-Free}" or
  // "Pasta (Vegan, Dairy-Free)" or "Salad [Low-Carb]". Strip them from the
  // title and merge into tags so the name stays clean.
  const { cleanTitle, extractedTags } = extractTitleTags(decodedTitle);

  // ── Normalize title casing ──
  // LLMs and JSON-LD sometimes return ALL CAPS titles. Convert to title case
  // when the entire title is uppercase, preserving mixed-case titles as-is.
  const normalizedTitle = normalizeTitle(cleanTitle);

  // ── Merge tags (extracted from title + LLM-supplied), deduplicated ──
  const allTags = Array.from(
    new Set([
      ...(extracted.tags || []).map((t) => t.trim().toLowerCase()),
      ...extractedTags,
    ])
  );

  // ── Generate slug ──
  const slug = generateSlug(normalizedTitle);

  return {
    title: normalizedTitle,
    description: extracted.description?.trim() || null,
    ingredients,
    instructions,
    prep_time: prepTime,
    cook_time: cookTime,
    total_time: totalTime,
    servings,
    difficulty,
    cuisine: extracted.cuisine?.trim() || null,
    tags: allTags,
    image_url: extracted.imageUrl || null,
    nutrition_info: extracted.nutrition || null,
    source_url: sourceMetadata.source_url || null,
    source_name: sourceMetadata.source_name || null,
    slug,
  };
}

function toPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Normalize recipe title casing.
 * - All-uppercase titles (e.g. "SUPERIOR BUTTER CHICKEN") → title case
 * - Already mixed-case titles are left untouched (respect intentional casing)
 * - Small words (articles, prepositions, conjunctions) are lowercased unless first
 */
const SMALL_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at",
  "to", "by", "in", "of", "up", "as", "is", "it",
]);

function normalizeTitle(title: string): string {
  // Only normalize if the title is entirely uppercase (or has no lowercase letters)
  const hasLowercase = /[a-z]/.test(title);
  if (hasLowercase) return title; // already mixed-case — leave it alone

  // Convert ALL CAPS → Title Case with small-word handling
  return title
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      // Always capitalize the first and last word; lowercase small words elsewhere
      if (index === 0 || !SMALL_WORDS.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 200);
}

/**
 * Decode common HTML entities that scrapers leave in title strings.
 * Covers the handful that appear regularly in recipe site markup.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Strip parenthetical / bracketed diet or allergen labels from a recipe title
 * and return them as normalized tags.
 *
 * Examples:
 *   "Gnocchi & Sausage {Gluten-free}"      → { cleanTitle: "Gnocchi & Sausage", extractedTags: ["gluten-free"] }
 *   "Chicken Soup (Dairy-Free, Low-Carb)"   → { cleanTitle: "Chicken Soup", extractedTags: ["dairy-free", "low-carb"] }
 *   "Pasta [Vegan]"                         → { cleanTitle: "Pasta", extractedTags: ["vegan"] }
 *
 * Only brackets that contain recognizable diet/allergen keywords are stripped —
 * parentheticals that look like cooking notes (e.g. "(serves 4)") are left alone.
 */
const DIET_KEYWORDS = new Set([
  "gluten-free", "gluten free", "glutenfree",
  "dairy-free", "dairy free", "dairyfree",
  "vegan", "vegetarian", "plant-based",
  "keto", "paleo", "whole30",
  "low-carb", "low carb", "lowcarb",
  "low-fat", "low fat",
  "nut-free", "nut free",
  "egg-free", "egg free",
  "soy-free", "soy free",
  "sugar-free", "sugar free",
  "grain-free", "grain free",
]);

function extractTitleTags(title: string): { cleanTitle: string; extractedTags: string[] } {
  const extractedTags: string[] = [];

  // Match content in (), [], or {} at the end of (or anywhere in) the title.
  const bracketPattern = /[\(\[\{]([^)\]]*?)[\)\]\}]/g;

  const cleanTitle = title.replace(bracketPattern, (match, inner: string) => {
    // Split on commas to handle multiple labels in one bracket: "(Vegan, Dairy-Free)"
    const parts = inner.split(",").map((p) => p.trim().toLowerCase());
    const isDietLabel = parts.every((p) => {
      // Allow each part to be a known keyword or a known keyword with extra words
      // e.g. "gluten-free option" still passes
      return DIET_KEYWORDS.has(p) || [...DIET_KEYWORDS].some((kw) => p.includes(kw));
    });

    if (isDietLabel) {
      // Normalize each part to kebab-case and collect as tags
      parts.forEach((p) => {
        const normalized = p.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        if (normalized) extractedTags.push(normalized);
      });
      return ""; // remove bracket from title
    }

    return match; // not a diet label — leave it in the title
  });

  return {
    cleanTitle: cleanTitle.replace(/\s{2,}/g, " ").trim(),
    extractedTags,
  };
}
