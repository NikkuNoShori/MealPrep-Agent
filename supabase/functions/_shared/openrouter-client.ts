/**
 * Shared OpenRouter client for Supabase Edge Functions (Deno runtime).
 * Extracted from chat-api/index.ts for reuse across pipeline and chat.
 */

import { resolveOpenRouterKeys } from "./openrouter-keys.ts";

// ─────────────────────────────────────────────────────────────────────
// Types for tool-using chat (OpenAI-compatible tool format)
// ─────────────────────────────────────────────────────────────────────

export type ChatMessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string per OpenAI spec
  };
}

export interface ChatMessage {
  role: ChatMessageRole;
  content: string | null;
  // assistant-only:
  tool_calls?: ToolCall[];
  // tool-only:
  tool_call_id?: string;
  name?: string;
}

export interface ToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

export interface ChatWithToolsResult {
  content: string | null;
  tool_calls: ToolCall[];
  finish_reason: string | null;
}

export class OpenRouterClient {
  private mediaApiKey: string;
  private chatApiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";

  constructor(mediaApiKey: string, chatApiKey?: string) {
    this.mediaApiKey = mediaApiKey;
    this.chatApiKey = chatApiKey ?? mediaApiKey;
  }

  private resolveBillingKey(billing: "chat" | "media"): string {
    return billing === "chat" ? this.chatApiKey : this.mediaApiKey;
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    model = "qwen/qwen3-8b",
    options?: {
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
      /** Default `media` (pipeline). Use `chat` for conversational chat-api calls. */
      billing?: "chat" | "media";
    }
  ): Promise<string> {
    const apiKey = this.resolveBillingKey(options?.billing ?? "media");
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
        "X-Title": "MealPrep Agent",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 500,
        response_format: options?.response_format,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouter error:", response.status, error);
      throw new Error(`OpenRouter API failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message) {
      const bodyStr = JSON.stringify(data).substring(0, 500);
      console.error("Unexpected OpenRouter response:", bodyStr);
      const errorDetail = data.error?.message ? `error: ${data.error.message}` : `body: ${bodyStr.substring(0, 200)}`;
      throw new Error(`OpenRouter returned no choices (${errorDetail})`);
    }
    return data.choices[0].message.content;
  }

  async chatWithHistory(
    systemPrompt: string,
    conversationHistory: any[],
    userMessage: string,
    model = "qwen/qwen3-8b",
    options?: { temperature?: number; max_tokens?: number }
  ): Promise<string> {
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    const apiKey = this.mediaApiKey;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
        "X-Title": "MealPrep Agent",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouter chatWithHistory error:", response.status, error);
      throw new Error(`OpenRouter API failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message) {
      console.error("Invalid OpenRouter response:", data);
      throw new Error("Invalid response from OpenRouter API");
    }
    return data.choices[0].message.content;
  }

  async chatWithImages(
    systemPrompt: string,
    userMessage: string,
    images: string[],
    model = "qwen/qwen-2.5-vl-7b-instruct",
    options?: {
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
    }
  ): Promise<string> {
    const userContent = [
      { type: "text", text: userMessage },
      ...images.slice(0, 4).map((img) => ({
        type: "image_url",
        image_url: { url: img },
      })),
    ];

    const apiKey = this.mediaApiKey;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
        "X-Title": "MealPrep Agent",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.max_tokens ?? 2000,
        response_format: options?.response_format,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenRouter chatWithImages error:", response.status, error);
      throw new Error(`OpenRouter API failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message) {
      const bodyStr = JSON.stringify(data).substring(0, 500);
      console.error("Unexpected OpenRouter response (images):", bodyStr);
      const errorDetail = data.error?.message ? `error: ${data.error.message}` : `body: ${bodyStr.substring(0, 200)}`;
      throw new Error(`OpenRouter returned no choices (${errorDetail})`);
    }
    return data.choices[0].message.content;
  }

  /**
   * Tool-using chat completion (OpenAI-compatible tools/tool_choice).
   * The model may return either a plain text response or a list of tool calls
   * the runtime must execute and feed back as `role:"tool"` messages.
   */
  async chatWithTools(
    systemPrompt: string,
    messages: ChatMessage[],
    tools: ToolSpec[],
    model = "qwen/qwen3-8b",
    options?: {
      temperature?: number;
      max_tokens?: number;
      tool_choice?: "auto" | "none" | "required";
    }
  ): Promise<ChatWithToolsResult> {
    const apiKey = this.chatApiKey;

    const fullMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const body: Record<string, unknown> = {
      model,
      messages: fullMessages,
      tools,
      tool_choice: options?.tool_choice ?? "auto",
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.max_tokens ?? 1024,
      // Only route to providers that advertise tool/function-calling support.
      provider: { require_parameters: true },
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
        "X-Title": "MealPrep Agent",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter chatWithTools error:", response.status, errorText);
      throw new Error(`OpenRouter API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice?.message) {
      const bodyStr = JSON.stringify(data).substring(0, 500);
      const errorDetail = data.error?.message
        ? `error: ${data.error.message}`
        : `body: ${bodyStr.substring(0, 200)}`;
      throw new Error(`OpenRouter returned no choices (${errorDetail})`);
    }

    return {
      content: choice.message.content ?? null,
      tool_calls: choice.message.tool_calls ?? [],
      finish_reason: choice.finish_reason ?? null,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = this.mediaApiKey;
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
        "X-Title": "MealPrep Agent",
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Embedding error:", response.status, error);
      throw new Error(`Embedding API failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}

/** Create an OpenRouterClient from environment variables. */
export function createOpenRouterClient(): OpenRouterClient {
  const { chat, media } = resolveOpenRouterKeys();
  return new OpenRouterClient(media, chat);
}
