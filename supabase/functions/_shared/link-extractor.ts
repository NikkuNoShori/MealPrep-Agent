/**
 * Harvest recipe-related URLs from free text (captions, comments, transcripts).
 * Used after oEmbed / user-pasted supplementary text — no HTML scraping.
 */

const URL_RE =
  /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

/** Domains likely to host full recipe pages (not social / video hosts). */
const RECIPE_DOMAIN_HINTS = [
  "allrecipes.com",
  "foodnetwork.com",
  "seriouseats.com",
  "bonappetit.com",
  "epicurious.com",
  "nytimes.com",
  "bbcgoodfood.com",
  "tasty.co",
  "delish.com",
  "simplyrecipes.com",
  "cookieandkate.com",
  "budgetbytes.com",
  "skinnytaste.com",
  "halfbakedharvest.com",
  "pinchofyum.com",
  "minimalistbaker.com",
  "recipetineats.com",
  "thepioneerwoman.com",
  "eatingwell.com",
  "food.com",
  "myrecipes.com",
  "tasteofhome.com",
  "kingarthurbaking.com",
  "sallysbakingaddiction.com",
  "loveandlemons.com",
];

const RECIPE_PATH_HINTS = [
  "/recipe",
  "/recipes/",
  "/rezept",
  "/cooking/",
  "/food/recipes",
];

const LOW_VALUE_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "twitter.com",
  "x.com",
  "linktr.ee",
  "beacons.ai",
  "stan.store",
]);

export interface ExtractedLink {
  url: string;
  hostname: string;
  score: number;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function scoreRecipeUrl(url: string, hostname: string): number {
  if (!hostname || LOW_VALUE_HOSTS.has(hostname)) return 0;

  let score = 1;
  const lower = url.toLowerCase();

  if (RECIPE_DOMAIN_HINTS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
    score += 5;
  }
  if (RECIPE_PATH_HINTS.some((p) => lower.includes(p))) {
    score += 3;
  }
  if (lower.includes("recipe")) score += 2;
  if (lower.includes("cook") || lower.includes("food")) score += 1;

  return score;
}

/** Return unique URLs found in text, highest recipe-likelihood first. */
export function extractLinksFromText(text: string): ExtractedLink[] {
  if (!text?.trim()) return [];

  const seen = new Set<string>();
  const results: ExtractedLink[] = [];

  for (const match of text.matchAll(URL_RE)) {
    let url = match[0].replace(/[),.;!?]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);

    const hostname = hostnameOf(url);
    const score = scoreRecipeUrl(url, hostname);
    if (score > 0) {
      results.push({ url, hostname, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/** Best candidate recipe page URL, or undefined if none scored. */
export function bestRecipeUrl(text: string): string | undefined {
  return extractLinksFromText(text)[0]?.url;
}
