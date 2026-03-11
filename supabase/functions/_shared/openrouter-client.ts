/**
 * Shared OpenRouter client for Supabase Edge Functions (Deno runtime).
 * Extracted from chat-api/index.ts for reuse across pipeline and chat.
 */
export class OpenRouterClient {
  private defaultApiKey: string;
  private vlApiKey?: string;
  private instructApiKey?: string;
  private baseUrl = "https://openrouter.ai/api/v1";

  constructor(
    defaultApiKey: string,
    vlApiKey?: string,
    instructApiKey?: string
  ) {
    this.defaultApiKey = defaultApiKey;
    this.vlApiKey = vlApiKey;
    this.instructApiKey = instructApiKey;
  }

  private getApiKeyForModel(model: string): string {
    if (model.includes("vl") || model.includes("vision")) {
      return this.vlApiKey || this.defaultApiKey;
    }
    if (model.includes("instruct") || model.includes("qwen")) {
      return this.instructApiKey || this.defaultApiKey;
    }
    return this.defaultApiKey;
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    model = "qwen/qwen3-8b",
    options?: {
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
    }
  ): Promise<string> {
    const apiKey = this.getApiKeyForModel(model);
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

    const apiKey = this.getApiKeyForModel(model);
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

    const apiKey = this.getApiKeyForModel(model);
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

  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = this.defaultApiKey;
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
  const defaultKey =
    Deno.env.get("OPENROUTER_API_KEY") ||
    Deno.env.get("OPENROUTER_API_KEY_QWEN2.5_instruct_8b") ||
    Deno.env.get("OPENROUTER_API_KEY_QWEN2.5_VL_8b");

  if (!defaultKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  return new OpenRouterClient(
    defaultKey,
    Deno.env.get("OPENROUTER_API_KEY_QWEN2.5_VL_8b"),
    Deno.env.get("OPENROUTER_API_KEY_QWEN2.5_instruct_8b")
  );
}
