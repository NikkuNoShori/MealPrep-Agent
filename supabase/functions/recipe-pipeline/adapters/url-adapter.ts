import type { IntermediateContent } from "./types.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const ADAPTER_VERSION = "1.0.0";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * URL adapter — fetches a recipe page, tries JSON-LD first, falls back to DOM text extraction.
 */
export async function urlAdapter(url: string): Promise<IntermediateContent> {
  if (!url) throw new Error("URL is required");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Fetch the page
  const response = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Try JSON-LD structured data first (many recipe sites include Schema.org Recipe)
  const jsonLd = extractJsonLd(html);
  const images = extractImages(html, parsedUrl);
  const ogImage = extractOgImage(html);

  let rawText: string;
  let hasJsonLd = false;

  if (jsonLd) {
    rawText = formatJsonLdRecipe(jsonLd);
    hasJsonLd = true;
    console.log("JSON-LD recipe data found");
  } else {
    rawText = extractReadableText(html);
    console.log("Falling back to DOM text extraction");
  }

  if (!rawText.trim()) {
    throw new Error("Could not extract readable content from the URL");
  }

  // Prioritize og:image, then first content image
  const imageList: string[] = [];
  if (ogImage) imageList.push(ogImage);
  for (const img of images) {
    if (imageList.length >= 4) break;
    if (!imageList.includes(img)) imageList.push(img);
  }

  return {
    raw_text: rawText,
    images: imageList,
    source_metadata: {
      source_type: "url",
      source_url: url,
      source_name: parsedUrl.hostname.replace("www.", ""),
      extracted_at: new Date().toISOString(),
      adapter_version: ADAPTER_VERSION,
      extra: { has_json_ld: hasJsonLd },
    },
  };
}

/**
 * Extract JSON-LD Recipe data from the page.
 */
function extractJsonLd(html: string): Record<string, any> | null {
  const regex =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // Handle @graph array (common in WordPress/Yoast)
      if (data["@graph"]) {
        const recipe = data["@graph"].find(
          (item: any) => item["@type"] === "Recipe"
        );
        if (recipe) return recipe;
      }

      // Direct Recipe type
      if (data["@type"] === "Recipe") return data;

      // Array of types
      if (Array.isArray(data["@type"]) && data["@type"].includes("Recipe")) {
        return data;
      }

      // Array of objects
      if (Array.isArray(data)) {
        const recipe = data.find(
          (item: any) =>
            item["@type"] === "Recipe" ||
            (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
        );
        if (recipe) return recipe;
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  return null;
}

/**
 * Format JSON-LD recipe into human-readable text for the LLM.
 */
function formatJsonLdRecipe(ld: Record<string, any>): string {
  const parts: string[] = [];

  if (ld.name) parts.push(`Title: ${ld.name}`);
  if (ld.description) parts.push(`Description: ${ld.description}`);
  if (ld.prepTime) parts.push(`Prep Time: ${ld.prepTime}`);
  if (ld.cookTime) parts.push(`Cook Time: ${ld.cookTime}`);
  if (ld.totalTime) parts.push(`Total Time: ${ld.totalTime}`);
  if (ld.recipeYield) parts.push(`Servings: ${ld.recipeYield}`);
  if (ld.recipeCategory) parts.push(`Category: ${ld.recipeCategory}`);
  if (ld.recipeCuisine) parts.push(`Cuisine: ${ld.recipeCuisine}`);

  if (ld.recipeIngredient?.length) {
    parts.push(`\nIngredients:\n${ld.recipeIngredient.map((i: string) => `- ${i}`).join("\n")}`);
  }

  if (ld.recipeInstructions?.length) {
    const steps = ld.recipeInstructions.map((inst: any, i: number) => {
      if (typeof inst === "string") return `${i + 1}. ${inst}`;
      if (inst.text) return `${i + 1}. ${inst.text}`;
      return `${i + 1}. ${JSON.stringify(inst)}`;
    });
    parts.push(`\nInstructions:\n${steps.join("\n")}`);
  }

  if (ld.nutrition) {
    const n = ld.nutrition;
    const nutritionParts: string[] = [];
    if (n.calories) nutritionParts.push(`Calories: ${n.calories}`);
    if (n.proteinContent) nutritionParts.push(`Protein: ${n.proteinContent}`);
    if (n.carbohydrateContent) nutritionParts.push(`Carbs: ${n.carbohydrateContent}`);
    if (n.fatContent) nutritionParts.push(`Fat: ${n.fatContent}`);
    if (nutritionParts.length) parts.push(`\nNutrition: ${nutritionParts.join(", ")}`);
  }

  return parts.join("\n");
}

/**
 * Extract readable text from HTML using deno_dom.
 */
function extractReadableText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return stripTags(html);

  // Remove noise elements
  const noiseSelectors = [
    "script", "style", "nav", "footer", "header",
    "aside", ".sidebar", ".comments", ".ad", ".advertisement",
    "[role='navigation']", "[role='banner']", "[role='contentinfo']",
  ];
  for (const selector of noiseSelectors) {
    doc.querySelectorAll(selector).forEach((el: any) => el.remove());
  }

  // Try to find recipe content container
  const contentSelectors = [
    "[itemtype*='schema.org/Recipe']",
    ".recipe-content", ".recipe-body", ".recipe",
    "article", "[role='main']", "main", ".post-content",
    ".entry-content", ".content",
  ];

  for (const selector of contentSelectors) {
    const el = doc.querySelector(selector);
    if (el && el.textContent.trim().length > 200) {
      return cleanText(el.textContent);
    }
  }

  // Fall back to body text
  const body = doc.querySelector("body");
  return body ? cleanText(body.textContent) : "";
}

function extractImages(html: string, baseUrl: URL): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null && images.length < 10) {
    let src = match[1];
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = `${baseUrl.origin}${src}`;

    // Skip tiny images, icons, tracking pixels
    if (
      src.includes("1x1") || src.includes("pixel") ||
      src.includes("spacer") || src.includes(".svg") ||
      src.includes("data:image/gif")
    ) continue;

    if (src.startsWith("http")) images.push(src);
  }

  return images;
}

function extractOgImage(html: string): string | null {
  const match = html.match(
    /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i
  );
  return match?.[1] || null;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanText(text: string): string {
  return text
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
}
