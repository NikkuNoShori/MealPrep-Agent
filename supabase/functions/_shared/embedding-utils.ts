/**
 * Embedding generation utilities for the Deno runtime.
 * Ported from src/services/embeddingService.js.
 */
import type { OpenRouterClient } from "./openrouter-client.ts";
import type { ValidatedRecipe } from "./recipe-schema.ts";

/**
 * Build a text representation of a recipe for embedding generation.
 */
export function createRecipeText(recipe: ValidatedRecipe): string {
  const parts: string[] = [];

  parts.push(`Title: ${recipe.title}`);

  if (recipe.description) {
    parts.push(`Description: ${recipe.description}`);
  }
  if (recipe.cuisine) {
    parts.push(`Cuisine: ${recipe.cuisine}`);
  }
  if (recipe.difficulty) {
    parts.push(`Difficulty: ${recipe.difficulty}`);
  }
  if (recipe.tags?.length) {
    parts.push(`Tags: ${recipe.tags.join(", ")}`);
  }

  if (recipe.ingredients?.length) {
    const ingredientText = recipe.ingredients
      .map((ing) => {
        if (typeof ing === "string") return ing;
        return `${ing.amount ?? ""} ${ing.unit ?? ""} ${ing.name}`.trim();
      })
      .join(", ");
    parts.push(`Ingredients: ${ingredientText}`);
  }

  if (recipe.instructions?.length) {
    const instructionText = recipe.instructions
      .map((inst, i) => `${i + 1}. ${typeof inst === "string" ? inst : JSON.stringify(inst)}`)
      .join(" ");
    parts.push(`Instructions: ${instructionText}`);
  }

  return parts.join("\n");
}

/**
 * Generate an embedding vector for recipe text.
 * Returns null (non-fatal) if embedding generation fails.
 */
export async function generateRecipeEmbedding(
  openRouter: OpenRouterClient,
  recipe: ValidatedRecipe
): Promise<number[] | null> {
  try {
    const text = createRecipeText(recipe);
    const embedding = await openRouter.generateEmbedding(text);
    console.log(`Embedding generated (${embedding.length} dims)`);
    return embedding;
  } catch (error) {
    console.error("Embedding generation failed (non-fatal):", error);
    return null;
  }
}
