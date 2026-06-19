/**
 * Shared Deno test helpers for chat-api agent tests.
 */

import type {
  ChatMessage,
  ChatWithToolsResult,
  OpenRouterClient,
  ToolCall,
  ToolSpec,
} from "../../_shared/openrouter-client.ts";
import type { ToolContext } from "../tools/dispatch.ts";

export type ChatWithToolsCall = (
  systemPrompt: string,
  messages: ChatMessage[],
  tools: ToolSpec[]
) => ChatWithToolsResult;

export function makeFakeOpenRouter(
  script: ChatWithToolsCall[]
): { client: OpenRouterClient; calls: number } {
  let i = 0;
  const calls = { n: 0 };
  const client = {
    chatWithTools(
      systemPrompt: string,
      messages: ChatMessage[],
      tools: ToolSpec[]
    ): Promise<ChatWithToolsResult> {
      calls.n++;
      const step = script[Math.min(i, script.length - 1)];
      i++;
      return Promise.resolve(step(systemPrompt, messages, tools));
    },
    chat: () => Promise.resolve("{}"),
    chatWithHistory: () => Promise.resolve(""),
    chatWithImages: () => Promise.resolve(""),
    generateEmbedding: () => Promise.resolve(new Array(1536).fill(0)),
  } as unknown as OpenRouterClient;
  return {
    client,
    get calls() {
      return calls.n;
    },
  } as { client: OpenRouterClient; calls: number };
}

export function makeFakeSupabase(): Record<string, unknown> {
  const chain = {
    from() {
      return this;
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    gte() {
      return this;
    },
    lte() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    },
    single() {
      return Promise.resolve({ data: null, error: null });
    },
    insert() {
      return this;
    },
    update() {
      return this;
    },
    delete() {
      return this;
    },
    rpc(_name: string, _args: unknown) {
      return Promise.resolve({ data: [], error: null });
    },
  };
  return chain;
}

/** Meal plan with an occupied dinner slot — for conditionally-destructive assign tests. */
export function makeOccupiedSlotSupabase(): ToolContext["supabase"] {
  const recipeId = "11111111-1111-1111-1111-111111111111";
  const occupiedRecipeId = "99999999-9999-9999-9999-999999999999";
  const planId = "22222222-2222-2222-2222-222222222222";
  const date = "2026-06-18";
  let currentTable = "";

  const chain = {
    from(table: string) {
      currentTable = table;
      return this;
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    gte() {
      return this;
    },
    lte() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    maybeSingle() {
      if (currentTable === "meal_plans") {
        return Promise.resolve({
          data: {
            id: planId,
            meals: { [date]: { dinner: occupiedRecipeId } },
          },
          error: null,
        });
      }
      if (currentTable === "recipes") {
        return Promise.resolve({
          data: { id: recipeId, title: "Chicken Parm" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    single() {
      return Promise.resolve({ data: null, error: null });
    },
    insert() {
      return this;
    },
    update() {
      return this;
    },
    delete() {
      return this;
    },
    rpc(_name: string, _args: unknown) {
      return Promise.resolve({ data: [], error: null });
    },
  };
  return chain as unknown as ToolContext["supabase"];
}

export function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    user: { id: "user-123", email: "u@example.com" },
    supabase: (overrides?.supabase as ToolContext["supabase"]) ||
      (makeFakeSupabase() as unknown as ToolContext["supabase"]),
    openRouter: (overrides?.openRouter as OpenRouterClient) ||
      makeFakeOpenRouter([
        () => ({ content: "", tool_calls: [], finish_reason: "stop" }),
      ]).client,
    userToken: "fake-token",
    attachedImages: overrides?.attachedImages,
    attachedVideoMediaUrl: overrides?.attachedVideoMediaUrl,
    attachedVideoFrameUrls: overrides?.attachedVideoFrameUrls,
  };
}

export function makeToolCall(
  name: string,
  args: Record<string, unknown>,
  id = "call_1"
): ToolCall {
  return {
    id,
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}

/** Minimal valid args per tool for scripted routing tests. */
export function defaultArgsForTool(name: string): Record<string, unknown> {
  switch (name) {
    case "search_recipes":
      return { query: "chicken" };
    case "get_household_recipes":
      return {};
    case "get_household_profile":
      return {};
    case "get_meal_plan":
      return {};
    case "find_similar_recipes":
      return { recipe_id: "11111111-1111-1111-1111-111111111111" };
    case "assign_recipe_to_meal_plan_slot":
      return {
        meal_plan_id: "22222222-2222-2222-2222-222222222222",
        date: "2026-06-18",
        slot: "dinner",
        recipe_id: "11111111-1111-1111-1111-111111111111",
      };
    case "add_to_grocery_list":
      return { item_name: "olive oil" };
    case "propose_substitution":
      return {
        recipe_id: "11111111-1111-1111-1111-111111111111",
        ingredient: "beans",
        reason: "allergy",
      };
    case "extract_recipe_from_source":
      return { source_type: "url", url: "https://example.com/recipe" };
    case "delete_recipe":
      return { recipe_id: "11111111-1111-1111-1111-111111111111" };
    case "update_recipe":
      return {
        recipe_id: "11111111-1111-1111-1111-111111111111",
        changes: { title: "Updated" },
      };
    default:
      return {};
  }
}

export function scriptFromToolSequence(sequence: string[]): ChatWithToolsCall[] {
  const steps: ChatWithToolsCall[] = sequence.map((tool, i) => () => ({
    content: null,
    tool_calls: [
      makeToolCall(tool, defaultArgsForTool(tool), `call_${i}`),
    ],
    finish_reason: "tool_calls",
  }));
  steps.push(() => ({
    content: "Done.",
    tool_calls: [],
    finish_reason: "stop",
  }));
  return steps;
}
