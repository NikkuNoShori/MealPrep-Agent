import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from './supabase';
import { useAuthStore } from '@/stores/authStore';
import { Logger } from './logger';
import { snakeToCamel, camelToSnake } from '@/utils/case';
import { QUERY_STALE_TIME } from '@/config/queryCache';

// Supabase configuration - reuse from supabase.ts
// `import.meta.env` is typed in src/vite-env.d.ts — no cast needed.
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

// Supabase Edge Functions base URL
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// ─────────────────────────────────────────────────────────────────────
// MOP-0008 — Chat agent contract types
// ─────────────────────────────────────────────────────────────────────

/**
 * Surfaced by `apiClient.sendMessage` when the agent emitted a destructive
 * tool call (delete_recipe, update_recipe, overwrite of an occupied meal-plan
 * slot, etc.). The UI renders a Confirm/Cancel prompt and on confirm sends a
 * follow-up message with `context.confirmAction` set to the same payload.
 */
export interface PendingConfirmation {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  idempotencyKey: string;
}

/**
 * Payload the UI sends in `context.confirmAction` to short-circuit the agent
 * loop and execute the previously-validated tool.
 */
export interface ConfirmActionInput {
  tool: string;
  args: Record<string, unknown>;
  idempotencyKey?: string;
}

// ─────────────────────────────────────────────────────────────────────
// MOP-0017 — SSE streaming types
// ─────────────────────────────────────────────────────────────────────

export type SSEEvent =
  | { type: "delta"; text: string }
  | { type: "tool_start"; name: string; label: string; index: number }
  | { type: "tool_done";  name: string; ok: boolean; durationMs: number; index: number }
  | { type: "recipe"; recipe: any }
  | { type: "recipes"; recipes: any[] }
  | { type: "confirmation"; pendingConfirmation: any }
  | { type: "done"; messageId?: string; conversationId: string; sessionId: string; intentMetadata?: any; title?: string }
  | { type: "error"; message: string };

/**
 * Callback-based streaming interface. `onEvent` fires for every SSE frame;
 * the returned `Promise<void>` resolves when the stream closes or rejects on
 * network error. Callers can abort via the `signal` on the input.
 */
export type StreamCallbacks = {
  onEvent: (event: SSEEvent) => void;
  onError?: (err: Error) => void;
};

// ─────────────────────────────────────────────────────────────────────
// MOP-0019 — Batch import types
// ─────────────────────────────────────────────────────────────────────

export type BatchSSEEvent =
  | { type: "progress"; index: number; total: number; url: string; status: "extracting" }
  | { type: "result";   index: number; url: string; recipe: any }
  | { type: "error";    index: number; url: string; message: string }
  | { type: "done";     total: number; succeeded: number; failed: number };

export type BatchImportCallbacks = {
  onEvent: (event: BatchSSEEvent) => void;
};

/** Parse a raw textarea value into a deduplicated, validated URL list. */
export function parseImportUrls(raw: string): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const chunk of raw.split(/[\s,]+/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    try {
      const u = new URL(trimmed);
      if (u.protocol === "http:" || u.protocol === "https:") {
        valid.push(trimmed);
      }
    } catch { /* skip invalid */ }
  }
  return valid;
}

export interface ChatToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  durationMs?: number;
  error?: string;
  confirmed?: boolean;
}

export interface ChatMessageResponse {
  message: string;
  response: {
    id: string;
    content: string;
    sender: "ai";
    timestamp: string;
  };
  recipe?: any;
  recipes?: any[];
  pendingConfirmation?: PendingConfirmation;
  conversationId: string;
  sessionId: string;
  intentMetadata?: {
    source?: string;
    manualIntent?: string | null;
    toolCalls?: ChatToolCallTrace[];
    iterations?: number;
    hitMaxIters?: boolean;
    confirmAction?: boolean;
  };
  title?: string;
}

export interface SendMessageInput {
  message: string;
  context?: {
    sessionId?: string;
    conversationId?: string;
    metadata?: Record<string, unknown>;
    confirmAction?: ConfirmActionInput;
    [k: string]: unknown;
  };
  sessionId?: string;
  clearMemory?: boolean;
  intent?: string;
  images?: string[];
  /** Optional abort signal (stripped before JSON body). */
  signal?: AbortSignal;
}


