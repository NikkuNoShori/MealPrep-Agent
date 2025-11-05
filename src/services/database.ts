import { Pool, PoolClient } from 'pg';
import { config } from 'dotenv';
import * as monitor from 'pg-monitor';
import { AppLogger } from './logger';

// Load environment variables
config();

// Configure pg-monitor to use unified logger
const enablePgMonitor = process.env.ENABLE_PG_MONITOR !== 'false'; // Default: enabled

if (enablePgMonitor) {
  // Configure pg-monitor
  monitor.setTheme('matrix'); // Choose theme: 'matrix', 'default', 'monochrome'
  
  // Attach monitor to all events, routing through unified logger
  monitor.attach({
    // Log all queries through unified logger
    query: (e: any) => {
      AppLogger.dbQuery(e.query, e.params, e.duration);
    },
    
    // Log errors through unified logger
    error: (err: any, e: any) => {
      const error = err instanceof Error ? err : new Error(String(err));
      (error as any).code = err.code;
      (error as any).detail = err.detail;
      (error as any).hint = err.hint;
      AppLogger.dbError(error, e.query, e.params);
    },
    
    // Log connection events through unified logger
    connect: (client: any, e: any) => {
      AppLogger.dbConnect(client?.processID);
    },
    
    // Log transaction events through unified logger
    task: (e: any) => {
      if (e.event === 'start') {
        AppLogger.dbTransaction('start');
      } else if (e.event === 'finish') {
        AppLogger.dbTransaction('finish', e.duration);
      } else if (e.event === 'rollback') {
        AppLogger.dbTransaction('rollback');
      }
    },
    
    // Log disconnect events through unified logger
    disconnect: (client: any, e: any) => {
      AppLogger.dbDisconnect(client?.processID);
    }
  });
  
  AppLogger.info('✅ pg-monitor enabled - PostgreSQL logging integrated with unified logger');
} else {
  AppLogger.warn('⚠️ pg-monitor disabled - no database logging');
}

// Create pool with basic configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Connection timeout in milliseconds
  connectionTimeoutMillis: 10000,
});

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  ingredients: any[];
  instructions: any[];
  prep_time?: string;
  cook_time?: string;
  servings?: number;
  difficulty?: string;
  cuisine?: string;
  dietary_tags?: string[];
  source_url?: string;
  source_name?: string;
  rating?: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  searchable_text?: string;
}

