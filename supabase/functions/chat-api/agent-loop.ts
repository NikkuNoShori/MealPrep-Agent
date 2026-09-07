/**
 * MOP-0008 — Single-agent tool-use loop.
 *
 * runAgentLoop drives the model through up to MAX_ITERS LLM calls. Each turn
 * the model may emit zero, one, or many tool_calls. We dispatch each call,
 * wrap the JSON output in `<tool_result>` markers (defense-in-depth against
 * prompt injection from tool outputs), and feed it back as a role:"tool"
 * message. Loop terminates when the model returns a plain content reply,
 * the iteration cap is hit, or a destructive tool short-circuits.
 */

import type {
  ChatMessage,
  ChatWithToolsResult,
  OpenRouterClient,
  ToolCall,
  ToolSpec,
} from "../_shared/openrouter-client.ts";
import { CHAT_AGENT_SYSTEM_PROMPT } from "../_shared/recipe-prompts.ts";
import { dispatchTool, type ToolContext, type ToolResult } from "./tools/dispatch.ts";
import { getToolSpecs } from "./tools/catalog.ts";

export const MAX_ITERS = 5;
/** Tool-use requires a model with function-calling on OpenRouter (2.5-7b has none). */
export const AGENT_MODEL =
  Deno.env.get("OPENROUTER_AGENT_MODEL")?.trim() || "qwen/qwen3-8b";

/**
 * Models that advertise `tools` + pass OpenRouter `require_parameters: true`.
 * Vision-only models (e.g. gemini-2.0-flash-001 in extract.ts) are NOT valid here.
 */
export const DEFAULT_AGENT_MODEL_FALLBACKS = [
  "qwen/qwen3-8b",
  "qwen/qwen3-14b",
  "openai/gpt-4o-mini",
] as const;

export function resolveAgentModels(): string[] {
  const primary = AGENT_MODEL;
  const fromEnv = Deno.env.get("OPENROUTER_AGENT_MODEL_FALLBACKS")
    // Accept comma-separated OR space-separated values (both are common in Supabase secrets UI)
    ?.split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const fallbacks = fromEnv ?? [...DEFAULT_AGENT_MODEL_FALLBACKS];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const model of [primary, ...fallbacks]) {
    if (!seen.has(model)) {
      seen.add(model);
      ordered.push(model);
    }
  }
  return ordered;
}

function isRetryableOpenRouterError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /\b429\b/.test(msg) ||
    /\b502\b/.test(msg) ||
    /\b503\b/.test(msg) ||
    /rate.?limit/i.test(msg) ||
    /No endpoints found/i.test(msg)
  );
}

