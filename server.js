import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import { config } from 'dotenv';
import { db } from './src/services/database.js';
import { embeddingService } from './src/services/embeddingService.js';
import { authenticateRequest, optionalAuth } from './server/middleware/auth.js';
import { apiLimiter, recipeCreationLimiter, searchLimiter } from './server/middleware/rateLimit.js';
import { validateRecipeCreation, validateRecipeUpdate, validateRecipeId, validateRAGSearch } from './server/middleware/validation.js';

// Load environment variables
config();

const app = express();
const PORT = 3000;

// Configure CORS - restrict to trusted origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://meal-prep-agent-delta.vercel.app',
  // Add your production domains here
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(cookieParser()); // Parse cookies for Stack Auth
app.use(express.json());

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

// Environment variables (set these for local development)
const WEBHOOK_ENABLED = process.env.WEBHOOK_ENABLED || 'true';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://agents.eaglesightlabs.com/webhook/e7acd79d-bd3d-4e8b-851c-6e93f06ccfa1';

// Webhook service
const webhookService = {
  async sendEvent(eventType, data, user = null, metadata = {}) {
    console.log('Webhook service called with:', {
      eventType,
      webhookEnabled: WEBHOOK_ENABLED,
      webhookUrl: N8N_WEBHOOK_URL ? 'configured' : 'not configured'
    });

    if (WEBHOOK_ENABLED !== 'true' || !N8N_WEBHOOK_URL) {
      console.error('Webhook not properly configured');
      throw new Error('Webhook not configured');
    }

    try {
      console.log('🌐 Attempting to reach webhook at:', N8N_WEBHOOK_URL);

      const webhookPayload = {
        content: data.content,
        sessionId: user.id || 'default-session',
        userId: user.id
      };
      
      console.log('Sending webhook payload:', JSON.stringify(webhookPayload, null, 2));

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(30000)
      });

      console.log('Webhook response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Webhook failed: ${response.status} ${response.statusText}`);
        return null;
      } else {
        const responseText = await response.text();
        console.log(`Webhook sent successfully: ${eventType}`);
        console.log('📥 Response from n8n:', responseText);
        console.log('📥 Response length:', responseText.length);
        
        if (!responseText || responseText.trim() === '') {
          console.log('❌ Empty response from n8n');
          return null;
        }
        
        try {
          const responseData = JSON.parse(responseText);
          console.log('✅ Parsed JSON response:', responseData);
          return responseData;
        } catch (parseError) {
          console.log('⚠️ Response is not JSON, treating as text:', responseText);
          return { content: responseText };
        }
      }
             } catch (error) {
     console.error('❌ Webhook error:', error.message);
     console.error('🔍 Error details:', {
       code: error.code,
       errno: error.errno,
       syscall: error.syscall,
       hostname: error.hostname,
       port: error.port
     });
     // Don't throw the error, return null instead to handle gracefully
     return null;
   }
  },

  async chatMessageSent(message, user) {
    return this.sendEvent('chat.message.sent', message, user);
  }
};

// Note: getTestUser() is deprecated - use req.user from authentication middleware instead
// This is kept for backward compatibility during migration
const getTestUser = () => {
  console.warn('⚠️ getTestUser() is deprecated - use req.user from authentication middleware');
  return {
    id: '11111111-1111-1111-1111-111111111111',
    neonUserId: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    familyId: '11111111-1111-1111-1111-111111111111',
    householdSize: 4
  };
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    webhookEnabled: WEBHOOK_ENABLED === 'true',
    webhookUrlConfigured: !!N8N_WEBHOOK_URL,
    webhookUrl: N8N_WEBHOOK_URL,
    environment: 'local-development'
  });
});

// Database connection test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('🔵 Testing database connection...');
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    const connectionInfo = await db.query(`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        inet_server_addr() as server_address,
        inet_server_port() as server_port
    `);
    
    res.json({
      status: 'success',
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
      database: {
        time: result.rows[0]?.current_time,
        version: result.rows[0]?.pg_version?.split(' ')[0] + ' ' + result.rows[0]?.pg_version?.split(' ')[1],
        name: connectionInfo.rows[0]?.database_name,
        user: connectionInfo.rows[0]?.user_name,
        server: connectionInfo.rows[0]?.server_address || 'cloud',
        port: connectionInfo.rows[0]?.server_port || 'default'
      }
    });
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Password reset is now handled client-side by Supabase Auth
// No backend proxy needed

