import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from './supabase';

// Supabase configuration - reuse from supabase.ts
// @ts-ignore - Vite environment variables
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
// @ts-ignore - Vite environment variables  
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

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
  isPublic: 'is_public',
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
  is_public: 'isPublic',
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

  async getRecipe(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id) // user_id references profiles(id) = auth.users(id)
      .single();

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

  async createRecipe(data: any) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Check for duplicate recipe name
    const isDuplicate = await this.checkDuplicateRecipe(data.title);
    if (isDuplicate) {
      throw new Error(
        `A recipe with the name "${data.title}" already exists. Please choose a different name.`
      );
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

    const { data: recipe, error } = await supabase
      .from("recipes")
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

  // Chat endpoints - using Supabase edge function
  async sendMessage(data: {
    message: string;
    context?: any;
    sessionId?: string;
    clearMemory?: boolean;
    intent?: string;
  }) {
    // Supabase edge function path: /functions/v1/chat-api/message
    return this.request(`${SUPABASE_FUNCTIONS_URL}/chat-api/message`, {
      method: "POST",
      body: JSON.stringify(data),
    });
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
    return this.request(
      `${SUPABASE_FUNCTIONS_URL}/chat-api/history?${searchParams.toString()}`
    );
  }

  async clearChatHistory() {
    // Supabase edge function path: /functions/v1/chat-api/history
    return this.request(`${SUPABASE_FUNCTIONS_URL}/chat-api/history`, {
      method: "DELETE",
    });
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

    const { data: mealPlan, error } = await supabase
      .from("meal_plans")
      .insert({
        ...data,
        user_id: user.id, // user_id references profiles(id) = auth.users(id)
      })
      .select()
      .single();

    if (error) throw error;
    return mealPlan;
  }

  // Receipt endpoints - using Supabase client directly
  // Note: user_id references profiles(id), which references auth.users(id)
  async getReceipts(limit?: number) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    let query = supabase
      .from("receipts")
      .select("*")
      .eq("user_id", user.id) // user_id references profiles(id) = auth.users(id)
      .order("created_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { receipts: data || [] };
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

  async uploadReceipt(data: { imageUrl: string; storeInfo: any }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: receipt, error } = await supabase
      .from("receipts")
      .insert({
        ...data,
        user_id: user.id, // user_id references profiles(id) = auth.users(id)
      })
      .select()
      .single();

    if (error) throw error;
    return receipt;
  }

  // Preferences endpoints - using Supabase client directly
  // Note: user_id references profiles(id), which references auth.users(id)
  async getPreferences() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

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
        .select(
          "id, user_id, global_restrictions, cuisine_preferences, cooking_skill_level, dietary_goals, spice_tolerance, meal_prep_preference, budget_range, time_constraints, created_at, updated_at"
        )
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
      .single();

    if (existing) {
      const { data: updated, error } = await supabase
        .from("user_preferences")
        .update(data)
        .eq("user_id", user.id) // user_id references profiles(id) = auth.users(id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } else {
      const { data: created, error } = await supabase
        .from("user_preferences")
        .insert({ ...data, user_id: user.id }) // user_id references profiles(id) = auth.users(id)
        .select()
        .single();
      if (error) throw error;
      return created;
    }
  }

  // RAG endpoints - using local server for now (can be migrated to Supabase edge function later)
  async ragSearch(request: any) {
    const baseUrl = isLocalhost ? LOCAL_API_URL : SUPABASE_FUNCTIONS_URL;
    return this.request(`${baseUrl}/rag/search`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async ragEmbedding(request: any) {
    const baseUrl = isLocalhost ? LOCAL_API_URL : SUPABASE_FUNCTIONS_URL;
    return this.request(`${baseUrl}/rag/embedding`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async ragSimilar(recipeId: string, userId: string, limit: number = 5) {
    const baseUrl = isLocalhost ? LOCAL_API_URL : SUPABASE_FUNCTIONS_URL;
    return this.request(
      `${baseUrl}/rag/similar/${recipeId}?userId=${userId}&limit=${limit}`
    );
  }

  async ragIngredients(
    ingredients: string[],
    userId: string,
    limit: number = 10
  ) {
    const baseUrl = isLocalhost ? LOCAL_API_URL : SUPABASE_FUNCTIONS_URL;
    return this.request(`${baseUrl}/rag/ingredients`, {
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
    return this.request(`${baseUrl}/rag/recommendations`, {
      method: "POST",
      body: JSON.stringify({ userId, preferences, limit }),
    });
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
    mutationFn: (data: any) => apiClient.createRecipe(data),
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
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () => apiClient.getPreferences(),
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
