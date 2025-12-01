import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

// Database connection (edge-compatible)
const sql = neon(process.env.DATABASE_URL);

// OpenAI client (edge-compatible)
// Detect if API key is OpenRouter (starts with sk-or-v1) or OpenAI
const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
const isOpenRouter = apiKey?.startsWith('sk-or-v1-') || !!process.env.OPENROUTER_API_KEY;

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined,
});

// CORS headers - restrict to trusted origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://meal-prep-agent-delta.vercel.app',
  // Add your production domains here
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

const corsHeaders = {
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

// Vector similarity search using direct SQL (fallback if stored procedures don't exist)
async function searchSimilarRecipes(embedding, userId, threshold = 0.5, limit = 10) {
  try {
    // Format embedding as PostgreSQL array string: [1,2,3,...]
    const embeddingStr = `[${embedding.join(',')}]`;
    
    // Direct SQL query - try recipe_embeddings first, fallback to recipes table if it doesn't exist
    try {
      const results = await sql`
        SELECT 
          r.id as recipe_id,
          r.title,
          r.description,
          r.ingredients,
          r.instructions,
          COALESCE(re.text_content, r.searchable_text) as searchable_text,
          1 - (re.embedding <=> ${embeddingStr}::vector) as similarity_score,
          0.0 as rank_score
        FROM recipes r
        INNER JOIN recipe_embeddings re ON r.id = re.recipe_id
        WHERE r.user_id::text = ${userId}
          AND 1 - (re.embedding <=> ${embeddingStr}::vector) >= ${threshold}::float
        ORDER BY re.embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}::integer
      `;
      return results;
    } catch (vectorError) {
      // If recipe_embeddings doesn't exist, fall back to text search
      console.warn('Vector search failed (recipe_embeddings may not exist), falling back to text search:', vectorError.message);
      return [];
    }
  } catch (error) {
    console.error('Error in vector search:', error);
    throw error;
  }
}

// Text search using direct SQL (fallback if stored procedures don't exist)
async function searchRecipesText(query, userId, limit = 10) {
  try {
    // Direct SQL query - search in recipes table using searchable_text or title/description
    const results = await sql`
      SELECT 
        r.id as recipe_id,
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        COALESCE(r.searchable_text, r.title || ' ' || COALESCE(r.description, '')) as searchable_text,
        ts_rank(
          to_tsvector('english', COALESCE(r.searchable_text, r.title || ' ' || COALESCE(r.description, ''), '')), 
          plainto_tsquery('english', ${query})
        ) as rank_score,
        0.0 as similarity_score
      FROM recipes r
      WHERE r.user_id::text = ${userId}
        AND (
          to_tsvector('english', COALESCE(r.searchable_text, r.title || ' ' || COALESCE(r.description, ''), '')) @@ plainto_tsquery('english', ${query})
          OR r.title ILIKE ${'%' + query + '%'}
          OR r.description ILIKE ${'%' + query + '%'}
        )
      ORDER BY rank_score DESC
      LIMIT ${limit}::integer
    `;
    
    return results;
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
  // Get origin from request
  const origin = req.headers.origin || req.headers.referer || '';
  
  // Set CORS headers with dynamic origin
  const originToAllow = allowedOrigins.find(allowed => origin.includes(allowed)) || allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', originToAllow || '*');
  
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

  // Parse request body first to check for userId
  let requestBody = {};
  try {
    if (req.body) {
      requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } else {
      // Parse body from request if not already parsed
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    }
  } catch (parseError) {
    console.error('Error parsing request body:', parseError);
    return res.status(400).json({
      error: 'Bad request',
      message: 'Invalid JSON in request body',
    });
  }

  // Check if userId is provided in body (for n8n requests)
  // If userId is provided, skip authentication check
  const hasUserIdInBody = requestBody?.userId && requestBody.userId !== '';

  // Verify authentication (only if userId not provided in body)
  let authenticatedUserId = null;
  if (!hasUserIdInBody) {
    try {
      const { verifyAuthToken } = await import('./auth.js');
      const { user, error } = await verifyAuthToken(req);
      
      // Require auth if no userId in body (for direct API calls)
      if (error && process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          error: 'Authentication required',
          message: error,
        });
      }
      
      // Use authenticated user ID if available
      authenticatedUserId = user?.id || null;
    } catch (authError) {
      console.error('Authentication verification error:', authError);
      // In production, fail if no userId in body
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Failed to verify authentication',
        });
      }
    }
  } else {
    console.log('✅ Skipping authentication - userId provided in body (n8n request)');
  }

  try {
    const { query, userId: bodyUserId, limit = 10, searchType = 'semantic' } = requestBody;
    
    // Use authenticated user ID if available, otherwise use body userId
    // In development, allow test user if no auth
    // For n8n requests, bodyUserId should be provided
    const userId = authenticatedUserId || bodyUserId || (process.env.NODE_ENV === 'development' ? 'test-user' : null);
    
    if (!userId && process.env.NODE_ENV === 'production') {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID is required for RAG search. Provide userId in request body or authenticate.',
      });
    }
    
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

