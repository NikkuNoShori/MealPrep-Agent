/**
 * Pipeline orchestrator — routes through adapter → extract → transform → load.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OpenRouterClient } from "../_shared/openrouter-client.ts";
import type {
  PipelineRequest,
  PipelineResult,
  PipelineError,
  IntermediateContent,
  ExtractedRecipe,
  ValidatedRecipe,
} from "../_shared/recipe-schema.ts";
import { textAdapter } from "./adapters/text-adapter.ts";
import { urlAdapter } from "./adapters/url-adapter.ts";
import { videoAdapter } from "./adapters/video-adapter.ts";
import { extract } from "./stages/extract.ts";
import { transform } from "./stages/transform.ts";
import { load } from "./stages/load.ts";

export async function runPipeline(
  request: PipelineRequest,
  userId: string,
  supabase: SupabaseClient,
  openRouter: OpenRouterClient
): Promise<PipelineResult> {
  const autoSave = request.auto_save !== false; // default true

  // ── 1. Source Adapter ──
  let content: IntermediateContent;
  try {
    content = await runAdapter(request, openRouter);
    console.log(`Adapter (${request.source_type}) completed`);
  } catch (error) {
    return errorResult("adapter", error);
  }

  // ── 2. Extract ──
  let extracted;
  try {
    extracted = await extract(content, openRouter);
    if (Array.isArray(extracted)) {
      console.log(`Extract completed: ${extracted.length} recipes found`);
    } else {
      console.log(`Extract completed: "${extracted.title}"`);
    }
  } catch (error) {
    return errorResult("extract", error);
  }

  // ── Multi-recipe path ──
  if (Array.isArray(extracted)) {
    return handleMultipleRecipes(extracted, content, autoSave, userId, supabase, openRouter);
  }

  // ── 3. Transform (single recipe) ──
  let validated;
  try {
    validated = transform(extracted, content.source_metadata);
    console.log(`Transform completed: "${validated.title}"`);
  } catch (error) {
    return errorResult("transform", error);
  }

  // ── 4. Load (if auto_save) ──
  if (!autoSave) {
    return {
      success: true,
      recipe: validated,
      source_metadata: content.source_metadata,
    };
  }

  try {
    const { recipe_id, record } = await load(validated, userId, supabase, openRouter);
    console.log(`Load completed: ${recipe_id}`);
    return {
      success: true,
      recipe_id,
      recipe: validated,
      source_metadata: content.source_metadata,
    };
  } catch (error) {
    return errorResult("load", error);
  }
}

/**
 * Handle transform + load for multiple extracted recipes.
 * Each recipe is processed independently; per-recipe errors don't fail the batch.
 */
async function handleMultipleRecipes(
  extractedRecipes: ExtractedRecipe[],
  content: IntermediateContent,
  autoSave: boolean,
  userId: string,
  supabase: SupabaseClient,
  openRouter: OpenRouterClient
): Promise<PipelineResult> {
  const validatedRecipes: ValidatedRecipe[] = [];
  const recipeIds: string[] = [];
  const errors: PipelineError[] = [];

  for (const extracted of extractedRecipes) {
    try {
      const validated = transform(extracted, content.source_metadata);
      console.log(`Transform completed: "${validated.title}"`);

      if (autoSave) {
        try {
          const { recipe_id } = await load(validated, userId, supabase, openRouter);
          console.log(`Load completed: ${recipe_id}`);
          recipeIds.push(recipe_id);
        } catch (loadError: any) {
          console.warn(`Load failed for "${validated.title}": ${loadError.message}`);
          errors.push({
            stage: "load",
            code: "LOAD_FAILED",
            message: `Failed to save "${validated.title}": ${loadError.message}`,
          });
        }
      }

      validatedRecipes.push(validated);
    } catch (transformError: any) {
      console.warn(`Transform failed for "${extracted.title}": ${transformError.message}`);
      errors.push({
        stage: "transform",
        code: "TRANSFORM_FAILED",
        message: `Failed to validate "${extracted.title}": ${transformError.message}`,
      });
    }
  }

  if (validatedRecipes.length === 0) {
    return {
      success: false,
      errors: errors.length > 0 ? errors : [{
        stage: "transform",
        code: "ALL_RECIPES_FAILED",
        message: "All recipes failed validation",
      }],
      stage_failed: "transform",
    };
  }

  return {
    success: true,
    // Backwards-compatible: first recipe in singular fields
    recipe_id: recipeIds[0],
    recipe: validatedRecipes[0],
    // Multi-recipe fields
    recipe_ids: recipeIds.length > 0 ? recipeIds : undefined,
    recipes: validatedRecipes,
    source_metadata: content.source_metadata,
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function runAdapter(
  request: PipelineRequest,
  openRouter: OpenRouterClient
): Promise<IntermediateContent> {
  switch (request.source_type) {
    case "text":
      return textAdapter(request.text || "", request.images);

    case "url":
      if (!request.url) throw new Error("URL is required for url source_type");
      return urlAdapter(request.url);

    case "video":
      return videoAdapter(openRouter, {
        video_url: request.video_url,
        frame_urls: request.frame_urls,
        transcript: request.transcript,
      });

    default:
      throw new Error(`Unknown source_type: ${request.source_type}`);
  }
}

function errorResult(
  stage: PipelineError["stage"],
  error: any
): PipelineResult {
  // If it's already a PipelineError (thrown via createPipelineError)
  if (error.stage && error.code) {
    return {
      success: false,
      errors: [error as PipelineError],
      stage_failed: stage,
    };
  }

  return {
    success: false,
    errors: [
      {
        stage,
        code: "UNKNOWN_ERROR",
        message: error.message || String(error),
      },
    ],
    stage_failed: stage,
  };
}
