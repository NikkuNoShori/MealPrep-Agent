import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export class DatabaseService {
  constructor() {
    this.pool = pool;
  }

  async query(text, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  // Recipe CRUD operations
  async getRecipes(userId, limit = 50, offset = 0) {
    const result = await this.query(
      'SELECT * FROM recipes WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  }

  async getRecipe(recipeId, userId) {
    const result = await this.query(
      'SELECT * FROM recipes WHERE id = $1 AND user_id = $2',
      [recipeId, userId]
    );
    return result.rows[0] || null;
  }

  async createRecipe(recipe) {
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

  async updateRecipe(recipeId, userId, updates) {
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

  async deleteRecipe(recipeId, userId) {
    const result = await this.query(
      'DELETE FROM recipes WHERE id = $1 AND user_id = $2',
      [recipeId, userId]
    );
    return result.rowCount > 0;
  }

  // Embedding operations
  async createEmbedding(embedding) {
    const result = await this.query(
      `INSERT INTO recipe_embeddings (recipe_id, embedding, text_content, embedding_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [embedding.recipe_id, `[${embedding.embedding.join(',')}]`, embedding.text_content, embedding.embedding_type]
    );
    return result.rows[0];
  }

  async getEmbeddings(recipeId) {
    const result = await this.query(
      'SELECT * FROM recipe_embeddings WHERE recipe_id = $1',
      [recipeId]
    );
    return result.rows;
  }

  async deleteEmbeddings(recipeId) {
    await this.query(
      'DELETE FROM recipe_embeddings WHERE recipe_id = $1',
      [recipeId]
    );
  }

  // Vector similarity search
  async searchSimilarRecipes(queryEmbedding, userId, similarityThreshold = 0.7, maxResults = 10) {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const result = await this.query(
      `SELECT * FROM search_similar_recipes($1, $2, $3, $4)`,
      [embeddingStr, userId, similarityThreshold, maxResults]
    );
    return result.rows;
  }

  // Full-text search
  async searchRecipesText(searchQuery, userId, maxResults = 10) {
    const result = await this.query(
      `SELECT * FROM search_recipes_text($1, $2, $3)`,
      [searchQuery, userId, maxResults]
    );
    return result.rows;
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
  async searchByIngredients(ingredients, userId, maxResults = 10) {
    // Create a search query from ingredients
    const searchQuery = ingredients.join(' ');
    return this.searchRecipesText(searchQuery, userId, maxResults);
  }

  // Get recipe recommendations based on user preferences
  async getRecommendations(userId, preferences = {}, maxResults = 10) {
    let query = 'SELECT * FROM recipes WHERE user_id = $1';
    const params = [userId];
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
    return result.rows.map(row => ({
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
