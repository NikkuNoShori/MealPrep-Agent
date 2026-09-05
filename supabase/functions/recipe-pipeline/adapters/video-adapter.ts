import type { IntermediateContent } from "./types.ts";
import type { OpenRouterClient } from "../../_shared/openrouter-client.ts";
import { fetchOEmbedMetadata } from "../../_shared/platform-oembed.ts";
import { bestRecipeUrl } from "../../_shared/link-extractor.ts";
import {
  isShortFormVideoUrl,
  platformNameForUrl,
} from "../../_shared/video-url-utils.ts";
import {
  transcribeMediaBytes,
  transcribeMediaFromUrl,
} from "../../_shared/transcribe-media.ts";
import { resolveMediaApiKey } from "../../_shared/openrouter-keys.ts";
import { urlAdapter } from "./url-adapter.ts";

const ADAPTER_VERSION = "1.1.0";
const MAX_OCR_FRAMES = 8;

export interface VideoAdapterOptions {
  video_url?: string;
  frame_urls?: string[];
  transcript?: string;
  /** User-pasted pinned comment or extra caption (ToS-safe manual supplement). */
  pinned_comment_text?: string;
  /** Alias for supplementary pasted text from creator. */
  supplementary_text?: string;
  /** Public URL of user-uploaded video/audio in Supabase storage. */
  media_url?: string;
  /** Base64 data URL of user-uploaded video/audio (smaller clips). */
  media_base64?: string;
  /** When true (default if media present), run STT on uploaded media. */
  auto_transcribe?: boolean;
}

/**
 * Video adapter — ToS-compliant intake:
 * - oEmbed for TikTok / YouTube URLs (caption, author, thumbnail)
 * - Link mining on caption + user-pasted comments
 * - Optional URL-adapter follow-up when a recipe link is found
 * - Vision OCR on client-supplied frames (+ oEmbed thumbnail)
 * - STT on user-uploaded media (never TikTok CDN download)
 */
