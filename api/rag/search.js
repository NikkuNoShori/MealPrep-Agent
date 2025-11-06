import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

// Database connection (edge-compatible)
const sql = neon(process.env.DATABASE_URL);

// OpenAI client (edge-compatible)
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined,
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

// Generate embedding for text
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

// Vector similarity search using stored procedure
async function searchSimilarRecipes(embedding, userId, threshold = 0.5, limit = 10) {
  try {
    // Format embedding as PostgreSQL array string: [1,2,3,...]
    const embeddingStr = `[${embedding.join(',')}]`;
    
    // Call stored procedure: search_similar_recipes(query_embedding, user_uuid, similarity_threshold, max_results)
    // Neon edge SQL uses tagged template literals with proper casting
    const results = await sql`
      SELECT * FROM search_similar_recipes(
        ${embeddingStr}::vector, 
        ${userId}::uuid, 
        ${threshold}::float, 
        ${limit}::integer
      )
    `;
    
    // Map results to include all fields from recipe_embeddings
    const enrichedResults = await Promise.all(results.map(async (result) => {
      // Get additional fields from recipe_embeddings
      const embeddingInfo = await sql`
        SELECT text_content 
        FROM recipe_embeddings 
        WHERE recipe_id = ${result.recipe_id}
        LIMIT 1
      `;
      
      return {
        ...result,
        searchable_text: embeddingInfo[0]?.text_content || null,
      };
    }));
    
    return enrichedResults;
  } catch (error) {
    console.error('Error in vector search:', error);
    throw error;
  }
}

// Text search using stored procedure
async function searchRecipesText(query, userId, limit = 10) {
  try {
    // Call stored procedure: search_recipes_text(search_query, user_uuid, max_results)
    const results = await sql`
      SELECT * FROM search_recipes_text(${query}, ${userId}::uuid, ${limit}::integer)
    `;
    
    // Map results to include searchable_text
    const enrichedResults = await Promise.all(results.map(async (result) => {
      const embeddingInfo = await sql`
        SELECT text_content 
        FROM recipe_embeddings 
        WHERE recipe_id = ${result.recipe_id}
        LIMIT 1
      `;
      
      return {
        ...result,
        searchable_text: embeddingInfo[0]?.text_content || null,
        similarity_score: 0.0, // Text search doesn't have similarity score
      };
    }));
    
    return enrichedResults;
  } catch (error) {
    console.error('Error in text search:', error);
    throw error;
  }
}

// Hybrid search (combines vector + text search, matching database service implementation)
async function hybridSearch(embedding, query, userId, limit = 10) {
  try {
    // Get results from both searches (same approach as database service)
    const [vectorResults, textResults] = await Promise.all([
      searchSimilarRecipes(embedding, userId, 0.5, limit),
      searchRecipesText(query, userId, limit)
    ]);

    // Combine and deduplicate results
    const resultMap = new Map();
    
    // Add vector search results with higher weight (0.7)
    vectorResults.forEach(result => {
      resultMap.set(result.recipe_id, {
        ...result,
        similarity_score: (result.similarity_score || 0) * 0.7,
        rank_score: 0.0,
      });
    });

    // Add text search results with lower weight (0.3)
    textResults.forEach(result => {
      const existing = resultMap.get(result.recipe_id);
      if (existing) {
        // Combine scores if recipe appears in both results
        existing.rank_score = (result.rank_score || 0) * 0.3;
        existing.similarity_score = (existing.similarity_score || 0) + (result.rank_score || 0) * 0.3;
      } else {
        resultMap.set(result.recipe_id, {
          ...result,
          rank_score: (result.rank_score || 0) * 0.3,
          similarity_score: 0.0,
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
      .slice(0, limit);
  } catch (error) {
    console.error('Error in hybrid search:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'RAG search endpoint only accepts POST requests'
    });
  }

  try {
    const { query, userId, limit = 10, searchType = 'semantic' } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Query parameter is required'
      });
    }

    console.log('RAG Search request:', { query, userId, limit, searchType });
    
    let results = [];
    
    if (searchType === 'semantic' || searchType === 'hybrid') {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);
      
      if (searchType === 'semantic') {
        // Pure vector search
        results = await searchSimilarRecipes(queryEmbedding, userId || 'test-user', 0.5, limit);
      } else {
        // Hybrid search (vector + text)
        results = await hybridSearch(queryEmbedding, query, userId || 'test-user', limit);
      }
    } else if (searchType === 'text') {
      // Pure text search
      results = await searchRecipesText(query, userId || 'test-user', limit);
    } else {
      return res.status(400).json({ 
        error: 'Bad request',
        message: `Invalid search type: ${searchType}. Must be 'semantic', 'text', or 'hybrid'`
      });
    }
    
    console.log(`Found ${results.length} results for query: "${query}"`);
    
    return res.status(200).json({
      results: results.map(result => ({
        id: result.recipe_id,
        title: result.title,
        description: result.description,
        ingredients: result.ingredients,
        instructions: result.instructions,
        similarity_score: result.similarity_score || 0,
        rank_score: result.rank_score || 0,
        searchable_text: result.searchable_text
      })),
      total: results.length,
      searchType,
      query
    });
    
  } catch (error) {
    console.error('RAG Search error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

