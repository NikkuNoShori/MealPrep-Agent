import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { IntermediateContent, ExtractedRecipe } from "../../_shared/recipe-schema.ts";
import { shouldUseVisionExtract, normalizeExtractedRecipe, plausibilityFlags } from "./extract.ts";

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

// ── normalizeExtractedRecipe: instruction noise filter (MOP-0034 Phase 1c) ──
//
// The old filter dropped any step of 3 words or fewer, and any step starting
// with "garnish with" or "serve immediately" — deleting real steps like
// "Bake 20 minutes." The filter must now only drop a step that IS a filler
// phrase in its entirety.

Deno.test("short but real instruction steps survive normalization", () => {
  const recipe = normalizeExtractedRecipe({
    title: "Test Recipe",
    ingredients: [{ name: "salt", amount: 1, unit: "tsp", category: "pantry" }],
    instructions: [
      "Bake 20 minutes.",
      "Season to taste.",
      "Garnish with parsley and serve.",
      "Enjoy!",
    ],
  });

  assertEquals(recipe.instructions, [
    "Bake 20 minutes.",
    "Season to taste.",
    "Garnish with parsley and serve.",
  ]);
});

Deno.test("pure filler closing remarks are dropped", () => {
  const recipe = normalizeExtractedRecipe({
    title: "Test Recipe",
    ingredients: [{ name: "salt", amount: 1, unit: "tsp", category: "pantry" }],
    instructions: ["Mix well.", "Enjoy!", "Dig in!", "Bon appétit!"],
  });

  assertEquals(recipe.instructions, ["Mix well."]);
});

// ── plausibilityFlags (MOP-0034 Phase 5a) ──
//
// Soft checks that trigger escalation to the next vision model. Must flag,
// never reject — flags only decide whether extract() tries another model.

function minimalRecipe(overrides: Partial<ExtractedRecipe>): ExtractedRecipe {
  return {
    title: "Test Recipe",
    description: null,
    ingredients: [],
    instructions: [],
    prepTime: null,
    cookTime: null,
    totalTime: null,
    servings: null,
    difficulty: null,
    tags: [],
    cuisine: null,
    nutrition: null,
    imageUrl: null,
    ...overrides,
  };
}

Deno.test("plausibilityFlags reproduces the 2026-10-12 pickle soup collapse", () => {
  const recipe = minimalRecipe({
    ingredients: [
      {
        name: "russet potatoes",
        amount: 3,
        unit: "c",
        category: "produce",
        notes: "(2-3 pounds) diced (this also works with frozen potatoes)",
      },
    ],
    instructions: [
      "In a large pot over high heat begin boiling about 6 cups of salted water. Once boiling add in potatoes, boil and drain. If using a second, over medium heat add olive oil, onion, celery, carrot and garlic. Cook until translucent about 8-10 minutes. Season with salt and pepper to preference.",
      "Once translucent, add in butter and melt then flour and mix until coated. Slowly start to incorporate the broth, add in the potatoes, pickles, pickle brine, fresh herbs and simmer for 20-30 minutes over medium heat. Add in the cheese and heavy cream and mix until combined!",
      "You can enjoy from here or dress a bowl!",
    ],
  });

  const flags = plausibilityFlags(recipe);

  assertEquals(flags.length > 0, true);
  assertEquals(flags.some((f) => f.includes("only 1 ingredient")), true);
});

Deno.test("plausibilityFlags does not flag a well-formed multi-ingredient recipe", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "russet potatoes", amount: 3, unit: "", category: "produce", notes: "or 3 cups (2-3 lbs); diced" },
      { name: "olive oil", amount: 2, unit: "tbsp", category: "pantry", notes: "" },
      { name: "yellow onion", amount: 1, unit: "", category: "produce", notes: "diced" },
      { name: "garlic", amount: 6, unit: "clove", category: "produce", notes: "minced" },
    ],
    instructions: ["Boil the potatoes.", "Saute the onion and garlic in oil."],
  });

  assertEquals(plausibilityFlags(recipe), []);
});

Deno.test("plausibilityFlags catches an unresolved alternative-quantity marker", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "russet potatoes or 3c (2-3 lbs) diced", amount: 3, unit: "", category: "produce", notes: "" },
      { name: "olive oil", amount: 2, unit: "tbsp", category: "pantry", notes: "" },
      { name: "onion", amount: 1, unit: "", category: "produce", notes: "" },
    ],
    instructions: ["Boil the potatoes."],
  });

  const flags = plausibilityFlags(recipe);
  assertEquals(flags.some((f) => f.includes("alternative-quantity marker")), true);
});

Deno.test("plausibilityFlags catches ingredients mentioned in instructions but missing from the list", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "russet potatoes", amount: 3, unit: "", category: "produce", notes: "" },
      { name: "olive oil", amount: 2, unit: "tbsp", category: "pantry", notes: "" },
      { name: "salt", amount: 1, unit: "tsp", category: "pantry", notes: "" },
    ],
    instructions: ["Add in the pickles, pickle brine, and fresh dill, then melt in the cheese."],
  });

  const flags = plausibilityFlags(recipe);
  assertEquals(flags.some((f) => f.includes("instructions reference ingredients not in the list")), true);
});

