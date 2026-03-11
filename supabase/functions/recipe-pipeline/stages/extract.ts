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
  const hasImages = content.images.length > 0;

  const userPrompt = hasImages
    ? `${content.raw_text || "Extract the recipe from the provided images."}\n\n[${content.images.length} image(s) provided]\n\nExtract the recipe and return structured JSON.`
    : `${content.raw_text}\n\nExtract the recipe and return structured JSON.`;

  let response: string;
  let retries = 0;

  while (retries < 2) {
    try {
      if (hasImages) {
        response = await openRouter.chatWithImages(
          RECIPE_EXTRACTION_PROMPT,
          userPrompt,
          content.images,
          "qwen/qwen-2.5-vl-7b-instruct",
          { temperature: 0.1, max_tokens: 2000, response_format: { type: "json_object" } }
        );
      } else {
        response = await openRouter.chat(
          RECIPE_EXTRACTION_PROMPT,
          userPrompt,
          "qwen/qwen-2.5-7b-instruct",
          { temperature: 0.1, max_tokens: 2000, response_format: { type: "json_object" } }
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

  try {
    parsed = JSON.parse(response);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      throw createPipelineError(
        "extract",
        "INVALID_LLM_RESPONSE",
        "LLM did not return valid JSON",
        { raw_response: response.substring(0, 500) }
      );
    }
  }

  // Handle { recipe: { ... } } wrapper
  const recipe = parsed.recipe || parsed;

  if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
    throw createPipelineError(
      "extract",
      "INCOMPLETE_EXTRACTION",
      "Extracted recipe is missing required fields (title, ingredients, or instructions)",
      { fields_present: Object.keys(recipe) }
    );
  }

  return {
    title: recipe.title,
    description: recipe.description || null,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    prepTime: recipe.prepTime ?? recipe.prep_time ?? null,
    cookTime: recipe.cookTime ?? recipe.cook_time ?? null,
    totalTime: recipe.totalTime ?? recipe.total_time ?? null,
    servings: recipe.servings ?? null,
    difficulty: recipe.difficulty ?? null,
    tags: recipe.tags || [],
    cuisine: recipe.cuisine || null,
    nutrition: recipe.nutrition || null,
    imageUrl: recipe.imageUrl ?? recipe.image_url ?? null,
  };
}
