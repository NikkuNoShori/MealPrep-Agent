// Database service using Supabase client
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for Node.js backend (uses process.env instead of import.meta.env)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  Supabase credentials not configured. Database operations may fail.');
  console.warn('⚠️  Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY) environment variables');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export class DatabaseService {
  constructor() {
    this.supabase = supabase;
  }

  // Recipe CRUD operations
  async getRecipes(userId, limit = 50, offset = 0) {
    const { data, error } = await this.supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    return data || [];
  }

  async getRecipe(recipeId, userId) {
    const { data, error } = await this.supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  async createRecipe(recipe) {
    const { data, error } = await this.supabase
      .from('recipes')
      .insert({
        user_id: recipe.user_id,
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        dietary_tags: recipe.dietary_tags || [],
        source_url: recipe.source_url,
        source_name: recipe.source_name,
        rating: recipe.rating,
        is_favorite: recipe.is_favorite || false
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateRecipe(recipeId, userId, updates) {
    // Remove fields that shouldn't be updated
    const { id, user_id, created_at, ...updateData } = updates;
    
    const { data, error } = await this.supabase
      .from('recipes')
      .update(updateData)
      .eq('id', recipeId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  async deleteRecipe(recipeId, userId) {
    const { error } = await this.supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .eq('user_id', userId);
    
    if (error) throw error;
    return true;
  }

  // Embedding operations
  async createEmbedding(embedding) {
    const { data, error } = await this.supabase
      .from('recipe_embeddings')
      .insert({
        recipe_id: embedding.recipe_id,
        embedding: embedding.embedding,
        text_content: embedding.text_content,
        embedding_type: embedding.embedding_type
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getEmbeddings(recipeId) {
    const { data, error } = await this.supabase
      .from('recipe_embeddings')
      .select('*')
      .eq('recipe_id', recipeId);
    
    if (error) throw error;
    return data || [];
  }

  async deleteEmbeddings(recipeId) {
    const { error } = await this.supabase
      .from('recipe_embeddings')
      .delete()
      .eq('recipe_id', recipeId);
    
    if (error) throw error;
  }

  // Vector similarity search - uses Supabase RPC
  async searchSimilarRecipes(queryEmbedding, userId, similarityThreshold = 0.7, maxResults = 10) {
    const { data, error } = await this.supabase.rpc('search_recipes_semantic', {
      query_embedding: queryEmbedding,
      user_id: userId,
      match_threshold: similarityThreshold,
      match_count: maxResults
    });
    
    if (error) throw error;
    return data || [];
  }

  // Full-text search - uses Supabase RPC
  async searchRecipesText(searchQuery, userId, maxResults = 10) {
    const { data, error } = await this.supabase.rpc('search_recipes_text', {
      search_query: searchQuery,
      user_uuid: userId,
      max_results: maxResults
    });
    
    if (error) throw error;
    return data || [];
  }

  // Hybrid search (combines vector and text search)
  async hybridSearch(queryEmbedding, searchQuery, userId, maxResults = 10) {
    // Get results from both searches
    const [vectorResults, textResults] = await Promise.all([
      this.searchSimilarRecipes(queryEmbedding, userId, 0.5, maxResults),
      this.searchRecipesText(searchQuery, userId, maxResults)
    ]);

    // Combine and deduplicate results
    const resultMap = new Map();
    
    // Add vector search results with higher weight
    vectorResults.forEach(result => {
      resultMap.set(result.recipe_id || result.id, {
        ...result,
        similarity_score: (result.similarity_score || 0) * 0.7 // Weight vector results
      });
    });

    // Add text search results
    textResults.forEach(result => {
      const existing = resultMap.get(result.recipe_id || result.id);
      if (existing) {
        // Combine scores if recipe appears in both results
        existing.rank_score = (result.rank_score || 0) * 0.3;
        existing.similarity_score = (existing.similarity_score || 0) + (result.rank_score || 0) * 0.3;
      } else {
        resultMap.set(result.recipe_id || result.id, {
          ...result,
          rank_score: (result.rank_score || 0) * 0.3 // Weight text results
        });
      }
    });

    // Sort by combined score and return top results
    return Array.from(resultMap.values())
      .sort((a, b) => {
        const scoreA = (a.similarity_score || 0) + (a.rank_score || 0);
        const scoreB = (b.similarity_score || 0) + (b.rank_score || 0);
        return scoreB - scoreA;
      })
      .slice(0, maxResults);
  }

  // Search by ingredients
  async searchByIngredients(ingredients, userId, maxResults = 10) {
    // Create a search query from ingredients
    const searchQuery = ingredients.join(' ');
    return this.searchRecipesText(searchQuery, userId, maxResults);
  }

  // Get recipe recommendations based on user preferences
  async getRecommendations(userId, preferences = {}, maxResults = 10) {
    let query = this.supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId);

    // Add filters based on preferences
    if (preferences.cuisine) {
      query = query.eq('cuisine', preferences.cuisine);
    }

    if (preferences.difficulty) {
      query = query.eq('difficulty', preferences.difficulty);
    }

    if (preferences.dietary_tags && preferences.dietary_tags.length > 0) {
      query = query.overlaps('dietary_tags', preferences.dietary_tags);
    }

    const { data, error } = await query
      .order('rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(maxResults);

    if (error) throw error;
    
    return (data || []).map(row => ({
      recipe_id: row.id,
      title: row.title,
      description: row.description,
      ingredients: row.ingredients,
      instructions: row.instructions
    }));
  }
}

// Export singleton instance
export const db = new DatabaseService();
