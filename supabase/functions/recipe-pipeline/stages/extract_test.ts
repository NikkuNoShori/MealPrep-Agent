import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { IntermediateContent } from "../../_shared/recipe-schema.ts";
import { shouldUseVisionExtract, normalizeExtractedRecipe } from "./extract.ts";

function rawRecipe(ingredients: unknown[]) {
  return {
    title: "Test Recipe",
    instructions: ["Step 1"],
    ingredients,
  };
}

function videoContent(
  rawText: string,
  images: string[] = []
): IntermediateContent {
  return {
    raw_text: rawText,
    images,
    source_metadata: {
      source_type: "video",
      source_url: "https://www.tiktok.com/@x/video/1",
      source_name: "tiktok.com",
      extracted_at: new Date().toISOString(),
      adapter_version: "1.1.0",
    },
  };
}

Deno.test("video with oEmbed caption uses text extract, not vision", () => {
  const content = videoContent(
    "Video Caption:\nHigh protein chicken bowl — 1 cup rice, 2 chicken breasts, bake 400F 25 min",
    ["https://p16-sign.tiktokcdn.com/thumb.jpg"]
  );
  assertEquals(shouldUseVisionExtract(content), false);
});

Deno.test("video with only thumbnail and no text uses vision", () => {
  const content = videoContent("", ["data:image/jpeg;base64,abc"]);
  assertEquals(shouldUseVisionExtract(content), true);
});

Deno.test("text source with attached image uses vision", () => {
  const content: IntermediateContent = {
    raw_text: "",
    images: ["data:image/jpeg;base64,abc"],
    source_metadata: {
      source_type: "text",
      extracted_at: new Date().toISOString(),
      adapter_version: "1.0.0",
    },
  };
  assertEquals(shouldUseVisionExtract(content), true);
});

Deno.test("url source never uses vision in extract stage", () => {
  const content: IntermediateContent = {
    raw_text: "Recipe from JSON-LD",
    images: ["https://example.com/photo.jpg"],
    source_metadata: {
      source_type: "url",
      source_url: "https://example.com/recipe",
      source_name: "example.com",
      extracted_at: new Date().toISOString(),
      adapter_version: "1.0.0",
    },
  };
  assertEquals(shouldUseVisionExtract(content), false);
});

// ── normalizeExtractedRecipe: unit-in-notes recovery ──
//
// Reported live: the model sometimes returns a correct `amount` but puts
// the unit word in `notes` and leaves `unit` empty (e.g. a real production
// case — {amount: 0.25, unit: "", notes: "teaspoon"} for "Cayenne"). That
// silently downgraded a normal fractional volume measurement into an
// unit-less quantity downstream. These are the exact corrupted values
// pulled from that recipe's stored data.

Deno.test("normalizeExtractedRecipe recovers a unit word misplaced in notes", () => {
  const recipe = normalizeExtractedRecipe(
    rawRecipe([
      { name: "Cayenne", amount: 0.25, unit: "", notes: "teaspoon", category: "pantry" },
      { name: "Cream Cheese", amount: 2, unit: "", notes: "tablespoons", category: "pantry" },
    ])
  );

  assertEquals(recipe.ingredients[0].unit, "teaspoon");
  assertEquals(recipe.ingredients[0].notes, "");
  assertEquals(recipe.ingredients[0].amount, 0.25);

  assertEquals(recipe.ingredients[1].unit, "tablespoons");
  assertEquals(recipe.ingredients[1].notes, "");
});

Deno.test("normalizeExtractedRecipe leaves genuinely unit-less notes untouched", () => {
  const recipe = normalizeExtractedRecipe(
    rawRecipe([
      { name: "Red Bell Pepper", amount: 1, unit: "", notes: "red bell pepper, diced", category: "pantry" },
      { name: "Lime Juice", amount: null, unit: "", notes: "juice of 1 lime", category: "pantry" },
    ])
  );

  assertEquals(recipe.ingredients[0].unit, "");
  assertEquals(recipe.ingredients[0].notes, "red bell pepper, diced");

  assertEquals(recipe.ingredients[1].unit, "");
  assertEquals(recipe.ingredients[1].notes, "juice of 1 lime");
});

Deno.test("normalizeExtractedRecipe does not touch an already-correct unit", () => {
  const recipe = normalizeExtractedRecipe(
    rawRecipe([
      { name: "Frozen Corn", amount: 1, unit: "cup", notes: "", category: "pantry" },
    ])
  );

  assertEquals(recipe.ingredients[0].unit, "cup");
});
