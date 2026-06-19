/**
 * Helpers for injecting structured recipe context into agent conversation history.
 */

export function formatRecipeForAgentContext(recipe: Record<string, unknown>): string {
  const title = String(recipe.title ?? "Untitled");
  const servings = recipe.servings ?? recipe.servings_count ?? "?";
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .map((ing: Record<string, unknown>) => {
          const amount = ing.amount ?? "";
          const unit = ing.unit ?? "";
          const name = ing.name ?? ing.ingredient ?? "";
          const qty = [amount, unit].filter(Boolean).join(" ");
          return `- ${qty ? `${qty} ` : ""}${name}`.trim();
        })
        .join("\n")
    : "";
  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions
        .map((step: unknown, i: number) => `${i + 1}. ${String(step)}`)
        .join("\n")
    : "";

  return [
    `Title: ${title}`,
    `Servings: ${servings}`,
    ingredients ? `\nIngredients:\n${ingredients}` : "",
    instructions ? `\nInstructions:\n${instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Append extracted recipe JSON to assistant text so follow-ups can reference quantities. */
export function enrichMessageContent(msg: {
  content?: string | null;
  sender?: string;
  metadata?: Record<string, unknown> | null;
}): string {
  const base = msg.content?.trim() || "";
  if (msg.sender !== "ai" && msg.sender !== "assistant") return base;

  const recipe = msg.metadata?.recipe as Record<string, unknown> | undefined;
  if (!recipe?.title) return base;

  const block = formatRecipeForAgentContext(recipe);
  return `${base}\n\n<extracted_recipe>\n${block}\n</extracted_recipe>`;
}