export interface RecipeEmbedding {
  id: string;
  recipe_id: string;
  embedding: number[];
  text_content: string;
  embedding_type: string;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  recipe_id: string;
  title: string;
  description?: string;
  ingredients: any[];
  instructions: any[];
  similarity_score?: number;
  rank_score?: number;
}

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    const startTime = Date.now();
    
    try {
      // pg-monitor will automatically log the query through unified logger
      const result = await client.query(text, params);
      
      // Calculate duration manually (pg QueryResult doesn't have duration property)
      const duration = Date.now() - startTime;
      
      // Log slow queries as warnings (additional check)
      // pg-monitor already logs duration, but we can add custom slow query detection
      if (duration > 1000) {
        AppLogger.warn('⚠️ Slow query detected', {
          duration: `${duration.toFixed(2)}ms`,
          query: text.length > 200 ? text.substring(0, 200) + '...' : text,
        });
      }
      
      return result;
    } catch (error: any) {
      // pg-monitor will automatically log the error through unified logger
      throw error;
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  // Recipe CRUD operations
  async getRecipes(userId: string, limit: number = 50, offset: number = 0): Promise<Recipe[]> {
    const result = await this.query(
      'SELECT * FROM recipes WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  }

  async getRecipe(recipeId: string, userId: string): Promise<Recipe | null> {
    const result = await this.query(
      'SELECT * FROM recipes WHERE id = $1 AND user_id = $2',
      [recipeId, userId]
    );
    return result.rows[0] || null;
  }

  async createRecipe(recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>): Promise<Recipe> {
    const result = await this.query(
      `INSERT INTO recipes (user_id, title, description, ingredients, instructions, 
       prep_time, cook_time, servings, difficulty, cuisine, dietary_tags, 
       source_url, source_name, rating, is_favorite)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        recipe.user_id, recipe.title, recipe.description, 
        JSON.stringify(recipe.ingredients), JSON.stringify(recipe.instructions),
        recipe.prep_time, recipe.cook_time, recipe.servings, recipe.difficulty,
        recipe.cuisine, recipe.dietary_tags, recipe.source_url, recipe.source_name,
        recipe.rating, recipe.is_favorite
      ]
    );
    return result.rows[0];
  }

  async updateRecipe(recipeId: string, userId: string, updates: Partial<Recipe>): Promise<Recipe | null> {
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at')
      .map((key, index) => `${key} = $${index + 3}`)
      .join(', ');

    if (!setClause) {
      return this.getRecipe(recipeId, userId);
    }

    const values = [recipeId, userId, ...Object.values(updates).filter(v => v !== undefined)];
    const result = await this.query(
      `UPDATE recipes SET ${setClause} WHERE id = $1 AND user_id = $2 RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deleteRecipe(recipeId: string, userId: string): Promise<boolean> {
    const result = await this.query(
      'DELETE FROM recipes WHERE id = $1 AND user_id = $2',
      [recipeId, userId]
    );
    return result.rowCount > 0;
  }

  // Embedding operations
  async createEmbedding(embedding: Omit<RecipeEmbedding, 'id' | 'created_at' | 'updated_at'>): Promise<RecipeEmbedding> {
    const result = await this.query(
      `INSERT INTO recipe_embeddings (recipe_id, embedding, text_content, embedding_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [embedding.recipe_id, `[${embedding.embedding.join(',')}]`, embedding.text_content, embedding.embedding_type]
    );
    return result.rows[0];
  }

  async getEmbeddings(recipeId: string): Promise<RecipeEmbedding[]> {
    const result = await this.query(
      'SELECT * FROM recipe_embeddings WHERE recipe_id = $1',
      [recipeId]
    );
    return result.rows;
  }

  async deleteEmbeddings(recipeId: string): Promise<void> {
    await this.query(
      'DELETE FROM recipe_embeddings WHERE recipe_id = $1',
      [recipeId]
    );
  }

  // Vector similarity search
  async searchSimilarRecipes(
    queryEmbedding: number[],
    userId: string,
    similarityThreshold: number = 0.7,
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const result = await this.query(
      `SELECT * FROM search_similar_recipes($1, $2, $3, $4)`,
      [embeddingStr, userId, similarityThreshold, maxResults]
    );
    return result.rows;
  }

  // Full-text search
  async searchRecipesText(
    searchQuery: string,
    userId: string,
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    const result = await this.query(
      `SELECT * FROM search_recipes_text($1, $2, $3)`,
      [searchQuery, userId, maxResults]
    );
    return result.rows;
  }

  // Hybrid search (combines vector and text search)
  async hybridSearch(
    queryEmbedding: number[],
    searchQuery: string,
    userId: string,
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    // Get results from both searches
    const [vectorResults, textResults] = await Promise.all([
      this.searchSimilarRecipes(queryEmbedding, userId, 0.5, maxResults),
      this.searchRecipesText(searchQuery, userId, maxResults)
    ]);

    // Combine and deduplicate results
    const resultMap = new Map<string, SearchResult>();
    
    // Add vector search results with higher weight
    vectorResults.forEach(result => {
      resultMap.set(result.recipe_id, {
        ...result,
        similarity_score: (result.similarity_score || 0) * 0.7 // Weight vector results
      });
    });

    // Add text search results
    textResults.forEach(result => {
      const existing = resultMap.get(result.recipe_id);
      if (existing) {
        // Combine scores if recipe appears in both results
        existing.rank_score = (result.rank_score || 0) * 0.3;
        existing.similarity_score = (existing.similarity_score || 0) + (result.rank_score || 0) * 0.3;
      } else {
        resultMap.set(result.recipe_id, {
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
  async searchByIngredients(
    ingredients: string[],
    userId: string,
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    // Create a search query from ingredients
    const searchQuery = ingredients.join(' ');
    return this.searchRecipesText(searchQuery, userId, maxResults);
  }

  // Get recipe recommendations based on user preferences
  async getRecommendations(
    userId: string,
    preferences: any = {},
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    let query = 'SELECT * FROM recipes WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    // Add filters based on preferences
    if (preferences.cuisine) {
      query += ` AND cuisine = $${paramIndex}`;
      params.push(preferences.cuisine);
      paramIndex++;
    }

    if (preferences.difficulty) {
      query += ` AND difficulty = $${paramIndex}`;
      params.push(preferences.difficulty);
      paramIndex++;
    }

    if (preferences.dietary_tags && preferences.dietary_tags.length > 0) {
      query += ` AND dietary_tags && $${paramIndex}`;
      params.push(preferences.dietary_tags);
      paramIndex++;
    }

    query += ` ORDER BY rating DESC NULLS LAST, created_at DESC LIMIT $${paramIndex}`;
    params.push(maxResults);

    const result = await this.query(query, params);
    return result.rows.map((row: any) => ({
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

