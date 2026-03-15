import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from './supabase';
import { useAuthStore } from '@/stores/authStore';
import { Logger } from './logger';

// Supabase configuration - reuse from supabase.ts
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

// Supabase Edge Functions base URL
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// For local development, use local server for RAG endpoints
const LOCAL_API_URL = "http://localhost:3000";
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Transformation utilities: Convert between camelCase (frontend) and snake_case (database)
// Field mapping for recipe-specific transformations
const RECIPE_FIELD_MAP: Record<string, string> = {
  // camelCase -> snake_case
  prepTime: 'prep_time',
  cookTime: 'cook_time',
  totalTime: 'total_time',
  imageUrl: 'image_url',
  nutritionInfo: 'nutrition_info',
  sourceUrl: 'source_url',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  userId: 'user_id',
  // snake_case -> camelCase (reverse mapping)
  prep_time: 'prepTime',
  cook_time: 'cookTime',
  total_time: 'totalTime',
  image_url: 'imageUrl',
  nutrition_info: 'nutritionInfo',
  source_url: 'sourceUrl',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  user_id: 'userId',
};

const toSnakeCase = (key: string): string => {
  // Use mapping if available
  if (RECIPE_FIELD_MAP[key]) {
    const mapped = RECIPE_FIELD_MAP[key];
    // Only return if it's a snake_case mapping (contains underscore)
    if (mapped.includes('_')) return mapped;
  }
  // Fallback to regex transformation
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

const toCamelCase = (key: string): string => {
  // Use mapping if available
  if (RECIPE_FIELD_MAP[key]) {
    const mapped = RECIPE_FIELD_MAP[key];
    // Only return if it's a camelCase mapping (no underscore)
    if (!mapped.includes('_')) return mapped;
  }
  // Fallback to regex transformation
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Transform object keys from snake_case to camelCase
const snakeToCamel = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object') return obj;
  
  const camelObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    camelObj[camelKey] = snakeToCamel(value);
  }
  return camelObj;
};

