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
  OpenRouterClient,
  ToolCall,
} from "../_shared/openrouter-client.ts";
import { CHAT_AGENT_SYSTEM_PROMPT } from "../_shared/recipe-prompts.ts";
import { dispatchTool, type ToolContext, type ToolResult } from "./tools/dispatch.ts";
import { getToolSpecs } from "./tools/catalog.ts";

export const MAX_ITERS = 5;
export const AGENT_MODEL = "qwen/qwen-2.5-7b-instruct";

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

export interface AgentLoopInput {
  message: string;
  images?: string[];
  conversationHistory: ChatMessage[];
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

  const messages: ChatMessage[] = [
    ...input.conversationHistory,
    {
      role: "user",
      content:
        input.message ||
        (input.images && input.images.length > 0
          ? `[${input.images.length} image(s) attached]`
          : ""),
    },
  ];

  const toolCallTrace: ToolCallTraceEntry[] = [];
  let iteration = 0;
  let lastRecipe: any = undefined;
  let lastRecipes: any[] | undefined = undefined;
  let hitMaxIters = false;

  while (iteration < MAX_ITERS) {
    iteration++;
    const llmResponse = await openRouter.chatWithTools(
      systemPrompt,
      messages,
      tools,
      AGENT_MODEL,
      { temperature: 0.2, tool_choice: "auto", max_tokens: 1024 }
    );

    // No tool calls → final reply.
    if (!llmResponse.tool_calls || llmResponse.tool_calls.length === 0) {
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
      const t0 = Date.now();
      const result = await dispatchTool(
        call.function.name,
        call.function.arguments,
        ctx
      );
      const dt = Date.now() - t0;

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
        name: call.function.name,
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
  try {
    const closing = await openRouter.chatWithTools(
      systemPrompt,
      messages,
      tools,
      AGENT_MODEL,
      { temperature: 0.2, tool_choice: "none", max_tokens: 600 }
    );
    return {
      content:
        closing.content ||
        "I was looking into that — here's what I found so far. Want me to keep going?",
      toolCalls: toolCallTrace,
      recipe: lastRecipe,
      recipes: lastRecipes,
      iterations: iteration,
      hitMaxIters,
    };
  } catch {
    return {
      content:
        "I was looking into that — here's what I found so far. Want me to keep going?",
      toolCalls: toolCallTrace,
      recipe: lastRecipe,
      recipes: lastRecipes,
      iterations: iteration,
      hitMaxIters,
    };
  }
}