// ── plausibilityFlags: dropped range quantities (2026-10-13 follow-up) ──
//
// Reported after 1f/1g/1h/5a shipped: a 20-ingredient extraction correctly
// resolved the "3 potatoes or 3c" alternative-quantity case, but "4-6 cups
// of vegetable or chicken broth" came back with amount: null instead of
// amount: 4 (low end of the range) — the prompt had no rule for plain
// ranges, only for the "X or Y" alternative-quantity pattern.

Deno.test("plausibilityFlags catches a dropped range quantity (amount null, digit left in name)", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "russet potatoes", amount: 3, unit: "", category: "produce", notes: "or 3 cups (2-3 lbs); diced" },
      { name: "olive oil", amount: 2, unit: "tbsp", category: "pantry", notes: "" },
      { name: "4-6 cups of vegetable or chicken broth", amount: null, unit: "", category: "pantry", notes: "" },
    ],
    instructions: ["Simmer everything together."],
  });

  const flags = plausibilityFlags(recipe);
  assertEquals(flags.some((f) => f.includes("quantity likely dropped")), true);
});

Deno.test("plausibilityFlags does not flag a genuinely unquantifiable ingredient", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "russet potatoes", amount: 3, unit: "", category: "produce", notes: "" },
      { name: "olive oil", amount: 2, unit: "tbsp", category: "pantry", notes: "" },
      { name: "salt and pepper", amount: null, unit: "", category: "pantry", notes: "to taste" },
    ],
    instructions: ["Season to taste."],
  });

  const flags = plausibilityFlags(recipe);
  assertEquals(flags.some((f) => f.includes("quantity likely dropped")), false);
});

// ── plausibilityFlags: unfolded garnish duplicates (2026-10-13 follow-up) ──
//
// Reported in the same extraction: "heavy cream", "sriracha", and "fresh
// dill" each appeared twice — once correctly in the main ingredient list,
// once again as a blank-amount duplicate pulled from the recipe's "for
// garnish" line, which should have been folded into instructions instead.

Deno.test("plausibilityFlags catches a duplicated ingredient from an unfolded garnish line", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "russet potatoes", amount: 3, unit: "", category: "produce", notes: "" },
      { name: "heavy cream", amount: 0.5, unit: "cup", category: "dairy", notes: "" },
      { name: "sriracha", amount: null, unit: "", category: "condiments", notes: "for drizzling" },
      { name: "heavy cream", amount: null, unit: "", category: "dairy", notes: "for drizzling" },
    ],
    instructions: ["Simmer and serve."],
  });

  const flags = plausibilityFlags(recipe);
  assertEquals(flags.some((f) => f.includes("duplicate ingredient name")), true);
});

Deno.test("plausibilityFlags does not flag distinct ingredients with similar words", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "russet potatoes", amount: 3, unit: "", category: "produce", notes: "" },
      { name: "olive oil", amount: 2, unit: "tbsp", category: "pantry", notes: "" },
      { name: "heavy cream", amount: 0.5, unit: "cup", category: "dairy", notes: "" },
    ],
    instructions: ["Simmer and serve."],
  });

  assertEquals(plausibilityFlags(recipe), []);
});

// ── plausibilityFlags: container count vs. real measurement (2026-10-13 follow-up) ──
//
// Reported on a "Tater Tot Casserole" extraction, same day as the pickle
// soup follow-ups: "1 can condensed cream of celery soup (10 1/2 ounce),
// undiluted" extracted as amount: 1, unit: "can" — losing the only quantity
// that matters for grocery shopping, since can sizes vary by brand/store.
// "1 16oz package frozen tater tots" extracted as amount: 1, unit: "16 oz
// package" — a compound string masquerading as a unit, instead of
// amount: 16, unit: "oz".

Deno.test("plausibilityFlags catches a compound unit string containing a digit", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "ground beef", amount: 1, unit: "lb", category: "protein", notes: "lean" },
      { name: "onion", amount: 0.5, unit: "", category: "produce", notes: "medium, chopped" },
      { name: "frozen tater tots", amount: 1, unit: "16 oz package", category: "pantry", notes: "" },
    ],
    instructions: ["Bake until golden."],
  });

  const flags = plausibilityFlags(recipe);
  assertEquals(flags.some((f) => f.includes("compound unit")), true);
});

Deno.test("plausibilityFlags catches a container word used as a multi-word unit", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "ground beef", amount: 1, unit: "lb", category: "protein", notes: "lean" },
      { name: "onion", amount: 0.5, unit: "", category: "produce", notes: "medium, chopped" },
      { name: "cheddar cheese", amount: 1, unit: "cup", category: "dairy", notes: "shredded" },
      { name: "condensed cream of celery soup", amount: 1, unit: "large can", category: "pantry", notes: "undiluted" },
    ],
    instructions: ["Bake until golden."],
  });

  const flags = plausibilityFlags(recipe);
  assertEquals(flags.some((f) => f.includes("compound unit")), true);
});

Deno.test("plausibilityFlags does not flag a single-word container unit with no size given", () => {
  const recipe = minimalRecipe({
    ingredients: [
      { name: "ground beef", amount: 1, unit: "lb", category: "protein", notes: "" },
      { name: "onion", amount: 0.5, unit: "", category: "produce", notes: "chopped" },
      { name: "diced tomatoes", amount: 1, unit: "can", category: "pantry", notes: "no size given in source" },
    ],
    instructions: ["Simmer everything."],
  });

  const flags = plausibilityFlags(recipe);
  assertEquals(flags.some((f) => f.includes("compound unit")), false);
});