// Transform object keys from camelCase to snake_case
const camelToSnake = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj !== 'object') return obj;
  
  const snakeObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip userId as it's handled separately in createRecipe
    if (key === 'userId') continue;
    const snakeKey = toSnakeCase(key);
    snakeObj[snakeKey] = camelToSnake(value);
  }
  return snakeObj;
};

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
      throw new Error(error.error || `HTTP ${response.status}`);
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
      .eq("user_id", user.id) // user_id references profiles(id) = auth.users(id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Transform snake_case to camelCase
    const camelRecipes = (data || []).map(snakeToCamel);
    return { recipes: camelRecipes, total: camelRecipes.length };
  }

  async getRecipe(idOrSlug: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Determine if the input is a UUID or a slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    let query = supabase
      .from("recipes")
      .select("*")
      .eq("user_id", user.id);

    if (isUuid) {
      query = query.eq("id", idOrSlug);
    } else {
      query = query.eq("slug", idOrSlug);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

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

    const { data: recipe, error } = await (supabase
      .from("recipes") as any)
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

  async searchRecipes(query: string, limit?: number) {
    // Use RAG search for recipe search
    return this.ragSearch({
      query,
      userId: (await supabase.auth.getUser()).data.user?.id || "anonymous",
      limit: limit || 10,
      searchType: "hybrid",
    });
  }

  // Chat endpoints - using Supabase Edge Function (secure, API key protected)
  // The Edge Function handles OpenRouter calls server-side, keeping the API key secure
  async sendMessage(data: {
    message: string;
    context?: any;
    sessionId?: string;
    clearMemory?: boolean;
    intent?: string;
    images?: string[]; // Array of base64 data URLs
  }) {
    const startTime = Date.now();
    const endpoint = `${SUPABASE_FUNCTIONS_URL}/chat-api/message`;
    
    Logger.chat.apiCall(endpoint, 'POST', undefined, undefined);
    Logger.chat.messageSent(
      data.context?.conversationId || 'new',
      data.sessionId || 'unknown',
      data.message,
      data.intent,
      data.images?.length
    );

    try {
      const response = await this.request(endpoint, {
        method: "POST",
        body: JSON.stringify(data),
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
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const statusCode = error?.status || error?.response?.status || 500;
      Logger.chat.apiCall(endpoint, 'POST', statusCode, duration, error?.message);
      Logger.chat.error('sendMessage', error, {
        sessionId: data.sessionId,
        intent: data.intent,
        messageLength: data.message.length,
      });
      throw error;
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

  // Meal planning endpoints - using Supabase client directly
  // Note: user_id references profiles(id), which references auth.users(id)
  async getMealPlans(limit?: number) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    let query = supabase
      .from("meal_plans")
      .select("*")
      .eq("user_id", user.id) // user_id references profiles(id) = auth.users(id)
      .order("created_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { mealPlans: data || [] };
  }

  async createMealPlan(data: {
    startDate: string;
    endDate: string;
    preferences: any;
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: mealPlan, error } = await (supabase
      .from("meal_plans") as any)
      .insert({
        ...data,
        user_id: user.id, // user_id references profiles(id) = auth.users(id)
      })
      .select()
      .single();

    if (error) throw error;
    return mealPlan;
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
    const { data, error } = await supabase.storage
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
      let { data, error } = await supabase
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
    } catch (error: any) {
      // Handle any unexpected errors (like network issues) gracefully
      console.warn("Error in getPreferences:", error.message);
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
      const { data: updated, error } = await (supabase
        .from("user_preferences") as any)
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
        const { measurement_system, ...dataWithoutMeasurement } = updateData;
        const { data: updatedFallback, error: fallbackError } = await (supabase
          .from("user_preferences") as any)
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
        const { measurement_system, ...dataWithoutMeasurement } = updateData;
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

  // RAG endpoints - using local server for now (can be migrated to Supabase edge function later)
  async ragSearch(request: any) {
    const baseUrl = isLocalhost ? LOCAL_API_URL : SUPABASE_FUNCTIONS_URL;
    const path = isLocalhost ? "/api/rag/search" : "/rag/search";
    return this.request(`${baseUrl}${path}`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async ragEmbedding(request: any) {
    const baseUrl = isLocalhost ? LOCAL_API_URL : SUPABASE_FUNCTIONS_URL;
    const path = isLocalhost ? "/api/rag/embedding" : "/rag/embedding";
    return this.request(`${baseUrl}${path}`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async ragSimilar(recipeId: string, userId: string, limit: number = 5) {
    const baseUrl = isLocalhost ? LOCAL_API_URL : SUPABASE_FUNCTIONS_URL;
    const path = isLocalhost
      ? `/api/rag/similar/${recipeId}`
      : `/rag/similar/${recipeId}`;
    return this.request(`${baseUrl}${path}?userId=${userId}&limit=${limit}`);
  }

  async ragIngredients(
    ingredients: string[],
    userId: string,
    limit: number = 10
  ) {
    const baseUrl = isLocalhost ? LOCAL_API_URL : SUPABASE_FUNCTIONS_URL;
    const path = isLocalhost ? "/api/rag/ingredients" : "/rag/ingredients";
    return this.request(`${baseUrl}${path}`, {
      method: "POST",
      body: JSON.stringify({ ingredients, userId, limit }),
    });
  }

  async ragRecommendations(
    userId: string,
    preferences?: any,
    limit: number = 10
  ) {
    const baseUrl = isLocalhost ? LOCAL_API_URL : SUPABASE_FUNCTIONS_URL;
    const path = isLocalhost
      ? "/api/rag/recommendations"
      : "/rag/recommendations";
    return this.request(`${baseUrl}${path}`, {
      method: "POST",
      body: JSON.stringify({ userId, preferences, limit }),
    });
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

  async ingestRecipeFromUrl(url: string, autoSave = true) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/recipe-pipeline/ingest`, {
      method: "POST",
      body: JSON.stringify({ source_type: "url", url, auto_save: autoSave }),
    });
  }

  async ingestRecipeFromText(text: string, images?: string[], autoSave = true) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/recipe-pipeline/ingest`, {
      method: "POST",
      body: JSON.stringify({ source_type: "text", text, images, auto_save: autoSave }),
    });
  }

  async ingestRecipeFromVideo(
    data: { video_url?: string; frame_urls?: string[]; transcript?: string },
    autoSave = true
  ) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/recipe-pipeline/ingest`, {
      method: "POST",
      body: JSON.stringify({ source_type: "video", ...data, auto_save: autoSave }),
    });
  }

  async extractRecipeOnly(
    sourceType: "url" | "text" | "video",
    data: Record<string, any>
  ) {
    return this.request(`${SUPABASE_FUNCTIONS_URL}/recipe-pipeline/extract-only`, {
      method: "POST",
      body: JSON.stringify({ source_type: sourceType, ...data }),
    });
  }

  // ── Household endpoints ──

  async getMyHousehold() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Get the first household this user belongs to (v1 assumes one household per user)
    // Note: "as any" casts needed until supabase types are regenerated with new tables
    const { data: membership, error: memError } = await (supabase
      .from("household_members") as any)
      .select("household_id, role, households(id, name, created_by, created_at, updated_at)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memError) throw memError;
    if (!membership) return null;

    // Get all members of this household
    const { data: members, error: membersError } = await (supabase
      .from("household_members") as any)
      .select("id, user_id, role, joined_at, profiles(id, email, display_name, avatar_url)")
      .eq("household_id", membership.household_id);

    if (membersError) throw membersError;

    // Get dependents (family_members) in this household
    const { data: dependents, error: depsError } = await (supabase
      .from("family_members") as any)
      .select("*")
      .eq("household_id", membership.household_id)
      .eq("is_active", true);

    if (depsError) throw depsError;

    // Get pending/sent invites for this household
    const { data: invites } = await (supabase
      .from("household_invites") as any)
      .select("id, invited_email, inviter_name, status, created_at, expires_at")
      .eq("household_id", membership.household_id)
      .in("status", ["pending"])
      .order("created_at", { ascending: false });

    return {
      household: snakeToCamel(membership.households),
      myRole: membership.role,
      members: (members || []).map((m: any) => snakeToCamel(m)),
      dependents: (dependents || []).map((d: any) => snakeToCamel(d)),
      pendingInvites: (invites || []).map((i: any) => snakeToCamel(i)),
    };
  }

  async updateHousehold(householdId: string, data: { name: string }) {
    const { data: household, error } = await (supabase
      .from("households") as any)
      .update({ name: data.name })
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Get user's email to find invites
    const { data: profile } = await (supabase
      .from("profiles") as any)
      .select("email")
      .eq("id", user.id)
      .single();

    if (!profile) return [];

    const { data: invites, error } = await (supabase
      .from("household_invites") as any)
      .select("*, households(id, name)")
      .eq("invited_email", (profile as any).email)
      .eq("status", "pending");

    if (error) throw error;
    return (invites || []).map((i: any) => snakeToCamel(i));
  }

  async respondToInvite(inviteId: string, accept: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Update invite status
    const { data: invite, error: updateError } = await (supabase
      .from("household_invites") as any)
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", inviteId)
      .select("*, households(id, name)")
      .single();

    if (updateError) throw updateError;

    // If accepted, add user to household
    if (accept && invite) {
      const { error: joinError } = await (supabase
        .from("household_members") as any)
        .insert({
          household_id: invite.household_id,
          user_id: user.id,
          role: "member",
        });

      if (joinError) throw joinError;
    }

    return snakeToCamel(invite);
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

    const { data: member, error } = await (supabase
      .from("family_members") as any)
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
    preferences?: Record<string, any>;
  }) {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.relationship !== undefined) payload.relationship = updates.relationship;
    if (updates.age !== undefined) payload.age = updates.age;
    if (updates.dietaryRestrictions !== undefined) payload.dietary_restrictions = updates.dietaryRestrictions;
    if (updates.allergies !== undefined) payload.allergies = updates.allergies;
    if (updates.preferences !== undefined) payload.preferences = updates.preferences;

    const { data: member, error } = await (supabase
      .from("family_members") as any)
      .update(payload)
      .eq("id", memberId)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamel(member);
  }

  async deleteFamilyMember(memberId: string) {
    const { error } = await (supabase
      .from("family_members") as any)
      .update({ is_active: false })
      .eq("id", memberId);

    if (error) throw error;
  }

  // ── Recipe Reactions ──

  async getRecipeReactions(recipeIds: string[]) {
    if (recipeIds.length === 0) return [];

    const { data, error } = await (supabase
      .from("recipe_reactions") as any)
      .select("id, recipe_id, user_id, family_member_id, reaction, family_members(id, name)")
      .in("recipe_id", recipeIds);

    if (error) throw error;

    // Fetch display names for user reactions (no FK from recipe_reactions to profiles)
    const userIds = [...new Set((data || []).filter((r: any) => r.user_id).map((r: any) => r.user_id))];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await (supabase
        .from("profiles") as any)
        .select("id, display_name")
        .in("id", userIds);
      profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.display_name]));
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      recipeId: r.recipe_id,
      userId: r.user_id,
      familyMemberId: r.family_member_id,
      reaction: r.reaction,
      name: r.family_members?.name || profileMap[r.user_id] || "Unknown",
    }));
  }

  async toggleRecipeReaction(data: {
    recipeId: string;
    reaction: 'thumbs_up' | 'thumbs_down';
    familyMemberId?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const isForDependent = !!data.familyMemberId;
    const matchFilter: any = { recipe_id: data.recipeId };
    if (isForDependent) {
      matchFilter.family_member_id = data.familyMemberId;
    } else {
      matchFilter.user_id = user.id;
    }

    // Check for existing reaction
    const { data: existing } = await (supabase
      .from("recipe_reactions") as any)
      .select("id, reaction")
      .match(matchFilter)
      .maybeSingle();

    if (existing) {
      if (existing.reaction === data.reaction) {
        // Same reaction = remove it (toggle off)
        const { error } = await (supabase
          .from("recipe_reactions") as any)
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "removed" as const };
      } else {
        // Different reaction = update it
        const { error } = await (supabase
          .from("recipe_reactions") as any)
          .update({ reaction: data.reaction, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "updated" as const };
      }
    } else {
      // No existing reaction = insert
      const insertData: any = {
        recipe_id: data.recipeId,
        reaction: data.reaction,
      };
      if (isForDependent) {
        insertData.family_member_id = data.familyMemberId;
      } else {
        insertData.user_id = user.id;
      }

      const { error } = await (supabase
        .from("recipe_reactions") as any)
        .insert(insertData);
      if (error) throw error;
      return { action: "added" as const };
    }
  }

  async updateRecipeVisibility(recipeId: string, visibility: 'private' | 'household' | 'public') {
    const { error } = await (supabase
      .from("recipes") as any)
      .update({ visibility })
      .eq("id", recipeId);

    if (error) throw error;
    return { id: recipeId, visibility };
  }

  // ── Recipe Collections ──

  async getMyCollections() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await (supabase
      .from("recipe_collections") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data || []).map((c: any) => snakeToCamel(c));
  }

  async getCollection(collectionId: string) {
    const { data, error } = await (supabase
      .from("recipe_collections") as any)
      .select("*")
      .eq("id", collectionId)
      .single();

    if (error) throw error;
    return snakeToCamel(data);
  }

  async getCollectionRecipes(collectionId: string) {
    const { data, error } = await (supabase
      .from("collection_recipes") as any)
      .select("recipe_id, sort_order, added_at, recipes(*)")
      .eq("collection_id", collectionId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data || []).map((cr: any) => snakeToCamel(cr));
  }

  async createCollection(name: string, description?: string, icon?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await (supabase
      .from("recipe_collections") as any)
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
    const { data, error } = await (supabase
      .from("recipe_collections") as any)
      .update(updates)
      .eq("id", collectionId)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamel(data);
  }

  async deleteCollection(collectionId: string) {
    const { error } = await (supabase
      .from("recipe_collections") as any)
      .delete()
      .eq("id", collectionId);

    if (error) throw error;
  }

  async addRecipeToCollection(collectionId: string, recipeId: string) {
    const { error } = await (supabase
      .from("collection_recipes") as any)
      .insert({ collection_id: collectionId, recipe_id: recipeId });

    if (error) throw error;
  }

  async removeRecipeFromCollection(collectionId: string, recipeId: string) {
    const { error } = await (supabase
      .from("collection_recipes") as any)
      .delete()
      .eq("collection_id", collectionId)
      .eq("recipe_id", recipeId);

    if (error) throw error;
  }

  // ── Household Recipes ──

  async getHouseholdRecipes(params?: { limit?: number; offset?: number }) {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Get user's household ID
    const { data: membership } = await (supabase
      .from("household_members") as any)
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) return { recipes: [], total: 0 };

    // Get all household member IDs
    const { data: members } = await (supabase
      .from("household_members") as any)
      .select("user_id")
      .eq("household_id", membership.household_id);

    const memberIds = (members || []).map((m: any) => m.user_id);

    // Fetch recipes from household members shared with the household
    const { data, error } = await (supabase
      .from("recipes") as any)
      .select("*, profiles!recipes_user_id_fkey(display_name, username, avatar_url)")
      .in("user_id", memberIds)
      .eq("visibility", "household")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const camelRecipes = (data || []).map((r: any) => {
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

    return { recipes: camelRecipes, total: camelRecipes.length };
  }

  // ── Public Recipes ──

  async getPublicRecipes(params?: { limit?: number; offset?: number }) {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    const { data, error } = await (supabase
      .from("recipes") as any)
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

    const { data, error } = await (supabase
      .from("profiles") as any)
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    return snakeToCamel(data);
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
    const { error } = await (supabase
      .from("household_members") as any)
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

  async updateUsername(username: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Validate format
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      throw new Error("Username must be 3-30 characters, lowercase letters, numbers, and underscores only");
    }

    const { data, error } = await (supabase
      .from("profiles") as any)
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
  });
};

// Auth hooks
// Auth is now managed by Zustand store in src/stores/authStore

export const useRecipe = (id: string) => {
  return useQuery({
    queryKey: ["recipe", id],
    queryFn: () => apiClient.getRecipe(id),
    enabled: !!id,
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

export const useSearchRecipes = (query: string, limit?: number) => {
  return useQuery({
    queryKey: ["recipes", "search", query, limit],
    queryFn: () => apiClient.searchRecipes(query, limit),
    enabled: !!query,
  });
};

export const useChatHistory = (limit?: number) => {
  return useQuery({
    queryKey: ["chat", "history", limit],
    queryFn: () => apiClient.getChatHistory(limit),
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      message: string;
      context?: any;
      sessionId?: string;
      clearMemory?: boolean;
      intent?: string;
      images?: string[]; // Array of base64 data URLs
    }) => apiClient.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "history"] });
    },
  });
};

export const useMealPlans = (limit?: number) => {
  return useQuery({
    queryKey: ["meal-plans", limit],
    queryFn: () => apiClient.getMealPlans(limit),
  });
};

export const useCreateMealPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      startDate: string;
      endDate: string;
      preferences: any;
    }) => apiClient.createMealPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
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
      updates: { name?: string; relationship?: string; age?: number | null; dietaryRestrictions?: string[]; allergies?: string[]; preferences?: Record<string, any> };
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
