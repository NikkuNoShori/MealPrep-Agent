/**
 * MOP-0008 — Deno tests for the chat agent loop.
 *
 * Run: deno test --allow-env --allow-net supabase/functions/chat-api/__tests__/agent-loop.test.ts
 *
 * These tests stub `openRouter.chatWithTools` to return scripted tool_calls
 * (no real network) and assert behavior of:
 *   - tool dispatch happens for non-destructive tools
 *   - destructive tools short-circuit BEFORE any handler runs
 *   - the MAX_ITERS cap is enforced
 *   - any `user_id` key in tool args is rejected by the dispatcher
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runAgentLoop, MAX_ITERS } from "../agent-loop.ts";
import { dispatchTool } from "../tools/dispatch.ts";
import type { ToolContext } from "../tools/dispatch.ts";
import type {
  ChatMessage,
  ChatWithToolsResult,
  ToolCall,
  ToolSpec,
  OpenRouterClient,
} from "../../_shared/openrouter-client.ts";

// ─── Fake OpenRouter ────────────────────────────────────────────────

type ChatWithToolsCall = (
  systemPrompt: string,
  messages: ChatMessage[],
  tools: ToolSpec[]
) => ChatWithToolsResult;

function makeFakeOpenRouter(
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
    // Stubs used by handlers — never hit in these tests because we keep
    // them away from real handler execution.
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

// ─── Fake Supabase (minimal — only what the handlers we exercise touch) ─

function makeFakeSupabase(): any {
  return {
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
    rpc(_name: string, _args: any) {
      return Promise.resolve({ data: [], error: null });
    },
  };
}

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    user: { id: "user-123", email: "u@example.com" },
    supabase: (overrides?.supabase as any) || makeFakeSupabase(),
    openRouter: (overrides?.openRouter as any) || makeFakeOpenRouter([
      () => ({ content: "", tool_calls: [], finish_reason: "stop" }),
    ]).client,
    userToken: "fake-token",
    attachedImages: overrides?.attachedImages,
  };
}

function makeToolCall(
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

// ─── Tests ──────────────────────────────────────────────────────────

Deno.test("agent loop: returns immediately when model emits no tool calls", async () => {
  const { client } = makeFakeOpenRouter([
    () => ({
      content: "Hello there!",
      tool_calls: [],
      finish_reason: "stop",
    }),
  ]);
  const ctx = makeCtx({ openRouter: client });

  const reply = await runAgentLoop(
    { message: "hi", conversationHistory: [] },
    ctx,
    client
  );

  assertEquals(reply.content, "Hello there!");
  assertEquals(reply.toolCalls.length, 0);
  assertEquals(reply.iterations, 1);
  assertEquals(reply.hitMaxIters, false);
  assertEquals(reply.pendingConfirmation, undefined);
});

Deno.test("agent loop: destructive tool short-circuits with pendingConfirmation", async () => {
  const { client } = makeFakeOpenRouter([
    () => ({
      content: null,
      tool_calls: [
        makeToolCall("delete_recipe", {
          recipe_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        }),
      ],
      finish_reason: "tool_calls",
    }),
  ]);
  const ctx = makeCtx({ openRouter: client });

  const reply = await runAgentLoop(
    { message: "delete the carbonara", conversationHistory: [] },
    ctx,
    client
  );

  assert(reply.pendingConfirmation, "expected pendingConfirmation");
  assertEquals(reply.pendingConfirmation?.tool, "delete_recipe");
  assert(reply.pendingConfirmation?.idempotencyKey);
  assertEquals(reply.toolCalls.length, 1);
  assertEquals(reply.toolCalls[0].name, "delete_recipe");
  // The model is NOT consulted a second time — only one LLM call.
});

Deno.test("agent loop: enforces MAX_ITERS cap and falls back to closing call", async () => {
  // Every step emits a (non-destructive, never-resolving) tool call.
  const looping = (): ChatWithToolsResult => ({
    content: null,
    tool_calls: [
      makeToolCall("get_household_recipes", {}, `call_${Math.random()}`),
    ],
    finish_reason: "tool_calls",
  });
  // After MAX_ITERS, the agent loop tries ONE more closing call with
  // tool_choice:"none" — script the closing call as well.
  const script = [
    ...new Array(MAX_ITERS).fill(0).map(() => looping),
    () => ({
      content: "Here's what I found so far.",
      tool_calls: [],
      finish_reason: "stop",
    }),
  ];
  const { client } = makeFakeOpenRouter(script);
  const ctx = makeCtx({ openRouter: client });

  const reply = await runAgentLoop(
    { message: "keep going", conversationHistory: [] },
    ctx,
    client
  );

  assertEquals(reply.iterations, MAX_ITERS);
  assertEquals(reply.hitMaxIters, true);
  assert(
    reply.content.length > 0,
    "expected a closing message when MAX_ITERS hit"
  );
});

Deno.test("dispatcher: rejects tool args that contain user_id", async () => {
  const ctx = makeCtx();
  const result = await dispatchTool(
    "search_recipes",
    JSON.stringify({ query: "pasta", user_id: "smuggled" }),
    ctx
  );
  assertEquals(result.ok, false);
  if (result.ok === false) {
    assert(
      result.error.toLowerCase().includes("user_id"),
      `expected user_id rejection, got: ${result.error}`
    );
  }
});

Deno.test("dispatcher: rejects unknown tool name", async () => {
  const ctx = makeCtx();
  const result = await dispatchTool("not_a_real_tool", {}, ctx);
  assertEquals(result.ok, false);
  if (result.ok === false) {
    assert(result.error.toLowerCase().includes("unknown tool"));
  }
});

Deno.test("dispatcher: destructive tools short-circuit before handler runs", async () => {
  // If the dispatcher were to call the handler, our fake supabase would
  // return null (no recipe found) and we'd get an error. Instead we should
  // see a confirmation envelope.
  const ctx = makeCtx();
  const result = await dispatchTool(
    "update_recipe",
    JSON.stringify({
      recipe_id: "11111111-1111-1111-1111-111111111111",
      changes: { title: "New title" },
    }),
    ctx
  );
  assertEquals(result.ok, true);
  if (result.ok === true && "requiresConfirmation" in result) {
    assertEquals(result.requiresConfirmation, true);
    assertEquals(result.tool, "update_recipe");
    assert(result.idempotencyKey.length > 0);
  } else {
    throw new Error("expected confirmation envelope");
  }
});

Deno.test("dispatcher: rejects invalid args per JSON Schema", async () => {
  const ctx = makeCtx();
  const result = await dispatchTool(
    "search_recipes",
    JSON.stringify({ query: "" }), // minLength 1 violated
    ctx
  );
  assertEquals(result.ok, false);
  if (result.ok === false) {
    assert(result.retryable, "schema errors should be retryable");
  }
});

// ─── Addendum 1 — web_search_recipe ─────────────────────────────────

Deno.test(
  "agent loop: dispatches web_search_recipe and feeds results back to the model",
  async () => {
    // Provide a WEB_SEARCH_API_KEY so the catalog exposes the tool. Stub
    // fetch so we never touch the network.
    const prevKey = Deno.env.get("WEB_SEARCH_API_KEY");
    const prevProvider = Deno.env.get("WEB_SEARCH_PROVIDER");
    Deno.env.set("WEB_SEARCH_API_KEY", "test-key");
    Deno.env.set("WEB_SEARCH_PROVIDER", "tavily");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_url: any, _init?: any) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              {
                title: "Classic Deviled Eggs",
                url: "https://seriouseats.com/devilled-eggs",
                content: "The best deviled eggs recipe.",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )) as typeof fetch;

    try {
      const dispatchCalls: { name: string; args: string }[] = [];
      const { client } = makeFakeOpenRouter([
        // Iter 1: model asks to web_search_recipe.
        (_sys, _msgs, tools) => {
          // Sanity: web_search_recipe should be in the tool list now.
          const names = tools.map((t) => t.function.name);
          assert(
            names.includes("web_search_recipe"),
            "web_search_recipe should be exposed when WEB_SEARCH_API_KEY is set"
          );
          dispatchCalls.push({ name: "iter1", args: "" });
          return {
            content: null,
            tool_calls: [
              makeToolCall("web_search_recipe", { query: "deviled eggs" }),
            ],
            finish_reason: "tool_calls",
          };
        },
        // Iter 2: model now composes a textual reply from the tool result.
        (_sys, msgs) => {
          // The previous tool result should be in the messages and wrapped
          // in <tool_result> markers.
          const toolMsg = msgs.find((m) => m.role === "tool");
          assert(toolMsg, "expected role:tool message after dispatch");
          assert(
            String(toolMsg?.content ?? "").includes("<tool_result>"),
            "tool message content should be wrapped in <tool_result>"
          );
          assert(
            String(toolMsg?.content ?? "").includes("seriouseats.com"),
            "tool message should contain the provider-domain candidate"
          );
          dispatchCalls.push({ name: "iter2", args: "" });
          return {
            content: "Found one from seriouseats.com.",
            tool_calls: [],
            finish_reason: "stop",
          };
        },
      ]);

      const ctx = makeCtx({ openRouter: client });
      const reply = await runAgentLoop(
        { message: "find me a deviled eggs recipe online", conversationHistory: [] },
        ctx,
        client
      );

      assertEquals(reply.content, "Found one from seriouseats.com.");
      assertEquals(reply.toolCalls.length, 1);
      assertEquals(reply.toolCalls[0].name, "web_search_recipe");
      assertEquals(reply.toolCalls[0].ok, true);
      assertEquals(reply.iterations, 2);
      assertEquals(reply.hitMaxIters, false);
      assertEquals(dispatchCalls.length, 2);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevKey === undefined) Deno.env.delete("WEB_SEARCH_API_KEY");
      else Deno.env.set("WEB_SEARCH_API_KEY", prevKey);
      if (prevProvider === undefined) Deno.env.delete("WEB_SEARCH_PROVIDER");
      else Deno.env.set("WEB_SEARCH_PROVIDER", prevProvider);
    }
  }
);

Deno.test(
  "catalog: omits web_search_recipe when WEB_SEARCH_API_KEY is unset",
  async () => {
    const prevKey = Deno.env.get("WEB_SEARCH_API_KEY");
    Deno.env.delete("WEB_SEARCH_API_KEY");
    try {
      // Late import to ensure capability gate re-evaluates with current env.
      const { getToolSpecs } = await import("../tools/catalog.ts");
      const names = getToolSpecs().map((t) => t.function.name);
      assert(
        !names.includes("web_search_recipe"),
        "web_search_recipe must be hidden when WEB_SEARCH_API_KEY is unset"
      );
    } finally {
      if (prevKey !== undefined) Deno.env.set("WEB_SEARCH_API_KEY", prevKey);
    }
  }
);

Deno.test(
  "web_search_recipe handler: maps NO_RESULTS to a non-retryable ok:false",
  async () => {
    const prevKey = Deno.env.get("WEB_SEARCH_API_KEY");
    Deno.env.set("WEB_SEARCH_API_KEY", "test-key");
    Deno.env.set("WEB_SEARCH_PROVIDER", "tavily");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_url: any, _init?: any) =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )) as typeof fetch;

    try {
      const ctx = makeCtx();
      const result = await dispatchTool(
        "web_search_recipe",
        JSON.stringify({ query: "nonexistent recipe xyz123" }),
        ctx
      );
      assertEquals(result.ok, false);
      if (result.ok === false) {
        assertEquals(result.error, "NO_RESULTS");
        assertEquals(result.retryable, false);
      }
    } finally {
      globalThis.fetch = originalFetch;
      if (prevKey === undefined) Deno.env.delete("WEB_SEARCH_API_KEY");
      else Deno.env.set("WEB_SEARCH_API_KEY", prevKey);
    }
  }
);

// ─── Regression: dispatch.ts must not double-wrap handler envelopes ───
//
// Before the fix, dispatchTool returned { ok: true, data: { ok: true, data: payload } }
// for every successful tool. agent-loop.ts read result.data.recipe which landed on the
// outer { ok, data } object — always undefined — so StructuredRecipeDisplay never
// mounted and recipes were never saved from chat.
//
// This test catches the double-wrap by asserting that result.data does NOT itself
// carry an `ok` key (which would only be present if the handler envelope leaked through).

Deno.test(
  "dispatcher: result.data is the payload, not a double-wrapped handler envelope",
  async () => {
    // search_recipes is a non-destructive tool whose handler calls supabase.rpc().
    // The fake supabase returns { data: [], error: null } so the handler succeeds
    // with an ok:true envelope. After the fix, dispatch must unwrap it.
    const ctx = makeCtx();
    const result = await dispatchTool(
      "search_recipes",
      JSON.stringify({ query: "pasta" }),
      ctx
    );

    assertEquals(result.ok, true, "dispatch should succeed");
    if (result.ok === true && "data" in result) {
      // If double-wrapping were present, result.data would be { ok: true, data: [...] }.
      // After the fix, result.data is the actual payload object — it must NOT have an
      // `ok` property at its top level.
      assert(
        result.data !== null && typeof result.data === "object",
        "result.data should be an object"
      );
      assert(
        !("ok" in (result.data as Record<string, unknown>)),
        "result.data must not contain an 'ok' key — that would indicate double-wrapping"
      );
    } else {
      throw new Error("expected ok:true result with data field");
    }
  }
);
