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
    console.log(`Extract completed: "${extracted.title}"`);
  } catch (error) {
    return errorResult("extract", error);
  }

  // ── 3. Transform ──
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
