import { apiClient } from "./api";
import { useState, useCallback } from "react";

export interface RecipeSearchResult {
  id: string;
  title: string;
  description?: string;
  ingredients: any[];
  instructions: any[];
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  difficulty?: string;
  cuisine?: string;
  dietaryTags?: string[];
  similarityScore: number;
  searchableText: string;
}

export interface RAGSearchRequest {
  query: string;
  userId: string;
  limit?: number;
  searchType?: 'semantic' | 'text' | 'hybrid';
}

export interface RAGSearchResponse {
  results: RecipeSearchResult[];
  total: number;
  searchType: string;
  query: string;
}

export interface RecipeEmbeddingRequest {
  recipeId: string;
  text: string;
}

export interface RecipeEmbeddingResponse {
  success: boolean;
  embedding?: number[];
  error?: string;
}

// RAG Service for recipe search and retrieval
export const ragService = {
  // Search recipes using semantic similarity
  async searchRecipes(request: RAGSearchRequest): Promise<RAGSearchResponse> {
    return apiClient.ragSearch(request) as Promise<RAGSearchResponse>;
  },

  // Generate embeddings for a recipe
  async generateEmbedding(request: RecipeEmbeddingRequest): Promise<RecipeEmbeddingResponse> {
    return apiClient.ragEmbedding(request) as Promise<RecipeEmbeddingResponse>;
  },

  // Get similar recipes based on a recipe ID
  async getSimilarRecipes(recipeId: string, userId: string, limit: number = 5): Promise<RecipeSearchResult[]> {
    return apiClient.ragSimilar(recipeId, userId, limit) as Promise<RecipeSearchResult[]>;
  },

  // Search by ingredients
  async searchByIngredients(ingredients: string[], userId: string, limit: number = 10): Promise<RecipeSearchResult[]> {
    return apiClient.ragIngredients(ingredients, userId, limit) as Promise<RecipeSearchResult[]>;
  },

  // Get recipe recommendations based on user preferences
  async getRecommendations(userId: string, preferences?: any, limit: number = 10): Promise<RecipeSearchResult[]> {
    return apiClient.ragRecommendations(userId, preferences, limit) as Promise<RecipeSearchResult[]>;
  }
};

// React hooks for RAG functionality
export const useRAGSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRecipes = useCallback(async (request: RAGSearchRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await ragService.searchRecipes(request);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    searchRecipes,
    loading,
    error,
  };
};

export const useSimilarRecipes = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSimilarRecipes = useCallback(async (recipeId: string, userId: string, limit: number = 5) => {
    setLoading(true);
    setError(null);
    try {
      const response = await ragService.getSimilarRecipes(recipeId, userId, limit);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get similar recipes");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    getSimilarRecipes,
    loading,
    error,
  };
};

export const useIngredientSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchByIngredients = useCallback(async (ingredients: string[], userId: string, limit: number = 10) => {
    setLoading(true);
    setError(null);
    try {
      const response = await ragService.searchByIngredients(ingredients, userId, limit);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingredient search failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    searchByIngredients,
    loading,
    error,
  };
};

/**
 * Client-side intent detection utility
 * 
 * NOTE: This is a lightweight client-side hint for logging/debugging only.
 * The server performs AI-powered intent detection which is authoritative.
 * 
 * Server-side intents: 'recipe_extraction' | 'rag_search' | 'general_chat'
 * 
 * This function provides a quick client-side hint but should not be used
 * for routing decisions - the server's AI detection is the source of truth.
 */
export const detectIntent = (message: string): 'recipe_extraction' | 'rag_search' | 'general_chat' => {
  const lowerMessage = message.toLowerCase().trim();
  
  // Recipe extraction keywords - user wants to ADD/SAVE a recipe
  const recipeExtractionKeywords = [
    'add recipe', 'save recipe', 'extract recipe', 'recipe from',
    'save it', 'save this', 'can you save', 'save that', 'save the recipe',
    'add this recipe', 'add a recipe', 'new recipe', 'recipe:',
    // Common patterns when pasting recipe content
    'ingredients:', 'instructions:', 'directions:', 'prep time', 'cook time'
  ];
  
  // RAG search keywords - user wants to FIND/SEARCH existing recipes
  const ragSearchKeywords = [
    'find recipe', 'search recipe', 'recipe with', 'recipes containing',
    'show me recipes', 'what recipes', 'recommend recipe', 'suggest recipe',
    'recipes i have', 'my recipes', 'saved recipes', 'recipe collection',
    'what can i make with', 'recipes using', 'recipes that have'
  ];
  
  // Check for explicit recipe extraction intent (highest priority)
  if (recipeExtractionKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'recipe_extraction';
  }
  
  // Check for recipe search intent
  if (ragSearchKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'rag_search';
  }
  
  // Default to general chat
  // Note: Server-side AI detection will make the final decision
  return 'general_chat';
};

// Context formatting for RAG
export const formatRecipeContext = (recipes: RecipeSearchResult[]): string => {
  if (recipes.length === 0) {
    return "No relevant recipes found in your database.";
  }
  
  return recipes.map(recipe => {
    const ingredients = recipe.ingredients.map((ing: any) => 
      `${ing.amount || ''} ${ing.unit || ''} ${ing.item}${ing.notes ? ` (${ing.notes})` : ''}`
    ).join(', ');
    
    const instructions = recipe.instructions.join(' | ');
    
    return `
Recipe: ${recipe.title}
Description: ${recipe.description || 'No description'}
Ingredients: ${ingredients}
Instructions: ${instructions}
Prep Time: ${recipe.prepTime || 'Not specified'}
Cook Time: ${recipe.cookTime || 'Not specified'}
Servings: ${recipe.servings || 'Not specified'}
Difficulty: ${recipe.difficulty || 'Not specified'}
Cuisine: ${recipe.cuisine || 'Not specified'}
Dietary Tags: ${recipe.dietaryTags?.join(', ') || 'None'}
Similarity Score: ${recipe.similarityScore.toFixed(3)}
---`;
  }).join('\n');
};