export async function videoAdapter(
  openRouter: OpenRouterClient,
  options: VideoAdapterOptions
): Promise<IntermediateContent> {
  const {
    video_url,
    frame_urls,
    transcript,
    pinned_comment_text,
    supplementary_text,
    media_url,
    media_base64,
    auto_transcribe,
  } = options;

  const hasMedia = !!(media_url || media_base64);
  const shouldTranscribe = auto_transcribe !== false && hasMedia && !transcript;

  if (
    !video_url &&
    !frame_urls?.length &&
    !transcript &&
    !hasMedia &&
    !pinned_comment_text &&
    !supplementary_text
  ) {
    throw new Error(
      "Video adapter requires video_url, frame_urls, transcript, media upload, or supplementary text"
    );
  }

  const textParts: string[] = [];
  const images: string[] = [];
  let sourceName = "video";
  let sourceUrl = video_url;

  // ── 1. oEmbed for short-form video URLs ──
  if (video_url && isShortFormVideoUrl(video_url)) {
    sourceName = platformNameForUrl(video_url);
    const oembed = await fetchOEmbedMetadata(video_url);
    if (oembed.title) {
      textParts.push(`Video Caption:\n${oembed.title}`);
    }
    if (oembed.authorName) {
      textParts.push(`Creator: ${oembed.authorName}`);
    }
    if (oembed.thumbnailUrl) {
      images.push(oembed.thumbnailUrl);
    }
  } else if (video_url) {
    sourceUrl = video_url;
  }

  // ── 2. User-pasted supplementary text (pinned comment, etc.) ──
  const extraText = [supplementary_text, pinned_comment_text]
    .filter(Boolean)
    .join("\n\n");
  if (extraText) {
    textParts.push(`Creator Comment / Supplement:\n${extraText}`);
  }

  // ── 3. Transcript: provided or auto-transcribe uploaded media ──
  let resolvedTranscript = transcript;
  if (!resolvedTranscript && shouldTranscribe) {
    resolvedTranscript = await transcribeUploadedMedia(media_url, media_base64);
  }
  if (resolvedTranscript) {
    textParts.push(`Transcript:\n${resolvedTranscript}`);
  }

  // ── 4. Link mining on all text gathered so far ──
  const combinedText = textParts.join("\n\n");
  const recipeLink = bestRecipeUrl(combinedText);
  if (recipeLink) {
    try {
      const linked = await urlAdapter(recipeLink);
      if (linked.raw_text?.trim()) {
        textParts.push(`Linked Recipe Page:\n${linked.raw_text}`);
        if (linked.images?.length) {
          images.push(...linked.images.slice(0, 2));
        }
      }
    } catch (error) {
      console.warn(`Could not fetch linked recipe URL ${recipeLink}:`, error);
      textParts.push(`Recipe link found (not fetched): ${recipeLink}`);
    }
  }

  // ── 5. Vision OCR on frames (+ oEmbed thumbnail already in images) ──
  const ocrTargets = [
    ...(frame_urls ?? []),
    ...images.filter((u) => u.startsWith("http")),
  ];
  const uniqueOcr = [...new Set(ocrTargets)].slice(0, MAX_OCR_FRAMES);

  if (uniqueOcr.length > 0) {
    console.log(`Running vision OCR on ${uniqueOcr.length} frame(s)`);
    const ocrText = await extractTextFromFrames(openRouter, uniqueOcr);
    if (ocrText) {
      textParts.push(`Extracted from video frames:\n${ocrText}`);
    }
  }

  // Keep client frame data URLs for downstream image handling
  if (frame_urls?.length) {
    for (const f of frame_urls) {
      if (!images.includes(f)) images.push(f);
    }
  }

  const rawText = textParts.join("\n\n");
  if (!rawText.trim() && images.length === 0) {
    throw new Error("Could not extract any content from the video source");
  }

  return {
    raw_text: rawText,
    images: images.slice(0, MAX_OCR_FRAMES),
    source_metadata: {
      source_type: "video",
      source_url: sourceUrl,
      source_name: sourceName,
      extracted_at: new Date().toISOString(),
      adapter_version: ADAPTER_VERSION,
      extra: {
        has_transcript: !!resolvedTranscript,
        frame_count: frame_urls?.length ?? 0,
        recipe_link_found: recipeLink ?? null,
        oembed_used: !!(video_url && isShortFormVideoUrl(video_url)),
        thumbnail_url: images.find((u) => u.startsWith("http")) ?? null,
      },
    },
  };
}

async function transcribeUploadedMedia(
  mediaUrl?: string,
  mediaBase64?: string
): Promise<string> {
  const apiKey = resolveMediaApiKey();

  if (mediaUrl) {
    return transcribeMediaFromUrl(apiKey, mediaUrl);
  }

  if (mediaBase64) {
    const { bytes, mimeType, filename } = parseDataUrl(mediaBase64);
    return transcribeMediaBytes(apiKey, bytes, mimeType, filename);
  }

  throw new Error("No media_url or media_base64 for transcription");
}

function parseDataUrl(dataUrl: string): {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid media_base64 data URL");
  const mimeType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("quicktime")
    ? "mov"
    : "mp4";
  return { bytes, mimeType, filename: `upload.${ext}` };
}

async function extractTextFromFrames(
  openRouter: OpenRouterClient,
  frameUrls: string[]
): Promise<string> {
  try {
    const response = await openRouter.chatWithImages(
      "You are an OCR system. Extract ALL visible text from these video frames. Include recipe titles, ingredients, instructions, and any other text. Return only the extracted text, no commentary.",
      "Extract all visible text from these video frames. Focus on recipe content: titles, ingredient lists, cooking instructions, measurements, and cooking times.",
      frameUrls.slice(0, MAX_OCR_FRAMES),
      "qwen/qwen3-vl-8b-instruct", // qwen-2.5-vl-7b retired; Qwen3 VL 8B is the successor
      { temperature: 0.1, max_tokens: 3000 }
    );
    return response;
  } catch (error) {
    console.error("Vision OCR failed:", error);
    return "";
  }
}
