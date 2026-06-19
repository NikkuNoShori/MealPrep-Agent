/**
 * Official oEmbed metadata for video platforms (ToS-compliant, no scraping).
 */

import { isTikTokUrl, isYouTubeUrl } from "./video-url-utils.ts";

export interface OEmbedMetadata {
  title?: string;
  authorName?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  providerName?: string;
}

export async function fetchOEmbedMetadata(
  videoUrl: string
): Promise<OEmbedMetadata> {
  if (isTikTokUrl(videoUrl)) {
    return fetchTikTokOEmbed(videoUrl);
  }
  if (isYouTubeUrl(videoUrl)) {
    return fetchYouTubeOEmbed(videoUrl);
  }
  return {};
}

async function fetchTikTokOEmbed(videoUrl: string): Promise<OEmbedMetadata> {
  try {
    const oembedUrl =
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.warn(`TikTok oEmbed failed: ${response.status}`);
      return {};
    }
    const data = await response.json();
    return {
      // TikTok puts the caption in `title` per official docs.
      title: data.title,
      authorName: data.author_name,
      authorUrl: data.author_url,
      thumbnailUrl: data.thumbnail_url,
      providerName: "TikTok",
    };
  } catch (error) {
    console.warn("TikTok oEmbed error:", error);
    return {};
  }
}

async function fetchYouTubeOEmbed(videoUrl: string): Promise<OEmbedMetadata> {
  try {
    const oembedUrl =
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return {};
    const data = await response.json();
    return {
      title: data.title,
      authorName: data.author_name,
      authorUrl: data.author_url,
      thumbnailUrl: data.thumbnail_url,
      providerName: "YouTube",
    };
  } catch (error) {
    console.warn("YouTube oEmbed error:", error);
    return {};
  }
}
