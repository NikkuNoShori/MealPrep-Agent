import type { IntermediateContent } from "./types.ts";
import type { OpenRouterClient } from "../../_shared/openrouter-client.ts";

const ADAPTER_VERSION = "1.0.0";

/**
 * Video adapter — handles YouTube URLs (transcript/description) and
 * pre-extracted video frames (vision OCR via OpenRouter).
 *
 * For uploaded videos, the frontend should extract 3-5 keyframes and pass
 * them as frame_urls (Supabase Storage URLs) or base64 images.
 */
export async function videoAdapter(
  openRouter: OpenRouterClient,
  options: {
    video_url?: string;
    frame_urls?: string[];
    transcript?: string;
  }
): Promise<IntermediateContent> {
  const { video_url, frame_urls, transcript } = options;

  if (!video_url && !frame_urls?.length && !transcript) {
    throw new Error(
      "Video adapter requires a video_url, frame_urls, or transcript"
    );
  }

  const textParts: string[] = [];
  const images: string[] = [];
  let sourceName = "video";
  let sourceUrl = video_url;

  // 1. If YouTube URL, try to get transcript/description
  if (video_url && isYouTubeUrl(video_url)) {
    sourceName = "youtube.com";
    const ytData = await fetchYouTubeData(video_url);
    if (ytData.description) {
      textParts.push(`Video Description:\n${ytData.description}`);
    }
    if (ytData.title) {
      textParts.push(`Video Title: ${ytData.title}`);
    }
  }

  // 2. If transcript provided, use it directly
  if (transcript) {
    textParts.push(`Transcript:\n${transcript}`);
  }

  // 3. If frames provided, run vision OCR on each
  if (frame_urls?.length) {
    console.log(`Running vision OCR on ${frame_urls.length} frames`);
    const ocrText = await extractTextFromFrames(openRouter, frame_urls);
    if (ocrText) {
      textParts.push(`Extracted from video frames:\n${ocrText}`);
    }
    images.push(...frame_urls.slice(0, 4));
  }

  const rawText = textParts.join("\n\n");
  if (!rawText.trim() && images.length === 0) {
    throw new Error("Could not extract any content from the video source");
  }

  return {
    raw_text: rawText,
    images,
    source_metadata: {
      source_type: "video",
      source_url: sourceUrl,
      source_name: sourceName,
      extracted_at: new Date().toISOString(),
      adapter_version: ADAPTER_VERSION,
      extra: {
        has_transcript: !!transcript,
        frame_count: frame_urls?.length ?? 0,
      },
    },
  };
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
}

/**
 * Fetch basic YouTube metadata via oembed (no API key needed).
 */
async function fetchYouTubeData(
  url: string
): Promise<{ title?: string; description?: string }> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return {};

    const data = await response.json();
    return { title: data.title };
  } catch {
    console.warn("Could not fetch YouTube metadata");
    return {};
  }
}

/**
 * Send video frames to the vision model for text/recipe extraction.
 */
async function extractTextFromFrames(
  openRouter: OpenRouterClient,
  frameUrls: string[]
): Promise<string> {
  try {
    const response = await openRouter.chatWithImages(
      "You are an OCR system. Extract ALL visible text from these video frames. Include recipe titles, ingredients, instructions, and any other text. Return only the extracted text, no commentary.",
      "Extract all visible text from these video frames. Focus on recipe content: titles, ingredient lists, cooking instructions, measurements, and cooking times.",
      frameUrls.slice(0, 4),
      "qwen/qwen-2.5-vl-7b-instruct",
      { temperature: 0.1, max_tokens: 3000 }
    );
    return response;
  } catch (error) {
    console.error("Vision OCR failed:", error);
    return "";
  }
}
