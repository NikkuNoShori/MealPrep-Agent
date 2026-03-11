/**
 * Load stage — duplicate check, embedding generation, and database insert.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OpenRouterClient } from "../../_shared/openrouter-client.ts";
import type { ValidatedRecipe } from "../../_shared/recipe-schema.ts";
import { createPipelineError } from "../../_shared/recipe-schema.ts";
import { generateRecipeEmbedding } from "../../_shared/embedding-utils.ts";

export async function load(
  recipe: ValidatedRecipe,
  userId: string,
  supabase: SupabaseClient,
  openRouter: OpenRouterClient
): Promise<{ recipe_id: string; record: any }> {
  // ── Duplicate check ──
  const { data: existing } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("user_id", userId)
    .ilike("title", recipe.title.trim())
    .maybeSingle();

  if (existing) {
    throw createPipelineError(
      "load",
      "DUPLICATE_RECIPE",
      `A recipe named "${existing.title}" already exists`,
      { existing_id: existing.id }
    );
  }

  // ── Generate embedding (non-fatal) ──
  const embedding = await generateRecipeEmbedding(openRouter, recipe);

  // ── Insert into database ──
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      total_time: recipe.total_time,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      cuisine: recipe.cuisine,
      tags: recipe.tags,
      image_url: recipe.image_url,
      nutrition_info: recipe.nutrition_info,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      slug: recipe.slug,
      is_public: false,
      is_favorite: false,
      ...(embedding ? { embedding_vector: `[${embedding.join(",")}]` } : {}),
    })
    .select()
    .single();

  if (error) {
    throw createPipelineError("load", "DB_ERROR", `Database insert failed: ${error.message}`, {
      code: error.code,
      details: error.details,
    });
  }

  console.log(`Recipe loaded: ${data.id} — "${recipe.title}"`);
  return { recipe_id: data.id, record: data };
}