async function chatWithToolsResilient(
  openRouter: OpenRouterClient,
  systemPrompt: string,
  messages: ChatMessage[],
  tools: ToolSpec[],
  options: {
    temperature?: number;
    max_tokens?: number;
    tool_choice?: "auto" | "none" | "required";
  }
): Promise<ChatWithToolsResult> {
  const models = resolveAgentModels();
  const errors: string[] = [];

  for (const model of models) {
    try {
      console.log(`Agent loop trying model: ${model}`);
      return await openRouter.chatWithTools(
        systemPrompt,
        messages,
        tools,
        model,
        options
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${msg.slice(0, 240)}`);
      if (!isRetryableOpenRouterError(err)) throw err;
      console.warn(
        `Agent model ${model} unavailable (${msg.slice(0, 120)}), trying next...`
      );
    }
  }

  throw new Error(`All agent models failed: ${errors.join(" | ")}`);
}

export interface PendingConfirmation {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  idempotencyKey: string;
}

export interface ToolCallTraceEntry {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface AgentReply {
  content: string;
  toolCalls: ToolCallTraceEntry[];
  pendingConfirmation?: PendingConfirmation;
  recipe?: any;
  recipes?: any[];
  iterations: number;
  hitMaxIters: boolean;
}

// ── Tool event types ──────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: "delta";      text: string }
  | { type: "tool_start"; name: string; label: string; index: number }
  | { type: "tool_done";  name: string; ok: boolean; durationMs: number; index: number };

/** Human-readable labels for every tool in the catalog. */
const TOOL_LABELS: Record<string, string> = {
  search_recipes:                  "Searching your recipes…",
  find_similar_recipes:            "Finding similar recipes…",
  extract_recipe_from_source:      "Fetching recipe from URL…",
  get_household_recipes:           "Checking household recipes…",
  get_household_profile:           "Loading household profile…",
  get_meal_plan:                   "Checking your meal plan…",
  assign_recipe_to_meal_plan_slot: "Scheduling meal…",
  add_to_grocery_list:             "Adding to grocery list…",
  get_grocery_list:                "Loading grocery list…",
  mark_grocery_item_purchased:     "Marking item purchased…",
  remove_grocery_item:             "Removing grocery item…",
  propose_substitution:            "Finding substitutions…",
  check_recipe_safety:             "Checking allergens and safety…",
  update_member_allergens:         "Updating allergen profile…",
  get_recommendations:             "Getting recommendations…",
  react_to_recipe:                 "Saving reaction…",
  scale_recipe:                    "Scaling recipe…",
  save_recipe:                     "Saving recipe to library…",
  update_recipe:                   "Preparing recipe update…",
  delete_recipe:                   "Preparing to delete recipe…",
  web_search_recipe:               "Searching the web…",
  extract_recipe_from_text:        "Extracting recipe…",
  create_meal_plan:                "Creating meal plan…",
  clear_meal_plan_slot:            "Clearing meal slot…",
};

export interface AgentLoopInput {
  message: string;
  images?: string[];
  conversationHistory: ChatMessage[];
  /** When provided, the final prose reply is streamed via this callback. */
  onDelta?: (text: string) => void;
  /** Extended event callback — receives delta, tool_start, and tool_done events. */
  onEvent?: (event: AgentEvent) => void;
}

/**
 * Builds the system prompt with today's date interpolated.
 */
function buildSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0];
  return CHAT_AGENT_SYSTEM_PROMPT.replace(/\{\{TODAY_ISO_DATE\}\}/g, today);
}

/**
 * Wrap a tool's JSON output in <tool_result> markers. This is defense-in-depth
 * against prompt injection where a tool result might contain text like
 * "ignore previous instructions" — by tagging the boundary, the model is
 * trained (via the system prompt hard rule #5) to treat the content as data.
 */
function wrapToolResult(result: ToolResult): string {
  return `<tool_result>${JSON.stringify(result)}</tool_result>`;
}

export async function runAgentLoop(
  input: AgentLoopInput,
  ctx: ToolContext,
  openRouter: OpenRouterClient
): Promise<AgentReply> {
  const systemPrompt = buildSystemPrompt();
  const tools = getToolSpecs();
  const onDelta = input.onDelta;

  // onEvent supersedes onDelta; if only onDelta provided, wrap it for delta events
  const emit: ((e: AgentEvent) => void) | null = input.onEvent
    ? input.onEvent
    : onDelta
    ? (e: AgentEvent) => { if (e.type === "delta") onDelta(e.text); }
    : null;

  // Build the user message content. When images are present, append the hint
  // so the model knows to call extract_recipe_from_source(source_type="images")
  // even when the user also typed a message.
  const imageHint =
    input.images && input.images.length > 0
      ? `\n[${input.images.length} image(s) attached — call extract_recipe_from_source with source_type="images" to read them]`
      : "";
  const userContent = (input.message || "") + imageHint ||
    "What can I help you with?";

  const messages: ChatMessage[] = [
    ...input.conversationHistory,
    { role: "user", content: userContent },
  ];

  const toolCallTrace: ToolCallTraceEntry[] = [];
  let iteration = 0;
  let lastRecipe: any = undefined;
  let lastRecipes: any[] | undefined = undefined;
  let hitMaxIters = false;
  let toolIndex = 0;

  // When images are attached, force the first LLM turn to call a tool.
  // This prevents small models from ignoring the image hint and replying in prose.
  const hasImages = (input.images?.length ?? 0) > 0;

  while (iteration < MAX_ITERS) {
    iteration++;
    const toolChoice = (iteration === 1 && hasImages) ? "required" : "auto";
    const llmResponse = await chatWithToolsResilient(
      openRouter,
      systemPrompt,
      messages,
      tools,
      { temperature: 0.2, tool_choice: toolChoice, max_tokens: 1024 }
    );

    // No tool calls → final reply.
    if (!llmResponse.tool_calls || llmResponse.tool_calls.length === 0) {
      // If streaming is requested and the model returned content without
      // tool calls on this non-final iteration, stream it directly.
      if (emit && llmResponse.content) {
        emit({ type: "delta", text: llmResponse.content });
      }
      return {
        content: llmResponse.content || "",
        toolCalls: toolCallTrace,
        recipe: lastRecipe,
        recipes: lastRecipes,
        iterations: iteration,
        hitMaxIters: false,
      };
    }

    // Push assistant message with tool calls (per OpenAI Chat Completions spec).
    messages.push({
      role: "assistant",
      content: llmResponse.content,
      tool_calls: llmResponse.tool_calls,
    });

    // Dispatch each tool call.
    for (const call of llmResponse.tool_calls as ToolCall[]) {
      const name = call.function.name;
      const idx = toolIndex++;
      const label = TOOL_LABELS[name] ?? `Running ${name}…`;

      if (emit) emit({ type: "tool_start", name, label, index: idx });

      const t0 = Date.now();
      const result = await dispatchTool(name, call.function.arguments, ctx);
      const dt = Date.now() - t0;

      if (emit) emit({ type: "tool_done", name, ok: result.ok, durationMs: dt, index: idx });

      // Trace entry.
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs =
          typeof call.function.arguments === "string"
            ? JSON.parse(call.function.arguments)
            : (call.function.arguments as Record<string, unknown>);
      } catch {
        parsedArgs = { _raw: call.function.arguments };
      }
      toolCallTrace.push({
        name,
        args: parsedArgs,
        ok: result.ok,
        durationMs: dt,
        error: result.ok ? undefined : (result as { error?: string }).error,
      });

      // Destructive short-circuit.
      if (
        result.ok &&
        "requiresConfirmation" in result &&
        result.requiresConfirmation
      ) {
        return {
          content:
            llmResponse.content ||
            `I need your confirmation before I can do that.`,
          toolCalls: toolCallTrace,
          pendingConfirmation: {
            tool: result.tool,
            args: result.args,
            summary: result.summary,
            idempotencyKey: result.idempotencyKey,
          },
          // Preserve any recipe extracted earlier in this same turn so the
          // card still renders when a destructive tool follows an extraction.
          recipe: lastRecipe || undefined,
          recipes: lastRecipes.length ? lastRecipes : undefined,
          iterations: iteration,
          hitMaxIters: false,
        };
      }

      // Capture recipe payload from extraction so the API response can carry it
      // through to the frontend recipe-card renderer.
      if (
        result.ok &&
        "data" in result &&
        result.data &&
        typeof result.data === "object"
      ) {
        const d = result.data as { recipe?: any; recipes?: any[] };
        if (d.recipe) lastRecipe = d.recipe;
        if (d.recipes) lastRecipes = d.recipes;
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: wrapToolResult(result),
      });
    }
  }

  // Hit MAX_ITERS without a final reply. Ask the model once more with
  // tool_choice:"none" to compose what it has.
  hitMaxIters = true;
  const fallback =
    "I was looking into that — here's what I found so far. Want me to keep going?";
  try {
    let closingContent: string | null;
    if (emit) {
      // Stream the closing reply — wrap emit to extract delta text for streamChatWithTools
      const deltaCallback = (text: string) => emit({ type: "delta", text });
      const closing = await openRouter.streamChatWithTools(
        systemPrompt,
        messages,
        tools,
        deltaCallback,
        undefined, // use default model
        { temperature: 0.2, tool_choice: "none", max_tokens: 600 }
      );
      closingContent = closing.content;
    } else {
      const closing = await chatWithToolsResilient(
        openRouter,
        systemPrompt,
        messages,
        tools,
        { temperature: 0.2, tool_choice: "none", max_tokens: 600 }
      );
      closingContent = closing.content;
    }
    return {
      content: closingContent || fallback,
      toolCalls: toolCallTrace,
      recipe: lastRecipe,
      recipes: lastRecipes,
      iterations: iteration,
      hitMaxIters,
    };
  } catch {
    return {
      content: fallback,
      toolCalls: toolCallTrace,
      recipe: lastRecipe,
      recipes: lastRecipes,
      iterations: iteration,
      hitMaxIters,
    };
  }
}
