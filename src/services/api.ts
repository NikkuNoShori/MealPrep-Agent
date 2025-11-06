import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { recipeService } from "./recipeService";

// Use local development API for localhost, production API for deployed app
const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "app.localhost"
    ? "http://localhost:3000" // Local development API
    : (import.meta as any).env?.VITE_API_URL ||
      "https://meal-prep-agent-405dzxcab-nickneal1717s-projects.vercel.app";

// API client
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

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

  // Recipe endpoints - using centralized service layer
  async getRecipes(params?: { limit?: number; offset?: number }) {
    return await recipeService.getRecipes(params);
  }

  async getRecipe(id: string) {
    return await recipeService.getRecipe(id);
  }

  async createRecipe(data: any) {
    return await recipeService.createRecipe(data);
  }

  async updateRecipe(id: string, data: any) {
    return await recipeService.updateRecipe(id, data);
  }

  async deleteRecipe(id: string) {
    return await recipeService.deleteRecipe(id);
  }

  async searchRecipes(query: string, limit?: number) {
    const searchParams = new URLSearchParams({ query });
    if (limit) searchParams.append("limit", limit.toString());

    return this.request(
      `/api/recipes/search/${query}?${searchParams.toString()}`
    );
  }

  // Chat endpoints
  async sendMessage(data: {
    message: string;
    context?: any;
    sessionId?: string;
    clearMemory?: boolean;
    intent?: string;
  }) {
    return this.request("/api/chat/message", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async addRecipeViaChat(data: { recipeText: string }) {
    return this.request("/api/chat/add-recipe", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getChatHistory(limit?: number) {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.append("limit", limit.toString());

    return this.request(`/api/chat/history?${searchParams.toString()}`);
  }

  async clearChatHistory() {
    return this.request("/api/chat/history", {
      method: "DELETE",
    });
  }

  // Meal planning endpoints
  async getMealPlans(limit?: number) {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.append("limit", limit.toString());

    return this.request(`/api/meal-plans?${searchParams.toString()}`);
  }

  async createMealPlan(data: {
    startDate: string;
    endDate: string;
    preferences: any;
  }) {
    return this.request("/api/meal-plans", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Receipt endpoints
  async getReceipts(limit?: number) {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.append("limit", limit.toString());

    return this.request(`/api/receipts?${searchParams.toString()}`);
  }

  async uploadReceipt(data: { imageUrl: string; storeInfo: any }) {
    return this.request("/api/receipts/upload", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Preferences endpoints
  async getPreferences() {
    return this.request("/api/preferences");
  }

  async updatePreferences(data: any) {
    return this.request("/api/preferences", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // RAG endpoints
  async ragSearch(request: any) {
    return this.request('/api/rag/search', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async ragEmbedding(request: any) {
    return this.request('/api/rag/embedding', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async ragSimilar(recipeId: string, userId: string, limit: number = 5) {
    return this.request(`/api/rag/similar/${recipeId}?userId=${userId}&limit=${limit}`);
  }

  async ragIngredients(ingredients: string[], userId: string, limit: number = 10) {
    return this.request('/api/rag/ingredients', {
      method: 'POST',
      body: JSON.stringify({ ingredients, userId, limit }),
    });
  }

  async ragRecommendations(userId: string, preferences?: any, limit: number = 10) {
    return this.request('/api/rag/recommendations', {
      method: 'POST',
      body: JSON.stringify({ userId, preferences, limit }),
    });
  }
}

// Create singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

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
