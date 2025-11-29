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

// Intent detection utility
export const detectIntent = (message: string): string => {
  const lowerMessage = message.toLowerCase();
  
  // Recipe extraction keywords
  const recipeKeywords = [
    'recipe', 'ingredients', 'instructions', 'cook', 'bake', 'prepare',
    'add recipe', 'save recipe', 'extract recipe', 'recipe from'
  ];
  
  // Recipe search keywords
  const searchKeywords = [
    'find recipe', 'search recipe', 'recipe with', 'recipes containing',
    'show me recipes', 'what recipes', 'recommend recipe', 'suggest recipe'
  ];
  
  // Ingredient search keywords
  const ingredientKeywords = [
    'recipes with', 'what can i make with', 'ingredients i have',
    'using these ingredients', 'cook with'
  ];
  
  // General cooking questions
  const cookingKeywords = [
    'how to cook', 'cooking tips', 'cooking advice', 'meal planning',
    'what should i cook', 'dinner ideas', 'lunch ideas'
  ];
  
  if (recipeKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'recipe_extraction';
  }
  
  if (searchKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'recipe_search';
  }
  
  if (ingredientKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'ingredient_search';
  }
  
  if (cookingKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'cooking_advice';
  }
  
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