app.get('/api/test-webhook', async (req, res) => {
  try {
    console.log('🧪 Testing webhook connectivity...');
    console.log('🎯 Target URL:', N8N_WEBHOOK_URL);
    
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    console.log('✅ Webhook test response:', response.status, response.statusText);
    
    res.json({
      status: response.status,
      ok: response.ok,
      webhookUrl: N8N_WEBHOOK_URL,
      message: response.ok ? '✅ Webhook is reachable' : '❌ Webhook returned error status',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    res.json({
      status: 'error',
      webhookUrl: N8N_WEBHOOK_URL,
      message: error.message,
      error: '❌ Webhook is not reachable',
      details: {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall
      },
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/chat/history', (req, res) => {
  // Return empty history for now
  res.json({
    messages: [],
    total: 0
  });
});

app.post('/api/chat/message', async (req, res) => {
  try {
    const { message, context } = req.body;
    const user = getTestUser();

    console.log('Received chat message:', message);

    // Send webhook event for chat message and wait for n8n response
    console.log('Sending message to n8n webhook and waiting for response...');
          const webhookResponse = await webhookService.chatMessageSent({
        id: Date.now().toString(),
        content: message,
        type: 'text',
        context,
        userId: user.id,
        sessionId: context?.sessionId || 'default-session' // Use sessionId from context
      }, user);
    
    let aiResponse;

    if (webhookResponse && webhookResponse.output) {
      aiResponse = webhookResponse.output;
      console.log('Using n8n AI response (output field):', aiResponse);
    } else if (webhookResponse && webhookResponse.content) {
      aiResponse = webhookResponse.content;
      console.log('Using n8n AI response (content field):', aiResponse);
    } else if (webhookResponse && webhookResponse.message) {
      aiResponse = webhookResponse.message;
      console.log('Using n8n AI response (message field):', aiResponse);
    } else if (webhookResponse && typeof webhookResponse === 'string') {
      aiResponse = webhookResponse;
      console.log('Using n8n AI response (string):', aiResponse);
    } else {
      console.log('No response from n8n webhook - n8n may not be running or returned empty response');
      
      // Provide a fallback response instead of failing completely
      aiResponse = "I'm sorry, but I'm having trouble connecting to my AI service right now. Please try again in a moment, or check if the n8n workflow is properly configured and running.";
      console.log('Using fallback response:', aiResponse);
    }

    res.json({
      message: 'Message processed successfully',
      response: {
        id: Date.now().toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Recipe storage endpoint
app.post('/api/recipes', 
  recipeCreationLimiter, // Apply stricter rate limiting for recipe creation
  authenticateRequest, // Require authentication
  validateRecipeCreation, // Validate request body
  async (req, res) => {
  try {
    const { recipe } = req.body;
    const user = req.user; // Get authenticated user from middleware

    console.log('Received recipe for storage:', recipe.title);

    // Helper function to handle both camelCase and snake_case
    const getValue = (obj, camelKey, snakeKey) => {
      return obj[snakeKey] !== undefined ? obj[snakeKey] : obj[camelKey];
    };

    // Generate slug from title if not provided
    let slug = recipe.slug;
    if (!slug && recipe.title) {
      // Import slugify function (dynamic import for ES modules)
      const slugifyModule = await import('./src/utils/slugify.js');
      const { generateUniqueSlug } = slugifyModule;
      
      // Check for existing slugs to ensure uniqueness
      const existingRecipes = await db.getRecipes(user.id, 1000, 0);
      const existingSlugs = existingRecipes.map(r => r.slug).filter(Boolean);
      
      slug = generateUniqueSlug(recipe.title, existingSlugs);
    }

    // Create the recipe in the database
    const storedRecipe = await db.createRecipe({
      user_id: user.id,
      title: recipe.title,
      slug: slug || null,
      description: recipe.description,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      prep_time: getValue(recipe, 'prepTime', 'prep_time'),
      cook_time: getValue(recipe, 'cookTime', 'cook_time'),
      servings: recipe.servings,
      difficulty: recipe.difficulty || 'medium',
      cuisine: recipe.cuisine || null,
      dietary_tags: recipe.dietary_tags || recipe.tags || [],
      source_url: getValue(recipe, 'sourceUrl', 'source_url') || getValue(recipe, 'imageUrl', 'image_url'),
      source_name: recipe.source_name || null,
      rating: recipe.rating || null,
      is_favorite: recipe.is_favorite || false,
      is_public: recipe.is_public || recipe.isPublic || false // Support both snake_case and camelCase
    });

    // Generate and store embedding for the recipe
    try {
      const { embedding, textContent } = await embeddingService.generateRecipeEmbedding(storedRecipe);
      await db.createEmbedding({
        recipe_id: storedRecipe.id,
        embedding: embedding,
        text_content: textContent,
        embedding_type: 'recipe_content'
      });
      console.log('✅ Generated embedding for recipe:', storedRecipe.id);
    } catch (embeddingError) {
      console.error('⚠️ Failed to generate embedding for recipe:', embeddingError);
      // Don't fail the recipe creation if embedding generation fails
    }

    res.json({
      message: 'Recipe stored successfully',
      recipe: storedRecipe
    });

  } catch (error) {
    console.error('Generate embedding error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all recipes endpoint
// Supports both authenticated (user's recipes + public) and unauthenticated (public only) access
app.get('/api/recipes', 
  optionalAuth, // Optional authentication - allows unauthenticated access for public recipes
  async (req, res) => {
  try {
    const user = req.user || null; // May be null if unauthenticated
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const publicOnly = req.query.publicOnly === 'true'; // Optional: only public recipes

    // Get recipes from database
    // If user is authenticated: RLS will show user's recipes + public recipes
    // If user is not authenticated: RLS will only show public recipes
    const userId = publicOnly ? null : (user?.id || null);
    const recipes = await db.getRecipes(userId, limit, offset, true);

    res.json({
      recipes,
      total: recipes.length
    });

  } catch (error) {
    console.error('Recipe retrieval error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get single recipe endpoint (by ID or slug)
// Supports both authenticated and unauthenticated access for public recipes
// Route supports both UUID and slug: /api/recipes/:idOrSlug
app.get('/api/recipes/:idOrSlug', 
  optionalAuth, // Optional authentication - allows unauthenticated access for public recipes
  async (req, res) => {
  try {
    const user = req.user || null; // May be null if unauthenticated
    const idOrSlug = req.params.idOrSlug;

    // Check if it's a UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    let recipe;
    if (isUUID) {
      // Lookup by ID
      recipe = await db.getRecipe(idOrSlug, user?.id || null);
    } else {
      // Lookup by slug
      recipe = await db.getRecipeBySlug(idOrSlug, user?.id || null);
    }

    if (!recipe) {
      return res.status(404).json({ 
        error: 'Recipe not found',
        message: 'Recipe does not exist or is not publicly available'
      });
    }

    res.json({ recipe });

  } catch (error) {
    console.error('Recipe retrieval error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Update recipe endpoint
app.put('/api/recipes/:id', 
  authenticateRequest, // Require authentication
  validateRecipeId, // Validate recipe ID format
  validateRecipeUpdate, // Validate request body
  async (req, res) => {
  try {
    const user = req.user; // Get authenticated user from middleware
    const recipeId = req.params.id;
    const updates = req.body;

    // Update recipe in database (RLS will verify ownership)
    const updatedRecipe = await db.updateRecipe(recipeId, user.id, updates);

    if (!updatedRecipe) {
      return res.status(404).json({ 
        error: 'Recipe not found',
        message: 'Recipe does not exist or you do not have access to it'
      });
    }

    res.json({
      message: 'Recipe updated successfully',
      recipe: updatedRecipe
    });

  } catch (error) {
    console.error('Recipe update error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Delete recipe endpoint
app.delete('/api/recipes/:id', 
  authenticateRequest, // Require authentication
  validateRecipeId, // Validate recipe ID format
  async (req, res) => {
  try {
    const user = req.user; // Get authenticated user from middleware
    const recipeId = req.params.id;

    // Delete recipe from database (RLS will verify ownership)
    const deleted = await db.deleteRecipe(recipeId, user.id);

    if (!deleted) {
      return res.status(404).json({ 
        error: 'Recipe not found',
        message: 'Recipe does not exist or you do not have access to it'
      });
    }

    res.json({
      message: 'Recipe deleted successfully'
    });

  } catch (error) {
    console.error('Recipe deletion error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// RAG Search endpoint
app.post('/api/rag/search', 
  searchLimiter, // Apply rate limiting for search
  authenticateRequest, // Require authentication
  validateRAGSearch, // Validate request body
  async (req, res) => {
  try {
    const user = req.user; // Get authenticated user from middleware
    const { query, limit = 10, searchType = 'semantic' } = req.body;
    const userId = user.id; // Use authenticated user ID
    
    console.log('RAG Search request:', { query, userId, limit, searchType });
    
    let results = [];
    
    if (searchType === 'semantic' || searchType === 'hybrid') {
      // Generate embedding for the query
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      
      if (searchType === 'semantic') {
        // Pure vector search
        results = await db.searchSimilarRecipes(queryEmbedding, userId, 0.5, limit);
      } else {
        // Hybrid search (vector + text)
        results = await db.hybridSearch(queryEmbedding, query, userId, limit);
      }
    } else if (searchType === 'text') {
      // Pure text search
      results = await db.searchRecipesText(query, userId, limit);
    } else {
      throw new Error(`Invalid search type: ${searchType}`);
    }
    
    console.log(`Found ${results.length} results for query: "${query}"`);
    
    res.json({
      results: results.map(result => ({
        id: result.recipe_id,
        title: result.title,
        description: result.description,
        ingredients: result.ingredients,
        instructions: result.instructions,
        similarity_score: result.similarity_score,
        rank_score: result.rank_score,
        searchable_text: result.searchable_text
      })),
      total: results.length,
      searchType,
      query
    });
    
  } catch (error) {
    console.error('RAG Search error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// RAG Similar recipes endpoint
app.get('/api/rag/similar/:recipeId', 
  authenticateRequest, // Require authentication
  validateRecipeId, // Validate recipe ID format
  async (req, res) => {
  try {
    const user = req.user; // Get authenticated user from middleware
    const recipeId = req.params.id;
    const limit = parseInt(req.query.limit) || 5;
    const userId = user.id; // Use authenticated user ID
    
    console.log('RAG Similar request:', { recipeId, userId, limit });
    
    // Get the recipe to find similar ones (RLS will verify ownership)
    const recipe = await db.getRecipe(recipeId, userId);
    if (!recipe) {
      return res.status(404).json({ 
        error: 'Recipe not found',
        message: 'Recipe does not exist or you do not have access to it'
      });
    }
    
    // Generate embedding for the recipe
    const { embedding } = await embeddingService.generateRecipeEmbedding(recipe);
    
    // Find similar recipes (RLS will filter by user_id)
    const results = await db.searchSimilarRecipes(embedding, userId, 0.6, limit);
    
    // Filter out the original recipe
    const similarResults = results.filter(result => result.recipe_id !== recipeId);
    
    res.json(similarResults.map(result => ({
      id: result.recipe_id,
      title: result.title,
      description: result.description,
      ingredients: result.ingredients,
      instructions: result.instructions,
      similarity_score: result.similarity_score
    })));
    
  } catch (error) {
    console.error('RAG Similar error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// RAG Ingredients search endpoint
app.post('/api/rag/ingredients', 
  searchLimiter, // Apply rate limiting for search
  authenticateRequest, // Require authentication
  async (req, res) => {
  try {
    const user = req.user; // Get authenticated user from middleware
    const { ingredients, limit = 10 } = req.body;
    const userId = user.id; // Use authenticated user ID
    
    console.log('RAG Ingredients request:', { ingredients, userId, limit });
    
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Ingredients array is required' });
    }
    
    // Search for recipes containing these ingredients
    const results = await db.searchByIngredients(ingredients, userId, parseInt(limit));
    
    res.json(results.map(result => ({
      id: result.recipe_id,
      title: result.title,
      description: result.description,
      ingredients: result.ingredients,
      instructions: result.instructions,
      rank_score: result.rank_score
    })));
    
  } catch (error) {
    console.error('RAG Ingredients error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// RAG Recommendations endpoint
app.post('/api/rag/recommendations', 
  searchLimiter, // Apply rate limiting for search
  authenticateRequest, // Require authentication
  async (req, res) => {
  try {
    const user = req.user; // Get authenticated user from middleware
    const { preferences, limit = 10 } = req.body;
    const userId = user.id; // Use authenticated user ID
    
    console.log('RAG Recommendations request:', { userId, preferences, limit });
    
    // Get recipe recommendations based on user preferences
    const results = await db.getRecommendations(userId, preferences, parseInt(limit));
    
    res.json(results.map(result => ({
      id: result.recipe_id,
      title: result.title,
      description: result.description,
      ingredients: result.ingredients,
      instructions: result.instructions
    })));
    
  } catch (error) {
    console.error('RAG Recommendations error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// RAG Embedding endpoint
app.post('/api/rag/embedding', async (req, res) => {
  try {
    const { recipeId, text } = req.body;
    
    console.log('RAG Embedding request:', { recipeId, text });
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required for embedding generation' });
    }
    
    // Generate embedding for the provided text
    const embedding = await embeddingService.generateEmbedding(text);
    
    // If recipeId is provided, store the embedding in the database
    if (recipeId) {
      await db.createEmbedding({
        recipe_id: recipeId,
        embedding: embedding,
        text_content: text,
        embedding_type: 'manual'
      });
    }
    
    res.json({
      success: true,
      embedding: embedding
    });
    
  } catch (error) {
    console.error('RAG Embedding error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log(`🌐 Server accessible on all network interfaces (including 192.168.1.143:${PORT})`);
  console.log(`📡 n8n webhook URL: ${N8N_WEBHOOK_URL}`);
  console.log(`🔧 Webhook enabled: ${WEBHOOK_ENABLED}`);
  console.log(`🌐 CORS enabled for localhost:5173`);
  console.log(`🔗 Server listening on all interfaces (0.0.0.0:${PORT})`);
});
