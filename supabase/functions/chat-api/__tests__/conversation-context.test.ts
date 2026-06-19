import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  enrichMessageContent,
  formatRecipeForAgentContext,
} from "./conversation-context.ts";

Deno.test("formatRecipeForAgentContext includes ingredients and steps", () => {
  const text = formatRecipeForAgentContext({
    title: "Test Bowl",
    servings: 2,
    ingredients: [
      { name: "rice", amount: 1, unit: "cup" },
      { name: "salt", amount: 0, unit: "to taste" },
    ],
    instructions: ["Cook rice", "Season"],
  });
  assertEquals(text.includes("Title: Test Bowl"), true);
  assertEquals(text.includes("1 cup rice"), true);
  assertEquals(text.includes("1. Cook rice"), true);
});

Deno.test("enrichMessageContent appends recipe block for ai messages", () => {
  const enriched = enrichMessageContent({
    sender: "ai",
    content: "Here is your recipe preview.",
    metadata: {
      recipe: {
        title: "Pasta",
        servings: 4,
        ingredients: [{ name: "pasta", amount: 8, unit: "oz" }],
        instructions: ["Boil water"],
      },
    },
  });
  assertEquals(enriched.includes("<extracted_recipe>"), true);
  assertEquals(enriched.includes("8 oz pasta"), true);
});

Deno.test("enrichMessageContent leaves user messages unchanged", () => {
  assertEquals(
    enrichMessageContent({ sender: "user", content: "how much salt?" }),
    "how much salt?"
  );
});
