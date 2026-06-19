/** Platform detection for short-form / video URLs (ToS-safe oEmbed path). */

const TIKTOK_RE =
  /^https?:\/\/(?:(?:www|vm|vt)\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|\w+\/video\/\d+|\w+)/i;

const YOUTUBE_RE =
  /^https?:\/\/(?:(?:www\.)?youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)/i;

const INSTAGRAM_REEL_RE =
  /^https?:\/\/(?:(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+)/i;

export function isTikTokUrl(url: string): boolean {
  return TIKTOK_RE.test(url.trim());
}

export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_RE.test(url.trim());
}

export function isInstagramReelUrl(url: string): boolean {
  return INSTAGRAM_REEL_RE.test(url.trim());
}

/** URLs that should use video-adapter (oEmbed / frames / transcript), not HTML scrape. */
export function isShortFormVideoUrl(url: string): boolean {
  return isTikTokUrl(url) || isYouTubeUrl(url) || isInstagramReelUrl(url);
}

export function platformNameForUrl(url: string): string {
  if (isTikTokUrl(url)) return "tiktok.com";
  if (isYouTubeUrl(url)) return "youtube.com";
  if (isInstagramReelUrl(url)) return "instagram.com";
  return "video";
}
