import { Pool, PoolClient } from 'pg';
import * as monitor from 'pg-monitor';
import { AppLogger } from './logger';

// Note: .env is loaded by server.js (entry point)
// No need to load it again here - process.env is already populated
// This module is only used server-side, so server.js will have already loaded .env

// Lazy initialization - pool is created on first use, not at module load time
// This allows .env to be loaded before database initialization
let pool: Pool | null = null;

/**
 * Initialize database pool (lazy initialization)
 * Called automatically on first database operation
 */
function initializePool(): Pool {
  if (pool) {
    return pool; // Already initialized
  }

  // Validate DATABASE_URL is set (at runtime, after .env is loaded)
  if (!process.env.DATABASE_URL) {
    AppLogger.error('🔴 DatabaseService: DATABASE_URL environment variable is not set', {
      hint: 'Please set DATABASE_URL in your .env file. For NeonDB, it should look like: postgresql://user:password@host.neon.tech/dbname?sslmode=require',
    });
    throw new Error('DATABASE_URL environment variable is not set. Please configure your database connection string.');
  }

  // Parse and validate DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    AppLogger.error('🔴 DatabaseService: DATABASE_URL is empty or not set');
    throw new Error('DATABASE_URL environment variable is not set. Please configure your database connection string.');
  }

  // Log connection details (masked for security)
  try {
    const url = new URL(databaseUrl);
    const maskedUrl = `${url.protocol}//${url.username ? url.username.substring(0, 3) + '***' : '***'}:${url.password ? '***' : ''}@${url.hostname}${url.port ? ':' + url.port : ''}${url.pathname}${url.search ? '?' + url.searchParams.toString().substring(0, 20) + '...' : ''}`;
    AppLogger.info('🔵 DatabaseService: Parsed DATABASE_URL', {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 'default (5432)',
      database: url.pathname?.replace('/', '') || 'default',
      hasSSL: url.searchParams.has('sslmode') || url.searchParams.has('ssl'),
      maskedUrl: maskedUrl
    });
  } catch (urlError: any) {
    AppLogger.error('🔴 DatabaseService: Invalid DATABASE_URL format', {
      error: urlError.message,
      hint: 'DATABASE_URL should be in format: postgresql://user:password@host:port/dbname?sslmode=require'
    });
    throw new Error(`Invalid DATABASE_URL format: ${urlError.message}`);
  }

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

  // Create pool with optimized configuration
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      // Enable SSL certificate validation in production
      // For NeonDB and other cloud databases, SSL is required
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
    // Connection timeout in milliseconds
    connectionTimeoutMillis: 10000,
    // Optimize pool size for production
    max: 20, // Maximum connections in pool
    min: 2, // Minimum idle connections
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    // Statement timeout (5 seconds)
    statement_timeout: 5000,
  });

  // Test connection on startup
  pool.on('error', (err) => {
    AppLogger.error('🔴 DatabaseService: PostgreSQL pool error', {
      error: err.message,
      code: err.code,
      hint: 'Check if DATABASE_URL is correct and the database server is accessible',
    });
  });

  // Log successful connection
  pool.on('connect', () => {
    AppLogger.info('✅ DatabaseService: PostgreSQL connection established');
  });

  AppLogger.info('✅ DatabaseService: Pool initialized');
  return pool;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  slug?: string; // URL-friendly slug (e.g., "chocolate-chip-cookies")
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
  is_public?: boolean; // If true, recipe is visible to all users
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
  private pool: Pool | null = null;

  constructor() {
    // Don't initialize pool in constructor - use lazy initialization
  }

  /**
   * Get or initialize the database pool
   * Lazy initialization ensures .env is loaded before database connection
   */
  private getPool(): Pool {
    if (!this.pool) {
      this.pool = initializePool();
    }
    return this.pool;
  }

  /**
   * Execute a query with optional user context for RLS
   * @param text SQL query text
   * @param params Query parameters
   * @param userId Optional user ID for RLS context
   */
  async query(text: string, params?: any[], userId?: string): Promise<any> {
    const client = await this.getPool().connect();
    const startTime = Date.now();
    
    try {
      // With Supabase Auth, RLS uses auth.uid() automatically
      // For direct PostgreSQL connections, we need to set the JWT token in the connection
      // This is handled by Supabase's connection pool, but for direct connections,
      // we can set the role to authenticated user
      if (userId) {
        try {
          // Set the role to authenticated user for RLS
          // Supabase Auth uses auth.uid() which is automatically available in the session
          // For direct connections, we set the role to match the user
          await client.query('SET LOCAL role authenticated');
          await client.query('SET LOCAL request.jwt.claim.sub = $1', [userId]);
          AppLogger.debug('🔵 DatabaseService: Set user context for RLS', { userId });
        } catch (rlsError: any) {
          // If setting role fails, log warning but continue
          // RLS will still work if using Supabase's connection pool
          AppLogger.warn('⚠️ DatabaseService: Could not set user context for RLS', {
            error: rlsError.message,
            hint: 'RLS will use auth.uid() if using Supabase connection pool',
          });
          // Continue - RLS may still work depending on connection type
        }
      }
      
      // pg-monitor will automatically log the query through unified logger
      const result = await client.query(text, params || []);
      
      // Calculate duration manually (pg QueryResult doesn't have duration property)
      const duration = Date.now() - startTime;
      
      // Log slow queries as warnings (additional check)
      // pg-monitor already logs duration, but we can add custom slow query detection
      if (duration > 1000) {
        AppLogger.warn('⚠️ Slow query detected', {
          duration: `${duration.toFixed(2)}ms`,
          query: text.length > 200 ? text.substring(0, 200) + '...' : text,
          userId: userId || 'none',
        });
      }
      
      return result;
    } catch (error: any) {
      // pg-monitor will automatically log the error through unified logger
      AppLogger.error('🔴 DatabaseService: Query error', {
        error: error.message,
        errorCode: error.code,
        errorDetail: error.detail,
        errorHint: error.hint,
        query: text.substring(0, 200),
        params: params?.slice(0, 3), // Log first 3 params for debugging
        userId: userId || 'none',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.getPool().connect();
  }

  // Recipe CRUD operations
  async getRecipes(userId: string | null, limit: number = 50, offset: number = 0, includePublic: boolean = true): Promise<Recipe[]> {
    // If userId is null, we're querying public recipes only
    // If userId is provided, RLS will show user's recipes + public recipes
    if (userId) {
      // Set user context for RLS (will show user's recipes + public recipes)
      const result = await this.query(
        'SELECT * FROM recipes ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset],
        userId // Pass userId for RLS context
      );
      return result.rows;
    } else {
      // No user context - only show public recipes
      // Don't set user context, RLS will only show public recipes
      const result = await this.query(
        'SELECT * FROM recipes WHERE is_public = true ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
        // No userId passed - unauthenticated query
      );
      return result.rows;
    }
  }

  async getRecipe(recipeId: string, userId: string | null = null): Promise<Recipe | null> {
    // If userId is provided, RLS will check if user owns it or if it's public
    // If userId is null, RLS will only allow access if recipe is public
    if (userId) {
      // Set user context for RLS (will show user's recipes + public recipes)
      const result = await this.query(
        'SELECT * FROM recipes WHERE id = $1',
        [recipeId],
        userId // Pass userId for RLS context
      );
      return result.rows[0] || null;
    } else {
      // No user context - only check if recipe is public
      const result = await this.query(
        'SELECT * FROM recipes WHERE id = $1 AND is_public = true',
        [recipeId]
        // No userId passed - unauthenticated query
      );
      return result.rows[0] || null;
    }
  }

  /**
   * Get recipe by slug
   * Supports both authenticated and unauthenticated access for public recipes
   */
  async getRecipeBySlug(slug: string, userId: string | null = null): Promise<Recipe | null> {
    // If userId is provided, RLS will check if user owns it or if it's public
    // If userId is null, RLS will only allow access if recipe is public
    if (userId) {
      // Set user context for RLS (will show user's recipes + public recipes)
      const result = await this.query(
        'SELECT * FROM recipes WHERE slug = $1',
        [slug],
        userId // Pass userId for RLS context
      );
      return result.rows[0] || null;
    } else {
      // No user context - only check if recipe is public
      const result = await this.query(
        'SELECT * FROM recipes WHERE slug = $1 AND is_public = true',
        [slug]
        // No userId passed - unauthenticated query
      );
      return result.rows[0] || null;
    }
  }

  async createRecipe(recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>): Promise<Recipe> {
    // RLS will verify that user_id matches the authenticated user
    const result = await this.query(
      `INSERT INTO recipes (user_id, title, slug, description, ingredients, instructions, 
       prep_time, cook_time, servings, difficulty, cuisine, dietary_tags, 
       source_url, source_name, rating, is_favorite, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        recipe.user_id, recipe.title, recipe.slug || null, recipe.description, 
        JSON.stringify(recipe.ingredients), JSON.stringify(recipe.instructions),
        recipe.prep_time, recipe.cook_time, recipe.servings, recipe.difficulty,
        recipe.cuisine, recipe.dietary_tags, recipe.source_url, recipe.source_name,
        recipe.rating, recipe.is_favorite, recipe.is_public || false
      ],
      recipe.user_id // Pass userId for RLS context
    );
    return result.rows[0];
  }

  async updateRecipe(recipeId: string, userId: string, updates: Partial<Recipe>): Promise<Recipe | null> {
    // If title is being updated, regenerate slug (unless slug is explicitly provided)
    if (updates.title && !updates.slug) {
      // Import slugify function
      const { generateUniqueSlug } = await import('../utils/slugify.js');
      
      // Get existing recipes to check for slug uniqueness
      const existingRecipes = await this.getRecipes(userId, 1000, 0);
      const currentRecipe = await this.getRecipe(recipeId, userId);
      const existingSlugs = existingRecipes
        .map(r => r.slug)
        .filter((s): s is string => !!s) // Type guard to filter out undefined/null
        .filter(s => currentRecipe && s !== currentRecipe.slug); // Exclude current recipe's slug
      
      updates.slug = generateUniqueSlug(updates.title, existingSlugs);
    }

    const setClause = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at')
      .map((key, index) => `${key} = $${index + 3}`)
      .join(', ');

    if (!setClause) {
      return this.getRecipe(recipeId, userId);
    }

    const values = [recipeId, userId, ...Object.values(updates).filter(v => v !== undefined)];
    // RLS will verify that user_id matches the authenticated user
    const result = await this.query(
      `UPDATE recipes SET ${setClause} WHERE id = $1 AND user_id = $2 RETURNING *`,
      values,
      userId // Pass userId for RLS context
    );
    return result.rows[0] || null;
  }

  async deleteRecipe(recipeId: string, userId: string): Promise<boolean> {
    // RLS will verify that user_id matches the authenticated user
    const result = await this.query(
      'DELETE FROM recipes WHERE id = $1 AND user_id = $2',
      [recipeId, userId],
      userId // Pass userId for RLS context
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
      [embeddingStr, userId, similarityThreshold, maxResults],
      userId // Pass userId for RLS context
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
      [searchQuery, userId, maxResults],
      userId // Pass userId for RLS context
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

    const result = await this.query(query, params, userId); // Pass userId for RLS context
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