// API client
class ApiClient {
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...(options.headers as Record<string, string>),
    };

    // Add authorization header if we have a user token
    const token = await this.getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Network error" }));
      // Pipeline errors return { errors: [{ message, stage, code }], stage_failed }
      const pipelineMsg = Array.isArray(error.errors) && error.errors[0]?.message;
      throw new Error(pipelineMsg || error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private async getAuthToken(): Promise<string | null> {
    // Get auth token from Supabase session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  // Recipe endpoints - using Supabase client directly
  // Note: user_id references profiles(id), which references auth.users(id)
  async getRecipes(params?: { limit?: number; offset?: number }) {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Transform snake_case to camelCase
    const camelRecipes = (data || []).map(snakeToCamel);
    return { recipes: camelRecipes, total: camelRecipes.length };
  }

  /** Lightweight recipe list for the randomizer — id, title, tags, visibility only.
   *  Includes own recipes + household-visible recipes so the pool matches what
   *  the user sees in their recipe library. RLS enforces actual access. */
  async getRecipesLight() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    const { data, error } = await supabase
      .from("recipes")
      .select("id, title, tags, visibility")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as Array<{ id: string; title: string; tags: string[] | null; visibility: string }>;
  }

  async getRecipe(idOrSlug: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Determine if the input is a UUID or a slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    // No user_id filter — RLS handles visibility (public/household/owned).
    // Filtering by the viewer's user_id breaks shared recipe links from other users.
    let query = supabase.from("recipes").select("*");

    if (isUuid) {
      query = query.eq("id", idOrSlug);
    } else {
      query = query.eq("slug", idOrSlug);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Transform snake_case to camelCase
    return snakeToCamel(data);
  }

  async checkDuplicateRecipe(
    title: string,
    excludeId?: string
  ): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Normalize title to match database constraint (trim and lowercase)
    const normalizedTitle = title.trim().toLowerCase();

    let query = supabase
      .from("recipes")
      .select("id")
      .eq("user_id", user.id)
      .ilike("title", normalizedTitle);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    return !!data; // Returns true if duplicate exists
  }

  async createRecipe(data: any, options?: { skipDuplicateCheck?: boolean }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Check for duplicate recipe name (skip if caller already checked)
    if (!options?.skipDuplicateCheck) {
      const isDuplicate = await this.checkDuplicateRecipe(data.title);
      if (isDuplicate) {
        throw new Error(
          `A recipe with the name "${data.title}" already exists. Please choose a different name.`
        );
      }
    }

    // Transform camelCase to snake_case for database
    const dbData = camelToSnake(data);
    dbData.user_id = user.id;

    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert(dbData)
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation with a user-friendly message
      if (error.code === "23505" || error.message?.includes("unique")) {
        throw new Error(
          `A recipe with the name "${data.title}" already exists. Please choose a different name.`
        );
      }
      throw error;
    }

    // Transform snake_case response to camelCase
    return snakeToCamel(recipe);
  }

  async updateRecipe(id: string, data: any) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Check for duplicate recipe name (excluding the current recipe)
    if (data.title) {
      const isDuplicate = await this.checkDuplicateRecipe(data.title, id);
      if (isDuplicate) {
        throw new Error(
          `A recipe with the name "${data.title}" already exists. Please choose a different name.`
        );
      }
    }

    // Transform camelCase to snake_case for database
    const dbData = camelToSnake(data);

    const { data: recipe, error } = await supabase.from("recipes")
      .update(dbData)
      .eq("id", id)
      .eq("user_id", user.id) // user_id references profiles(id) = auth.users(id)
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation with a user-friendly message
      if (error.code === "23505" || error.message?.includes("unique")) {
        throw new Error(
          `A recipe with the name "${
            data.title || "this name"
          }" already exists. Please choose a different name.`
        );
      }
      throw error;
    }

    // Transform snake_case response to camelCase
    return snakeToCamel(recipe);
  }

  async deleteRecipe(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // user_id references profiles(id) = auth.users(id)

    if (error) throw error;
    return { success: true };
  }


  /**
   * MOP-0007 Phase 1 — Full-text search over the caller's own recipes.
   *
   * Calls the `search_recipes_text` PostgreSQL RPC (migration 004; user_id
   * argument made vestigial by migration 028, replaced internally by
   * `auth.uid()`). The RPC matches on `recipes.searchable_text`, which the
   * `update_recipe_searchable_text` trigger keeps populated with title +
   * description + difficulty + tags + ingredients + instructions — so this
   * catches ingredient and instruction matches that the old client-side
   * `title.includes()` filter missed.
   *
   * Latency target: ~30-80ms (vs ~250-500ms for semantic RAG; see
   * docs/RAG_AUDIT.md and chat-rag-sme-knowledge/search-mechanism-decision.md
   * for the per-surface mechanism rationale).
   *
   * Returns an empty array on empty/whitespace query or unauthenticated state.
   */
  async searchRecipesText(query: string, limit: number = 20) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('search_recipes_text', {
      search_query: trimmed,
      user_uuid: user.id, // vestigial post-migration 028; auth.uid() is authoritative
      max_results: limit,
    });
    if (error) throw error;

    // RPC returns Json; map snake_case → camelCase for frontend consumption.
    return ((data as any[]) || []).map((r: any) => snakeToCamel(r));
  }

  /**
   * MOP-0007 Phase 2 — Find recipes similar to a given recipe by embedding proximity.
   *
   * Calls the `find_similar_recipes` PostgreSQL RPC (migration 004, updated in
   * migration 028 to use auth.uid() internally). Returns up to `limit` recipes
   * whose embedding_vector cosine similarity exceeds `threshold` (default 0.6).
   *
   * Returns an empty array when:
   *  - the target recipe has no embedding_vector (recently edited / never embedded)
   *  - no other recipe crosses the similarity threshold
   *  - caller is unauthenticated
   *
   * ~50-100ms — one vector lookup, no query embedding needed at runtime.
   * See docs/RAG_AUDIT.md for the per-surface mechanism rationale.
   */
  async findSimilarRecipes(recipeId: string, limit: number = 5, threshold: number = 0.6) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('find_similar_recipes', {
      recipe_id: recipeId,
      user_id: user.id, // vestigial post-migration 028; auth.uid() is authoritative
      similarity_threshold: threshold,
      max_results: limit,
    });
    if (error) throw error;

    return ((data as any[]) || []).map((r: any) => snakeToCamel(r));
  }

  // Chat endpoints - using Supabase Edge Function (secure, API key protected)
  // The Edge Function handles OpenRouter calls server-side, keeping the API key secure
  async sendMessage(data: SendMessageInput): Promise<ChatMessageResponse> {
    const startTime = Date.now();
    const endpoint = `${SUPABASE_FUNCTIONS_URL}/chat-api/message`;

    Logger.chat.apiCall(endpoint, 'POST', undefined, undefined);
    Logger.chat.messageSent(
      (data.context?.conversationId as string | undefined) || 'new',
      data.sessionId || 'unknown',
      data.message,
      data.intent,
      data.images?.length
    );

    try {
      const { signal, ...payload } = data;
      const response = await this.request<ChatMessageResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
        signal,
      });

      const duration = Date.now() - startTime;
      Logger.chat.apiCall(endpoint, 'POST', 200, duration);
      
      // Log response details
      if (response) {
        const responseData = response as any;
        // ChatMessageResponse has nested structure: { response: { content, id, timestamp }, recipe? }
        const responseContent = responseData.response?.content || responseData.content || '';
        const conversationId = data.context?.conversationId || responseData.conversationId || 'unknown';
        
        Logger.chat.messageReceived(
          conversationId,
          responseContent,
          !!responseData.recipe,
          responseData.intent || data.intent
        );

        if (responseData.recipe) {
          Logger.chat.recipeExtracted(
            conversationId,
            responseData.recipe.title || 'Unknown',
            true
          );
        }

        // Log full response structure for debugging
        Logger.debug('Chat API Response', {
          hasResponse: !!responseData.response,
          hasContent: !!responseContent,
          contentLength: responseContent.length,
          hasRecipe: !!responseData.recipe,
          conversationId: responseData.conversationId,
          sessionId: responseData.sessionId,
        });
      }

      return response;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const err = error as { status?: number; response?: { status?: number }; message?: string };
      const statusCode = err?.status || err?.response?.status || 500;
      Logger.chat.apiCall(endpoint, 'POST', statusCode, duration, err?.message);
      Logger.chat.error('sendMessage', error as Error, {
        sessionId: data.sessionId,
        intent: data.intent,
        messageLength: data.message.length,
      });
      throw error;
    }
  }

  /**
   * MOP-0017 — SSE streaming variant of sendMessage.
   *
   * Sends a request with `Accept: text/event-stream`; the edge function returns
   * a ReadableStream of SSE frames. Each frame is parsed and forwarded to
   * `callbacks.onEvent`. The Promise resolves on `{type:"done"}` or stream end,
   * and rejects on network/parse error.
   */
  async sendMessageStream(
    data: SendMessageInput,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const endpoint = `${SUPABASE_FUNCTIONS_URL}/chat-api/message`;
    const { signal, ...payload } = data;

    // Build auth header the same way `request()` does.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "apikey": SUPABASE_ANON_KEY,
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw new Error(`SSE request failed: ${response.status} ${text.slice(0, 200)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      let reading = true;
      while (reading) {
        const { done, value } = await reader.read();
        if (done) { reading = false; break; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          let event: SSEEvent;
          try {
            event = JSON.parse(payload) as SSEEvent;
          } catch {
            continue; // malformed frame — skip
          }

          callbacks.onEvent(event);

          if (event.type === "done" || event.type === "error") {
            return; // stream logically complete
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * MOP-0019 — Batch recipe import.
   *
   * Sends up to 50 URLs to POST /chat-api/batch-extract and streams SSE
   * progress/result/error/done events back via callbacks.
   */
  async batchImport(
    urls: string[],
    callbacks: BatchImportCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const endpoint = `${SUPABASE_FUNCTIONS_URL}/chat-api/batch-extract`;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "apikey": SUPABASE_ANON_KEY,
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ urls }),
      signal,
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw new Error(`Batch import failed: ${response.status} ${text.slice(0, 200)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      let reading = true;
      while (reading) {
        const { done, value } = await reader.read();
        if (done) { reading = false; break; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          let event: BatchSSEEvent;
          try {
            event = JSON.parse(payload) as BatchSSEEvent;
          } catch {
            continue;
          }

          callbacks.onEvent(event);

          if (event.type === "done") return;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async addRecipeViaChat(data: { recipeText: string }) {
    // Route through chat-api with recipe extraction intent
    return this.request(`${SUPABASE_FUNCTIONS_URL}/chat-api/message`, {
      method: "POST",
      body: JSON.stringify({
        message: `Add recipe: ${data.recipeText}`,
        intent: "recipe_extraction",
        context: { recipeText: data.recipeText },
      }),
    });
  }

  async getChatHistory(limit?: number) {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.append("limit", limit.toString());

    // Supabase edge function path: /functions/v1/chat-api/history
    // Returns list of conversations
    return this.request(
      `${SUPABASE_FUNCTIONS_URL}/chat-api/history?${searchParams.toString()}`
    );
  }

  async getConversationMessages(conversationId: string) {
    // Supabase edge function path: /functions/v1/chat-api/history?conversationId=...
    return this.request(
      `${SUPABASE_FUNCTIONS_URL}/chat-api/history?conversationId=${conversationId}`
    );
  }

  async clearChatHistory() {
    // Supabase edge function path: /functions/v1/chat-api/history
    return this.request(`${SUPABASE_FUNCTIONS_URL}/chat-api/history`, {
      method: "DELETE",
    });
  }

  async deleteConversation(conversationId: string) {
    // Supabase edge function path: /functions/v1/chat-api/history?conversationId=...
    return this.request(
      `${SUPABASE_FUNCTIONS_URL}/chat-api/history?conversationId=${conversationId}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Persist a client-side extraction (video upload) into chat_messages so the
   * agent loop can reference structured recipe data on follow-up turns.
   */
  async persistChatExtraction(data: {
    sessionId: string;
    conversationId?: string;
    userMessage: string;
    assistantContent: string;
    recipe?: Record<string, unknown>;
    recipes?: Record<string, unknown>[];
    userMetadata?: Record<string, unknown>;
    thumbnailUrl?: string;
    signal?: AbortSignal;
  }) {
    const { signal, ...body } = data;
    return this.request<{
      conversationId: string;
      response: { id: string; content: string; sender: string; timestamp: string };
      recipe?: Record<string, unknown>;
      recipes?: Record<string, unknown>[];
    }>(`${SUPABASE_FUNCTIONS_URL}/chat-api/persist-extraction`, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
  }

  // ── Meal Planning ──

  // Reconstruct MealPlanMeals + GroceryList from child-table rows.
  // Called by getMealPlan / getMealPlans to keep all consumers shape-compatible.
  private async _assembleMealPlanShape(planRow: any) {
    const plan = snakeToCamel(planRow);

    const [entries, groceryRows] = await Promise.all([
      this.getMealPlanEntries(plan.id).catch(() => [] as any[]),
      this.getGroceryItems(plan.id).catch(() => [] as any[]),
    ]);

    // Rebuild meals: MealPlanMeals from child table entries
    const meals: Record<string, any> = {};
    for (const e of entries) {
      const entry = {
        id:          e.id,
        recipeId:    e.recipeId    || '',
        recipeName:  e.recipeName  || '',
        recipeImage: e.recipeImage || undefined,
        servings:    e.servings    ?? 1,
        prepTime:    e.prepTime    ?? undefined,
        cookTime:    e.cookTime    ?? undefined,
        notes:       e.notes       || undefined,
      };
      if (e.date && e.slot) {
        if (!meals[e.date]) meals[e.date] = {};
        if (!meals[e.date][e.slot]) meals[e.date][e.slot] = [];
        meals[e.date][e.slot].push(entry);
      } else if (e.listKey) {
        const key = `_${e.listKey}`;
        if (!meals[key]) meals[key] = [];
        meals[key].push(entry);
      }
    }

    // Rebuild groceryList: { items, lastGenerated } from child table rows
    let groceryList: { items: any[]; lastGenerated: string } | null = null;
    if (groceryRows.length > 0) {
      const lastGenerated = groceryRows[0].lastGenerated || new Date().toISOString();
      groceryList = {
        items: groceryRows.map((r: any) => ({
          id:            r.id,
          name:          r.name,
          amount:        r.amount    ?? null,
          unit:          r.unit      || '',
          category:      r.category  || 'other',
          sourceRecipes: r.sourceRecipes || [],
          isManual:      r.isManual  ?? false,
          isChecked:     r.isChecked ?? false,
          isRemoved:     r.isRemoved ?? false,
          notes:         r.notes     || undefined,
          rawAmount:     r.rawAmount ?? undefined,
        })),
        lastGenerated,
      };
    }

    return { ...plan, meals, groceryList };
  }

  async getMealPlans(params?: { limit?: number; status?: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    let query = supabase.from("meal_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false });

    if (params?.status) {
      query = query.eq("status", params.status);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Assemble child-table data for each plan in parallel.
    return Promise.all((data || []).map((p: any) => this._assembleMealPlanShape(p)));
  }

  async getMealPlan(id: string) {
    const { data, error } = await supabase.from("meal_plans")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return this._assembleMealPlanShape(data);
  }

  async createMealPlan(data: {
    title?: string;
    startDate: string;
    endDate: string;
    meals?: any;
    notes?: string;
    status?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: mealPlan, error } = await supabase.from("meal_plans")
      .insert({
        user_id: user.id,
        created_by: user.id,
        last_edited_by: user.id,
        title: data.title || null,
        start_date: data.startDate,
        end_date: data.endDate,
        meals: data.meals || {},
        notes: data.notes || null,
        status: data.status || 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return snakeToCamel(mealPlan);
  }

  async updateMealPlan(id: string, data: {
    title?: string;
    startDate?: string;
    endDate?: string;
    meals?: any;
    groceryList?: any;
    notes?: string;
    status?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const payload: any = { last_edited_by: user.id };
    if (data.title !== undefined) payload.title = data.title;
    if (data.startDate !== undefined) payload.start_date = data.startDate;
    if (data.endDate !== undefined) payload.end_date = data.endDate;
    if (data.meals !== undefined) payload.meals = data.meals;
    if (data.groceryList !== undefined) payload.grocery_list = data.groceryList;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.status !== undefined) payload.status = data.status;

    const { data: mealPlan, error } = await supabase.from("meal_plans")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Dual-write Phase (MOP-0011): mirror meals to child table when caller
    // replaces the full meals JSONB (MealPlanner read-modify-write path).
    if (data.meals !== undefined) {
      await this.replaceMealPlanEntries(id, data.meals).catch(() => {
        // Non-fatal during dual-write window.
      });
    }

    // Dual-write Phase (MOP-0011): mirror grocery list to child table when caller
    // replaces the full grocery_list JSONB (GroceryCart.handleGenerate path).
    if (data.groceryList !== undefined && data.groceryList?.items) {
      const items = (data.groceryList.items as any[]).map((item: any, idx: number) => ({
        name:           item.name,
        amount:         item.amount         ?? null,
        unit:           item.unit           || '',
        category:       item.category       || 'other',
        sourceRecipes:  item.sourceRecipes  || [],
        sourceRecipeId: item.sourceRecipeId || undefined,
        isManual:       item.isManual       ?? false,
        isChecked:      item.isChecked      ?? false,
        notes:          item.notes          || null,
        rawAmount:      item.rawAmount      ?? null,
        lastGenerated:  data.groceryList.lastGenerated || undefined,
        position:       idx,
      }));
      await this.replaceGroceryItems(id, items).catch(() => {
        // Non-fatal: JSONB write already succeeded; child-table write will be
        // retried on next full save or caught during Phase 5 cleanup.
      });
    }

    return snakeToCamel(mealPlan);
  }

  async deleteMealPlan(id: string) {
    const { error } = await supabase.from("meal_plans")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  async copyMealPlan(sourceId: string, newDateRange: { startDate: string; endDate: string }) {
    // Fetch source plan
    const source = await this.getMealPlan(sourceId);
    if (!source) throw new Error("Source meal plan not found");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Shift meal dates to new range
    const sourceStart = new Date(source.startDate);
    const newStart = new Date(newDateRange.startDate);
    const dayOffset = Math.round((newStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));

    // Typed as `Json`-compatible because it's destined for the
    // meal_plans.meals JSONB column (per ADR-0001).
    const shiftedMeals: Record<string, unknown> = {};
    // Cast to Json at insert site (line below) — see line ~571.
    if (source.meals && typeof source.meals === 'object') {
      for (const [dateStr, slots] of Object.entries(source.meals)) {
        // Plan-level lists (e.g. "_snacks", "_non_recipe" — see MealPlanner.tsx
        // PLAN_LISTS) aren't tied to a calendar date and must not go through
        // the date-shift below; carry them over unchanged instead.
        if (dateStr.startsWith('_')) {
          shiftedMeals[dateStr] = slots;
          continue;
        }
        const oldDate = new Date(dateStr);
        oldDate.setDate(oldDate.getDate() + dayOffset);
        const newDateStr = oldDate.toISOString().split('T')[0];
        shiftedMeals[newDateStr] = slots;
      }
    }

    const { data: mealPlan, error } = await supabase.from("meal_plans")
      .insert({
        user_id: user.id,
        created_by: user.id,
        last_edited_by: user.id,
        copied_from: sourceId,
        title: source.title ? `${source.title} (copy)` : null,
        start_date: newDateRange.startDate,
        end_date: newDateRange.endDate,
        meals: shiftedMeals as any, // Json column; runtime shape matches MealPlanMeals
        notes: source.notes || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    const newPlan = snakeToCamel(mealPlan);

    // Dual-write Phase (MOP-0011): copy source entries into child tables for the
    // new plan, with dates shifted by the same dayOffset applied to shiftedMeals.
    const sourceEntries = await this.getMealPlanEntries(sourceId).catch(() => []);
    if (sourceEntries.length > 0) {
      const shiftedEntries = sourceEntries.map((e: any) => {
        const shifted: any = {
          recipeName:  e.recipeName,
          recipeId:    e.recipeId    || undefined,
          recipeImage: e.recipeImage || undefined,
          servings:    e.servings,
          prepTime:    e.prepTime    ?? undefined,
          cookTime:    e.cookTime    ?? undefined,
          notes:       e.notes       || undefined,
          position:    e.position    ?? 0,
        };
        if (e.date) {
          const d = new Date(e.date);
          d.setDate(d.getDate() + dayOffset);
          shifted.date = d.toISOString().split('T')[0];
          shifted.slot = e.slot;
        } else {
          shifted.listKey = e.listKey;
        }
        return shifted;
      });
      await Promise.all(
        shiftedEntries.map((entry: any) => this.addMealPlanEntry(newPlan.id, entry))
      ).catch(() => {
        // Non-fatal: JSONB write succeeded; child-table drift caught in Phase 5.
      });
    }

    return newPlan;
  }

  // ── Meal Plan Child Tables (MOP-0011) ──
  // These methods write directly to meal_plan_entries / grocery_list_items.
  // During the dual-write phase createMealPlan/updateMealPlan/copyMealPlan
  // also write to the JSONB columns; once reads switch to child tables the
  // JSONB writes and these methods are the sole source of truth.

  async getMealPlanEntries(planId: string) {
    const { data, error } = await (supabase as any)
      .from("meal_plan_entries")
      .select("*")
      .eq("meal_plan_id", planId)
      .order("date", { ascending: true, nullsFirst: false })
      .order("position", { ascending: true });
    if (error) throw error;
    return (data || []).map((r: any) => snakeToCamel(r));
  }

  async addMealPlanEntry(planId: string, entry: {
    date?: string;
    slot?: string;
    listKey?: string;
    recipeId?: string;
    recipeName: string;
    recipeImage?: string;
    servings: number;
    prepTime?: number;
    cookTime?: number;
    notes?: string;
    position?: number;
  }) {
    const { data, error } = await (supabase as any)
      .from("meal_plan_entries")
      .insert({
        meal_plan_id: planId,
        date:         entry.date       || null,
        slot:         entry.slot       || null,
        list_key:     entry.listKey    || null,
        recipe_id:    entry.recipeId   || null,
        recipe_name:  entry.recipeName,
        recipe_image: entry.recipeImage || null,
        servings:     entry.servings,
        prep_time:    entry.prepTime   ?? null,
        cook_time:    entry.cookTime   ?? null,
        notes:        entry.notes      || null,
        position:     entry.position   ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data);
  }

  async removeMealPlanEntry(entryId: string) {
    const { error } = await (supabase as any)
      .from("meal_plan_entries")
      .delete()
      .eq("id", entryId);
    if (error) throw error;
  }

  async getGroceryItems(planId: string) {
    const { data, error } = await (supabase as any)
      .from("grocery_list_items")
      .select("*")
      .eq("meal_plan_id", planId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data || []).map((r: any) => snakeToCamel(r));
  }

  async addGroceryItem(planId: string, item: {
    name: string;
    amount?: number | null;
    unit?: string;
    category?: string;
    sourceRecipes?: string[];
    sourceRecipeId?: string;
    isManual?: boolean;
    notes?: string;
    rawAmount?: number | null;
    lastGenerated?: string;
    position?: number;
  }) {
    const { data, error } = await (supabase as any)
      .from("grocery_list_items")
      .insert({
        meal_plan_id:     planId,
        name:             item.name,
        amount:           item.amount           ?? null,
        unit:             item.unit             || '',
        category:         item.category         || 'other',
        source_recipes:   item.sourceRecipes    || [],
        source_recipe_id: item.sourceRecipeId   || null,
        is_manual:        item.isManual         ?? false,
        notes:            item.notes            || null,
        raw_amount:       item.rawAmount        ?? null,
        last_generated:   item.lastGenerated    ? new Date(item.lastGenerated).toISOString() : null,
        position:         item.position         ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data);
  }

  async updateGroceryItem(itemId: string, patch: {
    isChecked?: boolean;
    isRemoved?: boolean;
    amount?: number | null;
    unit?: string;
    notes?: string;
  }) {
    const payload: any = {};
    if (patch.isChecked  !== undefined) payload.is_checked = patch.isChecked;
    if (patch.isRemoved  !== undefined) payload.is_removed = patch.isRemoved;
    if (patch.amount     !== undefined) payload.amount     = patch.amount;
    if (patch.unit       !== undefined) payload.unit       = patch.unit;
    if (patch.notes      !== undefined) payload.notes      = patch.notes;

    const { data, error } = await (supabase as any)
      .from("grocery_list_items")
      .update(payload)
      .eq("id", itemId)
      .select()
      .single();
    if (error) throw error;
    return snakeToCamel(data);
  }

  async replaceMealPlanEntries(planId: string, meals: Record<string, any>) {
    // Delete all existing entries for the plan, then bulk-insert from the
    // MealPlanMeals JSONB shape. Used by updateMealPlan dual-write path.
    const { error: delError } = await (supabase as any)
      .from("meal_plan_entries")
      .delete()
      .eq("meal_plan_id", planId);
    if (delError) throw delError;

    const rows: any[] = [];
    for (const [key, val] of Object.entries(meals)) {
      if (!val) continue;
      if (key.startsWith('_') && Array.isArray(val)) {
        // Plan-level list: _snacks, etc.
        const listKey = key.slice(1); // strip leading _
        (val as any[]).forEach((e: any, idx: number) => {
          rows.push({
            meal_plan_id: planId,
            list_key:     listKey,
            recipe_id:    e.recipeId   || null,
            recipe_name:  e.recipeName || '',
            recipe_image: e.recipeImage || null,
            servings:     e.servings   ?? 1,
            prep_time:    e.prepTime   ?? null,
            cook_time:    e.cookTime   ?? null,
            notes:        e.notes      || null,
            position:     idx,
          });
        });
      } else if (typeof val === 'object' && !Array.isArray(val)) {
        // Date-keyed: meals[date][slot] = PlannedMealEntry[]
        for (const [slot, entries] of Object.entries(val as Record<string, any[]>)) {
          if (!Array.isArray(entries)) continue;
          entries.forEach((e: any, idx: number) => {
            rows.push({
              meal_plan_id: planId,
              date:         key,
              slot,
              recipe_id:    e.recipeId   || null,
              recipe_name:  e.recipeName || '',
              recipe_image: e.recipeImage || null,
              servings:     e.servings   ?? 1,
              prep_time:    e.prepTime   ?? null,
              cook_time:    e.cookTime   ?? null,
              notes:        e.notes      || null,
              position:     idx,
            });
          });
        }
      }
    }

    if (rows.length === 0) return [];

    const { data, error } = await (supabase as any)
      .from("meal_plan_entries")
      .insert(rows)
      .select();
    if (error) throw error;
    return (data || []).map((r: any) => snakeToCamel(r));
  }

  async replaceGroceryItems(planId: string, items: Array<{
    name: string;
    amount?: number | null;
    unit?: string;
    category?: string;
    sourceRecipes?: string[];
    sourceRecipeId?: string;
    isManual?: boolean;
    notes?: string;
    rawAmount?: number | null;
    lastGenerated?: string;
    position?: number;
  }>) {
    // Delete all existing items for the plan, then bulk-insert the new set.
    // Used by GroceryCart.handleGenerate which rebuilds the list from scratch.
    const { error: delError } = await (supabase as any)
      .from("grocery_list_items")
      .delete()
      .eq("meal_plan_id", planId);
    if (delError) throw delError;

    if (items.length === 0) return [];

    const lastGenerated = items[0]?.lastGenerated
      ? new Date(items[0].lastGenerated).toISOString()
      : null;

    const rows = items.map((item, idx) => ({
      meal_plan_id:     planId,
      name:             item.name,
      amount:           item.amount           ?? null,
      unit:             item.unit             || '',
      category:         item.category         || 'other',
      source_recipes:   item.sourceRecipes    || [],
      source_recipe_id: item.sourceRecipeId   || null,
      is_manual:        item.isManual         ?? false,
      notes:            item.notes            || null,
      raw_amount:       item.rawAmount        ?? null,
      last_generated:   lastGenerated,
      position:         idx,
    }));

    const { data, error } = await (supabase as any)
      .from("grocery_list_items")
      .insert(rows)
      .select();
    if (error) throw error;
    return (data || []).map((r: any) => snakeToCamel(r));
  }

  async uploadImage(file: File, folder: string = "recipes"): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error("Image size must be less than 5MB");
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;

    // Upload file to Supabase storage
    const { error } = await supabase.storage
      .from("recipe-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      if (
        error.message?.includes("Bucket not found") ||
        error.message?.includes("not found")
      ) {
        throw new Error(
          "Storage bucket 'recipe-images' not found. Please create it in your Supabase dashboard under Storage."
        );
      }
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("recipe-images").getPublicUrl(fileName);

    return publicUrl;
  }

  /** Upload user-saved video for recipe intake (STT). Stored in recipe-images/intake/. */
  async uploadIntakeMedia(file: File): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
      throw new Error("File must be a video or audio recording");
    }

    const maxSize = 24 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`Media must be less than ${maxSize / 1024 / 1024}MB`);
    }

    const fileExt = file.name.split(".").pop() || "mp4";
    const fileName = `${user.id}/intake/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("recipe-images")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (error) {
      throw new Error(`Failed to upload media: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("recipe-images").getPublicUrl(fileName);

    return publicUrl;
  }

  // Preferences endpoints - using Supabase client directly
  // Note: user_id references profiles(id), which references auth.users(id)
  async getPreferences() {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      
      // If no user or auth error, return null instead of throwing
      // This allows the app to work for unauthenticated users
      if (authError || !user) {
        return null;
      }

      // Try to get preferences - handle case where measurement_system column might not exist yet
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id) // user_id references profiles(id) = auth.users(id)
        .maybeSingle();

    // If error is due to missing column (measurement_system), try without it
    if (
      error &&
      (error.code === "42703" ||
        error.message?.includes("column") ||
        error.message?.includes("does not exist"))
    ) {
      // Column doesn't exist yet - try selecting without it
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("user_preferences")
        .select("id, user_id, created_at, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!fallbackError) {
        return fallbackData;
      }
    }

    if (error) {
      // Handle 406 (Not Acceptable) or not found
      if (error.code === "PGRST116" || error.code === "PGRST301") {
        return null; // Not found - this is OK
      }
      // Log other errors but don't crash the app
      console.warn("Error fetching preferences:", error.message);
      return null;
    }
    return data;
    } catch (error: unknown) {
      // Handle any unexpected errors (like network issues) gracefully
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("Error in getPreferences:", msg);
      return null;
    }
  }

  async updatePreferences(data: any) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Try to update first, if not found, insert
    const { data: existing } = await supabase
      .from("user_preferences")
      .select("id")
      .eq("user_id", user.id) // user_id references profiles(id) = auth.users(id)
      .maybeSingle();

    // Filter out measurement_system if column doesn't exist yet
    const updateData = { ...data };
    if (updateData.measurement_system) {
      // Check if column exists by trying to update with it
      // If it fails, we'll remove it and try again
    }

    if (existing) {
      const { data: updated, error } = await supabase.from("user_preferences")
        .update(updateData)
        .eq("user_id", user.id) // user_id references profiles(id) = auth.users(id)
        .select()
        .maybeSingle();

      // If error is due to missing column (406 Not Acceptable or 42703), try without measurement_system
      if (
        error &&
        (error.code === "42703" ||
          error.code === "PGRST301" ||
          error.message?.includes("406") ||
          error.message?.includes("column") ||
          error.message?.includes("does not exist") ||
          error.message?.includes("Not Acceptable"))
      ) {
        const { measurement_system: _measurement_system, ...dataWithoutMeasurement } = updateData;
        const { data: updatedFallback, error: fallbackError } = await supabase.from("user_preferences")
          .update(dataWithoutMeasurement)
          .eq("user_id", user.id)
          .select()
          .maybeSingle();

        if (fallbackError) {
          // If fallback also fails, still return the data with measurement_system for local use
          console.warn(
            "Could not update preferences (migration may not be run):",
            fallbackError.message
          );
          return { ...(existing as any), ...updateData };
        }
        // Return the updated data with measurement_system added locally (won't be saved until migration runs)
          return {
            ...(updatedFallback as any),
            measurement_system: updateData.measurement_system,
        };
      }

      if (error) throw error;
      return updated;
    } else {
      // For insert, try with measurement_system first
      const { data: created, error } = await supabase
        .from("user_preferences")
        .insert({ ...updateData, user_id: user.id }) // user_id references profiles(id) = auth.users(id)
        .select()
        .maybeSingle();

      // If error is due to missing column (406 Not Acceptable or 42703), try without measurement_system
      if (
        error &&
        (error.code === "42703" ||
          error.code === "PGRST301" ||
          error.message?.includes("406") ||
          error.message?.includes("column") ||
          error.message?.includes("does not exist") ||
          error.message?.includes("Not Acceptable"))
      ) {
        const { measurement_system: _measurement_system, ...dataWithoutMeasurement } = updateData;
        const { data: createdFallback, error: fallbackError } = await supabase
          .from("user_preferences")
          .insert({ ...dataWithoutMeasurement, user_id: user.id })
          .select()
          .maybeSingle();

        if (fallbackError) {
          // If fallback also fails, return the data with measurement_system for local use
          console.warn(
            "Could not create preferences (migration may not be run):",
            fallbackError.message
          );
          return { ...updateData, user_id: user.id, id: null };
        }
        // Return with measurement_system added locally
          return {
            ...(createdFallback as any),
            measurement_system: updateData.measurement_system,
          };
      }

      if (error) throw error;
      return created;
    }
  }


  // ── Duplicate & Similarity checks ──

  /**
   * Check if a recipe with the same title already exists (Phase 1 — pre-save).
   * Returns the existing recipe's id and title if found.
   */
  async checkDuplicateTitle(title: string): Promise<{ isDuplicate: boolean; existingId?: string; existingTitle?: string }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("recipes")
      .select("id, title")
      .eq("user_id", user.id)
      .ilike("title", title.trim().toLowerCase())
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    const record = data as { id: string; title: string } | null;
    return {
      isDuplicate: !!record,
      existingId: record?.id,
      existingTitle: record?.title,
    };
  }

  /**
   * Check for semantically similar recipes (Phase 2 — post-embedding).
   * Sends recipe data to backend which generates an embedding and searches.
   * Returns similar recipes above the similarity threshold.
   */
  async checkSimilarRecipes(recipeData: {
    title: string;
    description?: string;
    ingredients?: any[];
    instructions?: string[];
    tags?: string[];
    cuisine?: string;
    difficulty?: string;
  }): Promise<{ similar: Array<{ id: string; title: string; similarity: number }> }> {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/recipe-pipeline/check-similar`, {
      method: "POST",
      body: JSON.stringify(recipeData),
    });
  }

  // ── Recipe Pipeline endpoints ──

  async ingestRecipeFromUrl(
    url: string,
    autoSave = true,
    extra?: {
      pinned_comment_text?: string;
      supplementary_text?: string;
      frame_urls?: string[];
      media_url?: string;
      transcript?: string;
      auto_transcribe?: boolean;
    }
  ) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/recipe-pipeline/ingest`, {
      method: "POST",
      body: JSON.stringify({
        source_type: "url",
        url,
        auto_save: autoSave,
        ...extra,
      }),
    });
  }

  async ingestRecipeFromText(text: string, images?: string[], autoSave = true) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/recipe-pipeline/ingest`, {
      method: "POST",
      body: JSON.stringify({ source_type: "text", text, images, auto_save: autoSave }),
    });
  }

  async ingestRecipeFromVideo(
    data: {
      video_url?: string;
      frame_urls?: string[];
      transcript?: string;
      pinned_comment_text?: string;
      supplementary_text?: string;
      media_url?: string;
      media_base64?: string;
      auto_transcribe?: boolean;
    },
    autoSave = true
  ) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/recipe-pipeline/ingest`, {
      method: "POST",
      body: JSON.stringify({ source_type: "video", ...data, auto_save: autoSave }),
    });
  }

  async extractRecipeOnly(
    sourceType: "url" | "text" | "video",
    data: Record<string, any>,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ) {
    const timeoutMs = options?.timeoutMs ?? (sourceType === "video" ? 180_000 : 60_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    options?.signal?.addEventListener("abort", onExternalAbort);
    try {
      return await this.request(`${SUPABASE_FUNCTIONS_URL}/recipe-pipeline/extract-only`, {
        method: "POST",
        body: JSON.stringify({ source_type: sourceType, ...data }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      options?.signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  // ── Household endpoints ──

  async getMyHousehold() {
    const { data, error } = await supabase.rpc('get_my_household');
    if (error) throw error;
    if (!data) return null;
    return snakeToCamel(data);
  }

  // ── Dashboard endpoints ──

  /** Single-round-trip aggregation for the dashboard widgets (MOP-0030):
   *  recipe counts, this week's meals, active plan count, grocery progress,
   *  reactions given, most-cooked this month, and top cuisines. Replaces
   *  the old pattern of fetching capped/paginated lists client-side just
   *  to read `.length`. */
  async getDashboardStats() {
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (error) throw error;
    if (!data) return null;
    return snakeToCamel(data);
  }

  async updateHousehold(householdId: string, data: { name?: string; allowMemberEdits?: boolean; allowMemberChildEdits?: boolean }) {
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.allowMemberEdits !== undefined) payload.allow_member_edits = data.allowMemberEdits;
    if (data.allowMemberChildEdits !== undefined) payload.allow_member_child_edits = data.allowMemberChildEdits;
    const { data: household, error } = await (supabase.from("households") as any)
      .update(payload)
      .eq("id", householdId)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamel(household);
  }

  async createHouseholdInvite(householdId: string, email: string) {
    return this.request<any>(`${SUPABASE_FUNCTIONS_URL}/household-invite/send`, {
      method: "POST",
      body: JSON.stringify({ householdId, email, origin: window.location.origin }),
    });
  }

  async getInviteDetails(inviteId: string) {
    return this.request<any>(
      `${SUPABASE_FUNCTIONS_URL}/household-invite/details?id=${encodeURIComponent(inviteId)}`
    );
  }

  async acceptInviteById(inviteId: string) {
    return this.request<any>(`${SUPABASE_FUNCTIONS_URL}/household-invite/accept`, {
      method: "POST",
      body: JSON.stringify({ inviteId }),
    });
  }

  async resendHouseholdInvite(inviteId: string) {
    return this.request<any>(`${SUPABASE_FUNCTIONS_URL}/household-invite/resend`, {
      method: "POST",
      body: JSON.stringify({ inviteId, origin: window.location.origin }),
    });
  }

  async getMyPendingInvites() {
    const { data, error } = await supabase.rpc('get_my_pending_invites');
    if (error) throw error;
    // RPC return type is Json (unknown shape) per generated types — narrow at access.
    return ((data as any[]) || []).map((i: any) => snakeToCamel(i));
  }

  async respondToInvite(inviteId: string, accept: boolean) {
    // Single atomic RPC — invite update + optional member insert happen in one
    // Postgres transaction. Replaces the prior two-step Supabase client writes
    // (migration 037 / MOP-0014). RPC enforces SECURITY DEFINER auth checks.
    const { data, error } = await (supabase as any).rpc('respond_to_household_invite', {
      p_invite_id: inviteId,
      p_accept: accept,
    });

    if (error) throw error;
    // RPC returns table(household_id, household_name, status); callers only
    // invalidate query cache on success — return shape is not consumed directly.
    return snakeToCamel((data as any[])?.[0] ?? null);
  }

  // ── Household Member Management ──

  async updateMemberRole(memberId: string, role: 'admin' | 'member') {
    const { data, error } = await supabase.from("household_members")
      .update({ role })
      .eq("id", memberId)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamel(data);
  }

  async removeHouseholdMember(memberId: string) {
    const { error } = await supabase.from("household_members")
      .delete()
      .eq("id", memberId);

    if (error) throw error;
  }

  async transferOwnership(memberId: string, householdId: string) {
    // Single atomic RPC — promote target + demote caller in one Postgres
    // transaction. Replaces the prior two-step PATCH sequence that left a
    // dual-owner window on mid-transfer failure (migration 037 / MOP-0014).
    const { error } = await (supabase as any).rpc('transfer_household_ownership', {
      p_member_id: memberId,
      p_household_id: householdId,
    });

    if (error) throw error;
  }

  // ── Family Members (Dependents) ──

  async createFamilyMember(data: {
    householdId: string;
    name: string;
    relationship: string;
    age?: number;
    dietaryRestrictions?: string[];
    allergies?: string[];
    preferences?: Record<string, any>;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: member, error } = await supabase.from("family_members")
      .insert({
        household_id: data.householdId,
        managed_by: user.id,
        name: data.name,
        relationship: data.relationship,
        age: data.age || null,
        dietary_restrictions: data.dietaryRestrictions || [],
        allergies: data.allergies || [],
        preferences: data.preferences || {},
      })
      .select()
      .single();

    if (error) throw error;
    return snakeToCamel(member);
  }

  async updateFamilyMember(memberId: string, updates: {
    name?: string;
    relationship?: string;
    age?: number | null;
    dietaryRestrictions?: string[];
    allergies?: string[];
    /** Structured lifestyle dietary flags: 'vegan','vegetarian','gluten-free','dairy-free','halal','kosher','keto','paleo' */
    dietaryFlags?: string[];
    /** Soft ingredient/cuisine dislikes (non-allergy) */
    dislikes?: string[];
    preferences?: Record<string, any>;
  }) {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.relationship !== undefined) payload.relationship = updates.relationship;
    if (updates.age !== undefined) payload.age = updates.age;
    if (updates.dietaryRestrictions !== undefined) payload.dietary_restrictions = updates.dietaryRestrictions;
    if (updates.allergies !== undefined) payload.allergies = updates.allergies;
    if (updates.dietaryFlags !== undefined) payload.dietary_flags = updates.dietaryFlags;
    if (updates.dislikes !== undefined) payload.dislikes = updates.dislikes;
    if (updates.preferences !== undefined) payload.preferences = updates.preferences;

    const { data: member, error } = await supabase.from("family_members")
      .update(payload as never)
      .eq("id", memberId)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamel(member);
  }

  /** Convenience alias — patches only the four dietary/allergy arrays. */
  async updateFamilyMemberProfile(
    memberId: string,
    profile: {
      allergies?: string[];
      dietaryRestrictions?: string[];
      dietaryFlags?: string[];
      dislikes?: string[];
    }
  ) {
    return this.updateFamilyMember(memberId, profile);
  }

  async deleteFamilyMember(memberId: string) {
    const { error } = await supabase.from("family_members")
      .update({ is_active: false })
      .eq("id", memberId);

    if (error) throw error;
  }

  // ── Recipe Reactions ──

  async getRecipeReactions(recipeIds: string[]) {
    if (recipeIds.length === 0) return [];

    const { data, error } = await supabase.rpc('get_recipe_reactions', {
      p_recipe_ids: recipeIds,
    });
    if (error) throw error;

    return ((data as any[]) || []).map((r: any) => ({
      id: r.id,
      recipeId: r.recipe_id,
      userId: r.user_id,
      familyMemberId: r.family_member_id,
      reaction: r.reaction,
      name: r.name ?? null,
    }));
  }

  async toggleRecipeReaction(data: {
    recipeId: string;
    reaction: 'thumbs_up' | 'thumbs_down';
    familyMemberId?: string;
  }) {
    const { data: result, error } = await supabase.rpc('toggle_recipe_reaction', {
      p_recipe_id: data.recipeId,
      p_reaction: data.reaction,
      // Generated typegen marks this nullable param as `string | undefined` but the
      // SQL function accepts NULL — pass null at runtime, cast for the type checker.
      p_family_member_id: (data.familyMemberId || null) as any,
    });
    if (error) throw error;
    return result;
  }

  async updateRecipeVisibility(recipeId: string, visibility: 'private' | 'household' | 'public') {
    const { error } = await supabase.from("recipes")
      .update({ visibility })
      .eq("id", recipeId);

    if (error) throw error;
    return { id: recipeId, visibility };
  }

  // ── Bulk Recipe Actions (MOP-0028) ──
  // Cast to `any` — RPCs not yet in generated types until migration 038 is deployed.

  async bulkUpdateRecipeVisibility(recipeIds: string[], visibility: 'private' | 'household' | 'public'): Promise<number> {
    const { data, error } = await (supabase as any).rpc('bulk_update_recipe_visibility', {
      p_recipe_ids: recipeIds,
      p_visibility: visibility,
    });
    if (error) throw error;
    return (data as number) ?? 0;
  }

  async bulkDeleteRecipes(recipeIds: string[]): Promise<number> {
    const { data, error } = await (supabase as any).rpc('bulk_delete_recipes', {
      p_recipe_ids: recipeIds,
    });
    if (error) throw error;
    return (data as number) ?? 0;
  }

  async bulkAddToCollection(collectionId: string, recipeIds: string[]): Promise<number> {
    const { data, error } = await (supabase as any).rpc('bulk_add_to_collection', {
      p_collection_id: collectionId,
      p_recipe_ids: recipeIds,
    });
    if (error) throw error;
    return (data as number) ?? 0;
  }

  // ── Recipe Collections ──

  async getMyCollections() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase.from("recipe_collections")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data || []).map((c: any) => snakeToCamel(c));
  }

  async getCollection(collectionId: string) {
    const { data, error } = await supabase.from("recipe_collections")
      .select("*")
      .eq("id", collectionId)
      .single();

    if (error) throw error;
    return snakeToCamel(data);
  }

  async getCollectionRecipes(collectionId: string) {
    const { data, error } = await supabase.from("collection_recipes")
      .select("recipe_id, sort_order, added_at, recipes(*)")
      .eq("collection_id", collectionId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data || []).map((cr: any) => snakeToCamel(cr));
  }

  async createCollection(name: string, description?: string, icon?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase.from("recipe_collections")
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        icon: icon || null,
      })
      .select()
      .single();

    if (error) throw error;
    return snakeToCamel(data);
  }

  async updateCollection(collectionId: string, updates: { name?: string; description?: string; icon?: string; visibility?: string }) {
    const { data, error } = await supabase.from("recipe_collections")
      .update(updates)
      .eq("id", collectionId)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamel(data);
  }

  async deleteCollection(collectionId: string) {
    const { error } = await supabase.from("recipe_collections")
      .delete()
      .eq("id", collectionId);

    if (error) throw error;
  }

  async addRecipeToCollection(collectionId: string, recipeId: string) {
    const { error } = await supabase.from("collection_recipes")
      .insert({ collection_id: collectionId, recipe_id: recipeId });

    if (error) throw error;
  }

  async removeRecipeFromCollection(collectionId: string, recipeId: string) {
    const { error } = await supabase.from("collection_recipes")
      .delete()
      .eq("collection_id", collectionId)
      .eq("recipe_id", recipeId);

    if (error) throw error;
  }

  // ── Household Recipes ──

  async getHouseholdRecipes(params?: { limit?: number; offset?: number }) {
    const { data, error } = await supabase.rpc('get_household_recipes', {
      p_limit: params?.limit || 50,
      p_offset: params?.offset || 0,
    });
    if (error) throw error;
    if (!data) return { recipes: [], total: 0 };

    // RPC return type is Json — narrow to the known { recipes, total } shape.
    const rpcResult = data as { recipes?: any[]; total?: number };
    const camelRecipes = (rpcResult.recipes || []).map((r: any) => {
      const recipe = snakeToCamel(r);
      if (r.profiles) {
        recipe.author = {
          displayName: r.profiles.display_name,
          username: r.profiles.username,
          avatarUrl: r.profiles.avatar_url,
        };
      }
      return recipe;
    });

    return { recipes: camelRecipes, total: rpcResult.total ?? 0 };
  }

  // ── Public Recipes ──

  async getPublicRecipes(params?: { limit?: number; offset?: number }) {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    const { data, error } = await supabase.from("recipes")
      .select("*, profiles!recipes_user_id_fkey(display_name, username, avatar_url)")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const camelRecipes = (data || []).map((r: any) => {
      const recipe = snakeToCamel(r);
      // Flatten author info
      if (r.profiles) {
        recipe.author = {
          displayName: r.profiles.display_name,
          username: r.profiles.username,
          avatarUrl: r.profiles.avatar_url,
        };
      }
      return recipe;
    });

    return { recipes: camelRecipes, total: camelRecipes.length };
  }

  // ── Username / Profile ──

  async getMyProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase.from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    return snakeToCamel(data);
  }

  // ── Plan Period Config (MOP-0022) ──

  async getPlanPeriodConfig() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    // plan_period_config is a new column (migration 031) — cast to any until
    // Supabase types are regenerated post-deploy.
    const { data, error } = await (supabase.from("profiles") as any)
      .select("plan_period_config")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    return (data?.plan_period_config ?? null) as import("@/components/settings/PlanPeriodConfig").PlanPeriodConfigValue | null;
  }

  async setPlanPeriodConfig(config: import("@/components/settings/PlanPeriodConfig").PlanPeriodConfigValue) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    const { error } = await (supabase.from("profiles") as any)
      .update({ plan_period_config: config })
      .eq("id", user.id);
    if (error) throw error;
  }

  // ── Admin Methods (via admin-api edge function) ──

  async adminGetAllUsers() {
    return this.request<any[]>(`${SUPABASE_FUNCTIONS_URL}/admin-api/users`, { method: "GET" });
  }

  async adminGetAllInvites() {
    const data = await this.request<any[]>(`${SUPABASE_FUNCTIONS_URL}/admin-api/invites`, { method: "GET" });
    return (data || []).map((i: any) => snakeToCamel(i));
  }

  async adminGetAllHouseholds() {
    const data = await this.request<any[]>(`${SUPABASE_FUNCTIONS_URL}/admin-api/households`, { method: "GET" });
    return (data || []).map((h: any) => snakeToCamel(h));
  }

  async adminDeleteUser(userId: string) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/admin-api/users`, {
      method: "DELETE",
      body: JSON.stringify({ userId }),
    });
  }

  async adminUpdateUser(userId: string, updates: { display_name?: string; setup_completed?: boolean }) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/admin-api/users`, {
      method: "PATCH",
      body: JSON.stringify({ userId, updates: camelToSnake(updates) }),
    });
  }

  async adminDeleteInvite(inviteId: string) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/admin-api/invites`, {
      method: "DELETE",
      body: JSON.stringify({ inviteId }),
    });
  }

  async adminRemoveHouseholdMember(memberId: string) {
    // Keep using direct Supabase for member removal (RLS handles it)
    const { error } = await supabase.from("household_members")
      .delete()
      .eq("id", memberId);

    if (error) throw error;
  }

  async adminDeleteHousehold(householdId: string) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/admin-api/households`, {
      method: "DELETE",
      body: JSON.stringify({ householdId }),
    });
  }

  // ── Direct Recipe Sharing (MOP-0031) ──

  async shareRecipe(recipeId: string, targetIdentifier: string): Promise<string> {
    const { data, error } = await (supabase as any).rpc('share_recipe', {
      p_recipe_id: recipeId,
      p_target_identifier: targetIdentifier,
    });
    if (error) throw error;
    return data as string;
  }

  async unshareRecipe(recipeId: string, sharedWithUserId: string): Promise<void> {
    const { error } = await (supabase as any).rpc('unshare_recipe', {
      p_recipe_id: recipeId,
      p_shared_with_user_id: sharedWithUserId,
    });
    if (error) throw error;
  }

  async getSharedWithMe(): Promise<any[]> {
    const { data, error } = await (supabase as any).rpc('get_shared_with_me');
    if (error) throw error;
    return ((data as any[]) || []).map((row: any) => ({
      shareId: row.share_id,
      recipeId: row.recipe_id,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      tags: row.tags,
      visibility: row.visibility,
      sharedAt: row.shared_at,
      seenAt: row.seen_at,
      sharedByUserId: row.shared_by_user_id,
      sharerDisplayName: row.sharer_display_name,
      sharerUsername: row.sharer_username,
      sharerAvatarUrl: row.sharer_avatar_url,
    }));
  }

  async markShareSeen(shareId: string): Promise<void> {
    const { error } = await (supabase as any).rpc('mark_share_seen', {
      p_share_id: shareId,
    });
    if (error) throw error;
  }

  async getUnseenShareCount(): Promise<number> {
    const { data, error } = await (supabase as any).rpc('get_unseen_share_count');
    if (error) return 0;
    return (data as number) ?? 0;
  }

  async updateUsername(username: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Validate format
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      throw new Error("Username must be 3-30 characters, lowercase letters, numbers, and underscores only");
    }

    const { data, error } = await supabase.from("profiles")
      .update({ username })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error("Username already taken");
      throw error;
    }
    return snakeToCamel(data);
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// React Query hooks
export const useRecipes = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: ["recipes", params],
    queryFn: () => apiClient.getRecipes(params),
    staleTime: QUERY_STALE_TIME.domain,
  });
};

/** Lightweight recipe hook for the randomizer — avoids loading full objects. */
export const useRecipesLight = () => {
  const { user, isLoading: authLoading } = useAuthStore();
  return useQuery({
    queryKey: ["recipes-light"],
    queryFn: () => apiClient.getRecipesLight(),
    enabled: !authLoading && !!user,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

// Auth hooks
// Auth is now managed by Zustand store in src/stores/authStore

export const useRecipe = (id: string) => {
  return useQuery({
    queryKey: ["recipe", id],
    queryFn: () => apiClient.getRecipe(id),
    enabled: !!id,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useCreateRecipe = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, options }: { data: any; options?: { skipDuplicateCheck?: boolean } }) =>
      apiClient.createRecipe(data, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};

export const useUpdateRecipe = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.updateRecipe(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipe", id] });
    },
  });
};

export const useDeleteRecipe = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};


/**
 * MOP-0007 Phase 1 — React Query hook for full-text search over the caller's
 * own recipes. Pass the debounced query string; the hook is disabled on
 * empty/whitespace input. Results are camelCased recipe rows.
 */
export const useRecipeTextSearch = (query: string, limit?: number) => {
  return useQuery({
    queryKey: ["recipes", "text-search", query, limit],
    queryFn: () => apiClient.searchRecipesText(query, limit),
    enabled: !!query.trim(),
    staleTime: QUERY_STALE_TIME.search,
  });
};

/**
 * MOP-0007 Phase 3/4 — Scored recipe recommendations.
 *
 * Calls `get_recipe_recommendations` (migration 035 — now includes reaction
 * signal as a 5th scoring term). Filters by difficulty, tags, and max prep
 * time. Returns up to `limit` recipes scored 0–1 (recommendation_score).
 */
export const useGetRecipeRecommendations = (
  params: {
    preferenceDifficulty?: string;
    preferenceTags?: string[];
    maxPrepTimeMinutes?: number;
    limit?: number;
  },
  enabled = true,
) => {
  return useQuery({
    queryKey: ["recipes", "recommendations", params],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase.rpc as any)('get_recipe_recommendations', {
        user_id: user.id, // vestigial post-migration 028; auth.uid() is authoritative
        preference_difficulty: params.preferenceDifficulty ?? null,
        preference_tags: params.preferenceTags ?? null,
        max_prep_time_minutes: params.maxPrepTimeMinutes ?? null,
        limit_count: params.limit ?? 10,
      });
      if (error) throw error;
      return ((data as any[]) || []).map((r: any) => snakeToCamel(r));
    },
    enabled,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useFindSimilarRecipes = (recipeId: string, limit?: number, threshold?: number) => {
  return useQuery({
    queryKey: ["recipes", "similar", recipeId, limit, threshold],
    queryFn: () => apiClient.findSimilarRecipes(recipeId, limit, threshold),
    enabled: !!recipeId,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useChatHistory = (limit?: number) => {
  return useQuery({
    queryKey: ["chat", "history", limit],
    queryFn: () => apiClient.getChatHistory(limit),
    staleTime: QUERY_STALE_TIME.chatHistory,
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageInput) => apiClient.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "history"] });
    },
  });
};

export const useMealPlans = (params?: { limit?: number; status?: string }) => {
  const { user, isLoading: authLoading } = useAuthStore();

  return useQuery({
    queryKey: ["meal-plans", params],
    queryFn: () => apiClient.getMealPlans(params),
    enabled: !authLoading && !!user,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useMealPlan = (id: string) => {
  return useQuery({
    queryKey: ["meal-plan", id],
    queryFn: () => apiClient.getMealPlan(id),
    enabled: !!id,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useCreateMealPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title?: string;
      startDate: string;
      endDate: string;
      meals?: any;
      notes?: string;
      status?: string;
    }) => apiClient.createMealPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
  });
};

export const useUpdateMealPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.updateMealPlan(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["meal-plan", id] });
    },
  });
};

export const useDeleteMealPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteMealPlan(id),
    // Optimistic: strip the plan from every cached meal-plans query immediately
    // so the list updates without waiting for a round-trip refetch.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["meal-plans"] });
      const snapshots = queryClient.getQueriesData<any[]>({ queryKey: ["meal-plans"] });
      queryClient.setQueriesData<any[]>({ queryKey: ["meal-plans"] }, (old) =>
        old ? old.filter((p: any) => p.id !== id) : old
      );
      return { snapshots };
    },
    onError: (_err, _id, context: any) => {
      // Roll back on failure
      if (context?.snapshots) {
        context.snapshots.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
  });
};

export const useCopyMealPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sourceId, newDateRange }: { sourceId: string; newDateRange: { startDate: string; endDate: string } }) =>
      apiClient.copyMealPlan(sourceId, newDateRange),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
  });
};

// ── Meal Plan Child Table hooks (MOP-0011) ──

export const useMealPlanEntries = (planId: string) => {
  return useQuery({
    queryKey: ["meal-plan-entries", planId],
    queryFn: () => apiClient.getMealPlanEntries(planId),
    enabled: !!planId,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useAddMealPlanEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, entry }: { planId: string; entry: Parameters<ApiClient["addMealPlanEntry"]>[1] }) =>
      apiClient.addMealPlanEntry(planId, entry),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan-entries", planId] });
    },
  });
};

export const useRemoveMealPlanEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId: _planId, entryId }: { planId: string; entryId: string }) =>
      apiClient.removeMealPlanEntry(entryId),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan-entries", planId] });
    },
  });
};

export const useGroceryItems = (planId: string) => {
  return useQuery({
    queryKey: ["grocery-items", planId],
    queryFn: () => apiClient.getGroceryItems(planId),
    enabled: !!planId,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useAddGroceryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, item }: { planId: string; item: Parameters<ApiClient["addGroceryItem"]>[1] }) =>
      apiClient.addGroceryItem(planId, item),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ["grocery-items", planId] });
    },
  });
};

export const useUpdateGroceryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId: _planId, itemId, patch }: { planId: string; itemId: string; patch: Parameters<ApiClient["updateGroceryItem"]>[1] }) =>
      apiClient.updateGroceryItem(itemId, patch),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ["grocery-items", planId] });
    },
  });
};

export const usePreferences = () => {
  // Check if user is authenticated before running the query
  const { user, isLoading: authLoading } = useAuthStore();
  
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () => apiClient.getPreferences(),
    enabled: !authLoading && !!user, // Only run when auth is loaded and user exists
    retry: false, // Don't retry on auth errors
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useUpdatePreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => apiClient.updatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
};

// ── Household hooks ──

export const useMyHousehold = () => {
  const { user, isLoading: authLoading } = useAuthStore();

  return useQuery({
    queryKey: ["household"],
    queryFn: () => apiClient.getMyHousehold(),
    enabled: !authLoading && !!user,
    retry: false,
  });
};

// ── Dashboard hooks ──

export const useDashboardStats = () => {
  const { user, isLoading: authLoading } = useAuthStore();

  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiClient.getDashboardStats(),
    enabled: !authLoading && !!user,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useUpdateHousehold = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ householdId, name }: { householdId: string; name: string }) =>
      apiClient.updateHousehold(householdId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
};

export const useUpdateHouseholdPermissions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ householdId, allowMemberEdits, allowMemberChildEdits }: {
      householdId: string;
      allowMemberEdits?: boolean;
      allowMemberChildEdits?: boolean;
    }) => apiClient.updateHousehold(householdId, { allowMemberEdits, allowMemberChildEdits }),
    onMutate: async ({ allowMemberEdits, allowMemberChildEdits }) => {
      // Cancel any in-flight refetch so it doesn't overwrite optimistic state
      await queryClient.cancelQueries({ queryKey: ["household"] });
      const previous = queryClient.getQueryData(["household"]);
      queryClient.setQueryData(["household"], (old: any) => {
        if (!old?.household) return old;
        return {
          ...old,
          household: {
            ...old.household,
            ...(allowMemberEdits !== undefined && { allowMemberEdits }),
            ...(allowMemberChildEdits !== undefined && { allowMemberChildEdits }),
          },
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      // Roll back to the snapshot taken before the mutation
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["household"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
};

export const useCreateHouseholdInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ householdId, email }: { householdId: string; email: string }) =>
      apiClient.createHouseholdInvite(householdId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
};

export const useMyPendingInvites = () => {
  const { user, isLoading: authLoading } = useAuthStore();

  return useQuery({
    queryKey: ["household-invites"],
    queryFn: () => apiClient.getMyPendingInvites(),
    enabled: !authLoading && !!user,
  });
};

export const useRespondToInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      apiClient.respondToInvite(inviteId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
      queryClient.invalidateQueries({ queryKey: ["household-invites"] });
    },
  });
};

export const useAcceptInviteById = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => apiClient.acceptInviteById(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
      queryClient.invalidateQueries({ queryKey: ["household-invites"] });
    },
  });
};

export const useResendHouseholdInvite = () => {
  return useMutation({
    mutationFn: (inviteId: string) => apiClient.resendHouseholdInvite(inviteId),
  });
};

// ── Family Member Hooks ──

export const useCreateFamilyMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      householdId: string;
      name: string;
      relationship: string;
      age?: number;
      dietaryRestrictions?: string[];
      allergies?: string[];
      preferences?: Record<string, any>;
    }) => apiClient.createFamilyMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
};

export const useUpdateFamilyMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, updates }: {
      memberId: string;
      updates: { name?: string; relationship?: string; age?: number | null; dietaryRestrictions?: string[]; allergies?: string[]; dietaryFlags?: string[]; dislikes?: string[]; preferences?: Record<string, any> };
    }) => apiClient.updateFamilyMember(memberId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
};

export const useDeleteFamilyMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => apiClient.deleteFamilyMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
};

// ── Household Member Management Hooks ──

export const useUpdateMemberRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'admin' | 'member' }) =>
      apiClient.updateMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
};

export const useRemoveHouseholdMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => apiClient.removeHouseholdMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
};

export const useTransferOwnership = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, householdId }: { memberId: string; householdId: string }) =>
      apiClient.transferOwnership(memberId, householdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
};

export const useUpdateRecipeVisibility = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recipeId, visibility }: { recipeId: string; visibility: 'private' | 'household' | 'public' }) =>
      apiClient.updateRecipeVisibility(recipeId, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["public-recipes"] });
    },
  });
};

// ── Collection Hooks ──

export const useMyCollections = () => {
  const { user, isLoading: authLoading } = useAuthStore();

  return useQuery({
    queryKey: ["collections"],
    queryFn: () => apiClient.getMyCollections(),
    enabled: !authLoading && !!user,
  });
};

export const useCollection = (collectionId: string) => {
  return useQuery({
    queryKey: ["collections", collectionId],
    queryFn: () => apiClient.getCollection(collectionId),
    enabled: !!collectionId,
  });
};

export const useCollectionRecipes = (collectionId: string) => {
  return useQuery({
    queryKey: ["collections", collectionId, "recipes"],
    queryFn: () => apiClient.getCollectionRecipes(collectionId),
    enabled: !!collectionId,
  });
};

export const useCreateCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, description, icon }: { name: string; description?: string; icon?: string }) =>
      apiClient.createCollection(name, description, icon),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
};

export const useUpdateCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, updates }: { collectionId: string; updates: { name?: string; description?: string; icon?: string; visibility?: string } }) =>
      apiClient.updateCollection(collectionId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
};

export const useDeleteCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collectionId: string) => apiClient.deleteCollection(collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
};

export const useAddRecipeToCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) =>
      apiClient.addRecipeToCollection(collectionId, recipeId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collections", variables.collectionId, "recipes"] });
    },
  });
};

export const useRemoveRecipeFromCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) =>
      apiClient.removeRecipeFromCollection(collectionId, recipeId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collections", variables.collectionId, "recipes"] });
    },
  });
};

// ── Household Recipes Hook ──

export const useHouseholdRecipes = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: ["household-recipes", params],
    queryFn: () => apiClient.getHouseholdRecipes(params),
  });
};

// ── Public Recipes Hook ──

export const usePublicRecipes = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: ["public-recipes", params],
    queryFn: () => apiClient.getPublicRecipes(params),
  });
};

// ── Profile / Username Hooks ──

export const useMyProfile = () => {
  const { user, isLoading: authLoading } = useAuthStore();

  return useQuery({
    queryKey: ["profile"],
    queryFn: () => apiClient.getMyProfile(),
    enabled: !authLoading && !!user,
  });
};

export const useUpdateUsername = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (username: string) => apiClient.updateUsername(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

// ── Plan Period Config Hooks (MOP-0022) ──

export const usePlanPeriodConfig = () => {
  const { user, isLoading: authLoading } = useAuthStore();
  return useQuery({
    queryKey: ["plan-period-config"],
    queryFn: () => apiClient.getPlanPeriodConfig(),
    enabled: !authLoading && !!user,
  });
};

export const useSetPlanPeriodConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: import("@/components/settings/PlanPeriodConfig").PlanPeriodConfigValue) =>
      apiClient.setPlanPeriodConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-period-config"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

// ── My Dietary Profile (MOP-0025) ──

export const useMyDietaryProfile = () => {
  const { user, isLoading: authLoading } = useAuthStore();
  return useQuery({
    queryKey: ["my-dietary-profile"],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error("Not authenticated");
      // dietary_restrictions and allergies added in migration 030 — cast until types regenerated
      const { data, error } = await (supabase.from("profiles") as any)
        .select("dietary_restrictions, allergies")
        .eq("id", u.id)
        .single();
      if (error) throw error;
      return {
        dietaryRestrictions: (data?.dietary_restrictions ?? []) as string[],
        allergies: (data?.allergies ?? []) as string[],
      };
    },
    enabled: !authLoading && !!user,
  });
};

export const useSetMyDietaryProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: { dietaryRestrictions: string[]; allergies: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase.from("profiles") as any)
        .update({
          dietary_restrictions: profile.dietaryRestrictions,
          allergies: profile.allergies,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-dietary-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

// ── Recipe Reaction Hooks ──

export const useRecipeReactions = (recipeIds: string[]) => {
  return useQuery({
    queryKey: ["recipe-reactions", recipeIds],
    queryFn: () => apiClient.getRecipeReactions(recipeIds),
    enabled: recipeIds.length > 0,
  });
};

export const useToggleRecipeReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      recipeId: string;
      reaction: 'thumbs_up' | 'thumbs_down';
      familyMemberId?: string;
    }) => apiClient.toggleRecipeReaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe-reactions"] });
    },
  });
};

// ── Admin Hooks ──

export const useAdminUsers = () => {
  const { isAdmin } = useAuthStore();
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiClient.adminGetAllUsers(),
    enabled: isAdmin,
  });
};

export const useAdminInvites = () => {
  const { isAdmin } = useAuthStore();
  return useQuery({
    queryKey: ["admin", "invites"],
    queryFn: () => apiClient.adminGetAllInvites(),
    enabled: isAdmin,
  });
};

export const useAdminHouseholds = () => {
  const { isAdmin } = useAuthStore();
  return useQuery({
    queryKey: ["admin", "households"],
    queryFn: () => apiClient.adminGetAllHouseholds(),
    enabled: isAdmin,
  });
};

export const useAdminDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiClient.adminDeleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
};

export const useAdminUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: { display_name?: string; setup_completed?: boolean } }) =>
      apiClient.adminUpdateUser(userId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
};

export const useAdminDeleteInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => apiClient.adminDeleteInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
};

export const useAdminRemoveHouseholdMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => apiClient.adminRemoveHouseholdMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
};

export const useAdminDeleteHousehold = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (householdId: string) => apiClient.adminDeleteHousehold(householdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
};

// ── Bulk Recipe Action Hooks (MOP-0028) ──

export const useBulkUpdateRecipeVisibility = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeIds, visibility }: { recipeIds: string[]; visibility: 'private' | 'household' | 'public' }) =>
      apiClient.bulkUpdateRecipeVisibility(recipeIds, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};

export const useBulkDeleteRecipes = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeIds: string[]) => apiClient.bulkDeleteRecipes(recipeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};

export const useBulkAddToCollection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, recipeIds }: { collectionId: string; recipeIds: string[] }) =>
      apiClient.bulkAddToCollection(collectionId, recipeIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collections", variables.collectionId, "recipes"] });
    },
  });
};

// ── Direct Recipe Sharing Hooks (MOP-0031) ──

export const useSharedWithMe = () => {
  const { user, isLoading: authLoading } = useAuthStore();
  return useQuery({
    queryKey: ["shared-with-me"],
    queryFn: () => apiClient.getSharedWithMe(),
    enabled: !authLoading && !!user,
    staleTime: QUERY_STALE_TIME.domain,
  });
};

export const useUnseenShareCount = () => {
  const { user, isLoading: authLoading } = useAuthStore();
  return useQuery({
    queryKey: ["unseen-share-count"],
    queryFn: () => apiClient.getUnseenShareCount(),
    enabled: !authLoading && !!user,
    staleTime: 30_000,
  });
};

export const useShareRecipe = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, targetIdentifier }: { recipeId: string; targetIdentifier: string }) =>
      apiClient.shareRecipe(recipeId, targetIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-with-me"] });
      queryClient.invalidateQueries({ queryKey: ["unseen-share-count"] });
    },
  });
};

export const useUnshareRecipe = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, sharedWithUserId }: { recipeId: string; sharedWithUserId: string }) =>
      apiClient.unshareRecipe(recipeId, sharedWithUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-with-me"] });
      queryClient.invalidateQueries({ queryKey: ["unseen-share-count"] });
    },
  });
};

export const useMarkShareSeen = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => apiClient.markShareSeen(shareId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unseen-share-count"] });
      queryClient.invalidateQueries({ queryKey: ["shared-with-me"] });
    },
  });
};
