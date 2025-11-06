/**
 * Recipe Service
 * Centralized service layer for recipe API operations
 * Provides a clean interface for all recipe CRUD operations
 */

// Use local development API for localhost, production API for deployed app
const API_BASE_URL =
  typeof window !== 'undefined' && (window.location.hostname === "localhost" || window.location.hostname === "app.localhost")
    ? "http://localhost:3000" // Local development API
    : (import.meta as any).env?.VITE_API_URL ||
      "https://meal-prep-agent-405dzxcab-nickneal1717s-projects.vercel.app";

/**
 * Centralized API request handler
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const recipeService = {
  /**
   * Get all recipes for the current user (or public recipes if not authenticated)
   * @param params Optional query parameters (limit, offset, publicOnly)
   * @returns Promise with recipes array and total count
   */
  async getRecipes(params?: { limit?: number; offset?: number; publicOnly?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.publicOnly) searchParams.append('publicOnly', 'true');
    
    const queryString = searchParams.toString();
    const endpoint = `/api/recipes${queryString ? `?${queryString}` : ''}`;
    
    return request<{ recipes: any[]; total: number }>(endpoint, {
      method: 'GET',
    });
  },

  /**
   * Get a single recipe by ID or slug
   * Works for both authenticated users (their recipes + public) and unauthenticated users (public only)
   * @param idOrSlug Recipe UUID or slug (e.g., "chocolate-chip-cookies")
   * @returns Promise with recipe object
   */
  async getRecipe(idOrSlug: string) {
    if (!idOrSlug) {
      throw new Error('Recipe ID or slug is required');
    }
    
    const response = await request<{ recipe: any }>(`/api/recipes/${idOrSlug}`, {
      method: 'GET',
    });
    
    return response.recipe;
  },

  /**
   * Create a new recipe
   * @param recipeData Recipe data object
   * @returns Promise with created recipe
   */
  async createRecipe(recipeData: any) {
    if (!recipeData) {
      throw new Error('Recipe data is required');
    }
    
    const response = await request<{ message: string; recipe: any }>('/api/recipes', {
      method: 'POST',
      body: JSON.stringify({ recipe: recipeData }),
    });
    
    return response.recipe;
  },

  /**
   * Update an existing recipe
   * @param id Recipe UUID
   * @param recipeData Partial recipe data to update
   * @returns Promise with updated recipe
   */
  async updateRecipe(id: string, recipeData: any) {
    if (!id) {
      throw new Error('Recipe ID is required');
    }
    if (!recipeData) {
      throw new Error('Recipe data is required');
    }
    
    const response = await request<{ message: string; recipe: any }>(`/api/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(recipeData),
    });
    
    return response.recipe;
  },

  /**
   * Delete a recipe
   * @param id Recipe UUID
   * @returns Promise with success message
   */
  async deleteRecipe(id: string) {
    if (!id) {
      throw new Error('Recipe ID is required');
    }
    
    const response = await request<{ message: string }>(`/api/recipes/${id}`, {
      method: 'DELETE',
    });
    
    return response;
  },

  /**
   * Search recipes (RAG search)
   * @param query Search query string
   * @param options Optional search options (userId, limit, searchType)
   * @returns Promise with search results
   */
  async searchRecipes(
    query: string,
    options?: {
      userId?: string;
      limit?: number;
      searchType?: 'semantic' | 'text' | 'hybrid';
    }
  ) {
    if (!query) {
      throw new Error('Search query is required');
    }
    
    return request<{
      results: any[];
      total: number;
      searchType: string;
      query: string;
    }>('/api/rag/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        limit: options?.limit || 10,
        searchType: options?.searchType || 'hybrid',
        // userId will be set by backend from authentication
      }),
    });
  },
};

