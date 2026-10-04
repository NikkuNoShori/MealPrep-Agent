/**
 * ToS-compliant video recipe intake orchestration.
 * - TikTok/YouTube URL → oEmbed + link mining (via pipeline url/video adapter)
 * - Uploaded video → client frames + storage upload + server transcription
 */

import { apiClient } from "./api";
import {
  extractVideoFrames,
  validateIntakeVideoFile,
} from "@/utils/videoFrameExtractor";
import { pickBestFrameDataUrl } from "@/utils/recipeImagePicker";
import type { ChatMessageResponse, StructuredRecipe } from "@/types";

export interface VideoIntakeTextOptions {
  pinnedCommentText?: string;
  supplementaryText?: string;
}

export interface ProcessVideoUrlOptions extends VideoIntakeTextOptions {
  autoSave?: boolean;
  signal?: AbortSignal;
}

export interface ProcessUploadedVideoOptions extends VideoIntakeTextOptions {
  /** Optional TikTok/YouTube URL for oEmbed caption alongside the upload. */
  videoUrl?: string;
  autoSave?: boolean;
  frameCount?: number;
  signal?: AbortSignal;
}

export interface VideoIntakeOutcome {
  pipeline: Record<string, unknown>;
  previewImageDataUrl?: string;
  thumbnailUrl?: string;
}

function readThumbnailUrl(result: Record<string, unknown>): string | undefined {
  const meta = result.source_metadata as
    | { extra?: { thumbnail_url?: string | null } }
    | undefined;
  const url = meta?.extra?.thumbnail_url;
  return typeof url === "string" && url.startsWith("http") ? url : undefined;
}

const TIKTOK_URL_RE =
  /https?:\/\/(?:(?:www|vm|vt)\.)?tiktok\.com\/\S+/i;
const YOUTUBE_URL_RE =
  /https?:\/\/(?:(?:www\.)?youtube\.com\/\S+|youtu\.be\/\S+)/i;

/** Extract first short-form video URL from a message string. */
export function findVideoUrlInText(text: string): string | undefined {
  return text.match(TIKTOK_URL_RE)?.[0] ?? text.match(YOUTUBE_URL_RE)?.[0];
}

/**
 * Paste a TikTok/YouTube URL — uses oEmbed caption, link mining, optional pinned comment.
 */
export async function processVideoUrl(
  url: string,
  options: ProcessVideoUrlOptions = {}
): Promise<VideoIntakeOutcome> {
  const payload = {
    url: url.trim(),
    pinned_comment_text: options.pinnedCommentText,
    supplementary_text: options.supplementaryText,
  };

  const pipeline = options.autoSave
    ? ((await apiClient.ingestRecipeFromUrl(url.trim(), true, payload)) as Record<
        string,
        unknown
      >)
    : ((await apiClient.extractRecipeOnly("url", payload, {
        signal: options.signal,
      })) as Record<string, unknown>);

  return {
    pipeline,
    thumbnailUrl: readThumbnailUrl(pipeline),
  };
}

/**
 * User-uploaded saved video — client frames + media upload + server STT + OCR.
 */
export async function processUploadedVideo(
  file: File,
  options: ProcessUploadedVideoOptions = {}
): Promise<VideoIntakeOutcome> {
  validateIntakeVideoFile(file);
  options.signal?.throwIfAborted();

  const frameUrls = await extractVideoFrames(file, {
    frameCount: options.frameCount ?? 8,
  });
  options.signal?.throwIfAborted();
  const previewImageDataUrl = await pickBestFrameDataUrl(frameUrls);
  options.signal?.throwIfAborted();
  const mediaUrl = await apiClient.uploadIntakeMedia(file);
  options.signal?.throwIfAborted();

  const data = {
    video_url: options.videoUrl,
    frame_urls: frameUrls,
    media_url: mediaUrl,
    pinned_comment_text: options.pinnedCommentText,
    supplementary_text: options.supplementaryText,
    auto_transcribe: true,
  };

  const pipeline = options.autoSave
    ? ((await apiClient.ingestRecipeFromVideo(data, true)) as Record<string, unknown>)
    : ((await apiClient.extractRecipeOnly("video", data, {
        signal: options.signal,
      })) as Record<string, unknown>);

  return {
    pipeline,
    previewImageDataUrl,
    thumbnailUrl: readThumbnailUrl(pipeline),
  };
}

