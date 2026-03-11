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

  // ── Generate slug ──
  const slug = generateSlug(extracted.title);

  return {
    title: extracted.title.trim(),
    description: extracted.description?.trim() || null,
    ingredients,
    instructions,
    prep_time: prepTime,
    cook_time: cookTime,
    total_time: totalTime,
    servings,
    difficulty,
    cuisine: extracted.cuisine?.trim() || null,
    tags: (extracted.tags || []).map((t) => t.trim().toLowerCase()),
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
