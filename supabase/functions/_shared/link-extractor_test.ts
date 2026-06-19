import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  bestRecipeUrl,
  extractLinksFromText,
} from "./link-extractor.ts";

Deno.test("extractLinksFromText finds recipe URLs and ignores social hosts", () => {
  const text =
    "Full recipe https://www.allrecipes.com/recipe/123/chicken/ also tiktok.com/@x";
  const links = extractLinksFromText(text);
  assertEquals(links.length, 1);
  assertEquals(links[0].hostname, "www.allrecipes.com");
  assertEquals(links[0].score >= 5, true);
});

Deno.test("bestRecipeUrl prefers /recipe/ paths", () => {
  const text =
    "blog https://food.example.com/recipes/pasta and https://example.com/about";
  const best = bestRecipeUrl(text);
  assertEquals(best, "https://food.example.com/recipes/pasta");
});

Deno.test("extractLinksFromText returns empty for no URLs", () => {
  assertEquals(extractLinksFromText("no links here").length, 0);
});

Deno.test("extractLinksFromText strips trailing punctuation", () => {
  const text = "see https://seriouseats.com/recipe/pasta.";
  const links = extractLinksFromText(text);
  assertEquals(links[0]?.url, "https://seriouseats.com/recipe/pasta");
});