/**
 * Smart entry: URL in text → oEmbed path; attached file → upload path; both if present.
 */
export async function processVideoIntake(input: {
  message?: string;
  videoFile?: File;
  pinnedCommentText?: string;
  supplementaryText?: string;
  autoSave?: boolean;
  signal?: AbortSignal;
}): Promise<VideoIntakeOutcome> {
  const url = input.message ? findVideoUrlInText(input.message) : undefined;

  if (input.videoFile) {
    return processUploadedVideo(input.videoFile, {
      videoUrl: url,
      pinnedCommentText: input.pinnedCommentText,
      supplementaryText: input.supplementaryText,
      autoSave: input.autoSave,
      signal: input.signal,
    });
  }

  if (url) {
    return processVideoUrl(url, {
      pinnedCommentText: input.pinnedCommentText,
      supplementaryText: input.supplementaryText,
      autoSave: input.autoSave,
      signal: input.signal,
    });
  }

  throw new Error("Provide a TikTok/YouTube URL or upload a saved video file.");
}

/** Map recipe-pipeline result to chat UI shape (preview, no save). */
export function mapPipelineToChatResponse(
  outcome: VideoIntakeOutcome | { pipeline?: Record<string, unknown> } & Record<string, unknown>
): ChatMessageResponse {
  const pipeline =
    "pipeline" in outcome && outcome.pipeline
      ? outcome.pipeline
      : (outcome as Record<string, unknown>);
  const previewImageDataUrl =
    "previewImageDataUrl" in outcome
      ? (outcome.previewImageDataUrl as string | undefined)
      : undefined;
  const thumbnailUrl =
    "thumbnailUrl" in outcome
      ? (outcome.thumbnailUrl as string | undefined)
      : readThumbnailUrl(pipeline);

  const result = pipeline as {
    success?: boolean;
    recipe?: Record<string, unknown>;
    recipes?: Record<string, unknown>[];
    source_metadata?: { source_url?: string; source_name?: string };
    errors?: { message?: string }[];
  };
  const rawList =
    result.recipes ?? (result.recipe ? [result.recipe] : []);

  const recipes: StructuredRecipe[] = rawList.map((r) => ({
    title: String(r.title ?? "Untitled"),
    description: (r.description as string | null) ?? undefined,
    prepTime: (r.prep_time ?? r.prepTime) as number | undefined,
    cookTime: (r.cook_time ?? r.cookTime) as number | undefined,
    servings: r.servings as number | undefined,
    difficulty: r.difficulty as StructuredRecipe["difficulty"],
    tags: (r.tags as string[]) ?? [],
    ingredients: (r.ingredients as StructuredRecipe["ingredients"]) ?? [],
    instructions: (r.instructions as string[]) ?? [],
    imageUrl:
      (r.image_url ?? r.imageUrl ?? thumbnailUrl) as string | undefined,
    sourceUrl:
      (r.source_url as string | undefined) ??
      result.source_metadata?.source_url,
    sourceName:
      (r.source_name as string | undefined) ??
      result.source_metadata?.source_name,
  }));

  const ok = result.success !== false && recipes.length > 0;
  const errMsg = result.errors?.[0]?.message;

  return {
    response: {
      id: `video-intake-${Date.now()}`,
      content: ok
        ? recipes.length > 1
          ? `Extracted ${recipes.length} recipes from your video source. Review and save below.`
          : `Extracted "${recipes[0].title}" from your video source. Review and save below.`
        : `Could not extract a recipe: ${errMsg ?? "no structured output"}`,
      timestamp: new Date().toISOString(),
    },
    recipe: recipes[0],
    recipes: recipes.length > 1 ? recipes : undefined,
    previewImageDataUrl,
    thumbnailUrl,
  };
}
