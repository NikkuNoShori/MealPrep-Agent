import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file in project root
// Try multiple possible locations
const envPaths = [
  join(__dirname, '.env'),           // Same directory as server.js
  resolve(process.cwd(), '.env'),   // Current working directory
  join(process.cwd(), '.env'),      // Current working directory (alternative)
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    const result = config({ path: envPath });
    if (!result.error) {
      console.log(`✅ Loaded .env file from: ${envPath}`);
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  // Fallback to default behavior (current working directory)
  const result = config();
  if (result.error) {
    console.warn('⚠️ No .env file found. Tried:', envPaths);
    console.warn('   Using environment variables from system or default behavior');
  } else {
    console.log('✅ Loaded .env file from current working directory');
  }
}

// Log DATABASE_URL status (without exposing the actual value)
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  const maskedUrl = dbUrl.length > 20 
    ? dbUrl.substring(0, 10) + '...' + dbUrl.substring(dbUrl.length - 10)
    : '***';
  console.log(`✅ DATABASE_URL is set: ${maskedUrl}`);
} else {
  console.error('❌ DATABASE_URL is NOT set!');
  console.error('   Please create a .env file in the project root with DATABASE_URL');
}

// Log Supabase environment variables status
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('🔵 Supabase Configuration:', {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  hasServiceKey: !!supabaseServiceKey,
  urlSource: supabaseUrl ? (process.env.SUPABASE_URL ? 'SUPABASE_URL' : 'VITE_SUPABASE_URL') : 'none'
});

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { db } from './src/services/database.js';
import { embeddingService } from './src/services/embeddingService.js';
import { authenticateRequest, optionalAuth } from './server/middleware/auth.js';
import { apiLimiter, recipeCreationLimiter, searchLimiter } from './server/middleware/rateLimit.js';
import { validateRecipeCreation, validateRecipeUpdate, validateRecipeId, validateRAGSearch } from './server/middleware/validation.js';
import { sanitizeRecipe, sanitizeSearchQuery, sanitizeUrlParams } from './server/middleware/sanitization.js';
import { securityHeaders, requestSizeLimits, secureErrorHandler } from './server/middleware/security.js';

// Initialize Supabase client for RPC calls (uses anon key)
let supabaseClient = null;
function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('⚠️ Supabase not configured for RPC calls');
    return null;
  }

  supabaseClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

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

// Security middleware (must be applied early)
app.use(securityHeaders);

// CORS middleware
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

// Cookie parser with secure settings
app.use(cookieParser());

// Body parser with size limits to prevent DoS
app.use(express.json(requestSizeLimits.json));
app.use(express.urlencoded(requestSizeLimits.urlencoded));

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

      // Determine timeout based on intent - recipe extraction needs more time for large text
      const isRecipeExtraction = data.intent === 'recipe_extraction';
      const timeoutMs = isRecipeExtraction ? 120000 : 30000; // 120s for recipe extraction, 30s for general chat
      console.log(`Using timeout: ${timeoutMs}ms for intent: ${data.intent || 'general_chat'}`);

      const webhookPayload = {
        content: data.content,
        intent: data.intent || null,
        sessionId: data.sessionId || user.id || 'default-session',
        userId: data.userId || user.id
      };
      
      console.log('Sending webhook payload:', JSON.stringify(webhookPayload, null, 2));

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(timeoutMs) // Dynamic timeout based on intent
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
    const { message, context, intent } = req.body;
    const user = getTestUser();

    console.log('Received chat message:', message);
    console.log('Detected intent:', intent);

    // Send webhook event for chat message and wait for n8n response
    console.log('Sending message to n8n webhook and waiting for response...');
          const webhookResponse = await webhookService.chatMessageSent({
        id: Date.now().toString(),
        content: message,
        type: 'text',
        intent: intent || null, // Pass intent to webhook service
        context,
        userId: user.id,
        sessionId: context?.sessionId || 'default-session' // Use sessionId from context
      }, user);
    
    let aiResponse;
    let recipe = null;

    if (webhookResponse && webhookResponse.output) {
      aiResponse = webhookResponse.output;
      console.log('Using n8n AI response (output field):', aiResponse);
      
      // Try to extract recipe from output if it's JSON
      try {
        // Check if output is a JSON string containing a recipe
        const parsedOutput = JSON.parse(aiResponse);
        if (parsedOutput.recipe) {
          recipe = parsedOutput.recipe;
          console.log('✅ Extracted recipe from output JSON:', recipe.title || 'Untitled');
          // Use a user-friendly message instead of raw JSON
          aiResponse = `I've extracted the recipe: ${recipe.title || 'Untitled Recipe'}. You can save it to your recipe collection!`;
        }
      } catch (parseError) {
        // Not JSON or doesn't contain recipe - use output as-is
        // Also check if webhookResponse has a recipe field directly
        if (webhookResponse.recipe) {
          recipe = webhookResponse.recipe;
          console.log('✅ Found recipe in webhookResponse:', recipe.title || 'Untitled');
        }
      }
    } else if (webhookResponse && webhookResponse.content) {
      aiResponse = webhookResponse.content;
      console.log('Using n8n AI response (content field):', aiResponse);
      if (webhookResponse.recipe) {
        recipe = webhookResponse.recipe;
      }
    } else if (webhookResponse && webhookResponse.message) {
      aiResponse = webhookResponse.message;
      console.log('Using n8n AI response (message field):', aiResponse);
      if (webhookResponse.recipe) {
        recipe = webhookResponse.recipe;
      }
    } else if (webhookResponse && typeof webhookResponse === 'string') {
      aiResponse = webhookResponse;
      console.log('Using n8n AI response (string):', aiResponse);
    } else {
      console.error('❌ No response from n8n webhook - n8n may not be running or returned empty response');
      console.error('Webhook response:', webhookResponse);
      
      // Return proper error status instead of fallback message
      return res.status(503).json({
        error: 'AI service unavailable',
        message: 'The AI service (n8n) is currently unavailable. Please make sure n8n is running and the workflow is active.',
        details: {
          webhookUrl: N8N_WEBHOOK_URL,
          webhookEnabled: WEBHOOK_ENABLED,
          responseReceived: !!webhookResponse,
          responseType: webhookResponse ? typeof webhookResponse : 'null'
        }
      });
    }

    // Build response with recipe if available
    const responseData = {
      message: 'Message processed successfully',
      response: {
        id: Date.now().toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date().toISOString()
      }
    };

    // Add recipe to response if extracted
    if (recipe) {
      responseData.recipe = recipe;
      console.log('✅ Including recipe in response:', recipe.title || 'Untitled');
    }

    res.json(responseData);

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Feedback endpoint - store user feedback on AI messages
app.post('/api/chat/feedback', async (req, res) => {
  try {
    const { messageId, conversationId, sessionId, feedback, messageContent, timestamp } = req.body;
    const user = getTestUser();

    console.log('📊 Received feedback:', {
      messageId,
      conversationId,
      sessionId,
      feedback,
      timestamp,
      messagePreview: messageContent?.substring(0, 100)
    });

    // TODO: Store feedback in database for analytics
    // For now, just log it
    // Future: Use this feedback to:
    // 1. Improve AI responses (fine-tuning data)
    // 2. Identify problematic patterns
    // 3. Track user satisfaction
    // 4. A/B test different response styles

    res.json({
      success: true,
      message: 'Feedback received',
      feedback: {
        messageId,
        feedback,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ 
      error: 'Failed to process feedback',
      message: error.message
    });
  }
});

// Helper function to check for duplicate recipes using semantic similarity
async function checkForDuplicateRecipe(recipe, userId) {
  try {
    // Create searchable text from recipe
    const recipeText = [
      recipe.title,
      recipe.description || '',
      JSON.stringify(recipe.ingredients || []),
      JSON.stringify(recipe.instructions || [])
    ].join(' ');

    // Generate embedding for new recipe
    const embedding = await embeddingService.generateEmbedding(recipeText);
    
    // Search for similar recipes using semantic similarity (threshold: 0.85 = 85% similar)
    const similarRecipes = await db.searchSimilarRecipes(embedding, userId, 0.85, 5);
    
    if (similarRecipes.length > 0) {
      // Found potential duplicates
      return {
        isDuplicate: true,
        similarRecipes: similarRecipes.map(r => ({
          id: r.recipe_id,
          title: r.title,
          description: r.description,
          similarity: Math.round((r.similarity_score || 0) * 100) // Convert to percentage
        }))
      };
    }
    
    return { isDuplicate: false, similarRecipes: [] };
  } catch (error) {
    console.error('Duplicate check error:', error);
    // Don't block recipe creation if duplicate check fails
    return { isDuplicate: false, similarRecipes: [], error: error.message };
  }
}

// Recipe storage endpoint
app.post('/api/recipes', 
  recipeCreationLimiter, // Apply stricter rate limiting for recipe creation
  authenticateRequest, // Require authentication
  sanitizeRecipe, // Sanitize input to prevent XSS
  validateRecipeCreation, // Validate request body
  async (req, res) => {
  try {
    const { recipe, forceSave = false } = req.body;
    const user = req.user; // Get authenticated user from middleware

    console.log('Received recipe for storage:', recipe.title);

    // Check for duplicates before saving (unless forceSave is true)
    if (!forceSave) {
      const duplicateCheck = await checkForDuplicateRecipe(recipe, user.id);
      
      if (duplicateCheck.isDuplicate && duplicateCheck.similarRecipes.length > 0) {
        // Found potential duplicate - return duplicate info instead of saving
        return res.json({
          message: 'Potential duplicate recipe found',
          isDuplicate: true,
          existingRecipe: duplicateCheck.similarRecipes[0], // Most similar recipe
          allSimilar: duplicateCheck.similarRecipes, // All similar recipes
          newRecipe: {
            title: recipe.title,
            description: recipe.description
          }
        });
      }
    }

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
    const currentUser = req.user || null; // Get user from request, may be null
    console.error('Recipe retrieval error:', error);
    console.error('Error stack:', error.stack);
    console.error('User context:', { userId: currentUser?.id, hasUser: !!currentUser });
    
    // Check for database connection errors
    const isConnectionError = error.code === 'ECONNREFUSED' || 
                              error.code === 'ENOTFOUND' ||
                              (error.message && error.message.includes('ECONNREFUSED')) ||
                              (error.message && error.message.includes('connection')) ||
                              (error.errors && error.errors.some((e) => e.code === 'ECONNREFUSED'));
    
    if (isConnectionError) {
      return res.status(503).json({ 
        error: 'Database connection failed',
        message: 'Unable to connect to the database. Please check your DATABASE_URL environment variable and ensure the database server is running.',
        hint: 'Set DATABASE_URL in your .env file. For NeonDB: postgresql://user:password@host.neon.tech/dbname?sslmode=require',
        code: error.code || 'ECONNREFUSED',
        details: process.env.NODE_ENV === 'development' ? {
          error: error.message,
          stack: error.stack,
          userId: currentUser?.id,
          hasUser: !!currentUser
        } : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get single recipe endpoint (by ID or slug)
// Supports both authenticated and unauthenticated access for public recipes
// Route supports both UUID and slug: /api/recipes/:idOrSlug
app.get('/api/recipes/:idOrSlug', 
  optionalAuth, // Optional authentication - allows unauthenticated access for public recipes
  sanitizeUrlParams, // Sanitize URL parameters
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
  sanitizeUrlParams, // Sanitize URL parameters
  sanitizeRecipe, // Sanitize input to prevent XSS
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

    // Regenerate embedding for the updated recipe
    // This ensures search and duplicate detection work with the latest recipe content
    try {
      // Delete old embeddings
      await db.deleteEmbeddings(recipeId);
      
      // Generate new embedding for updated recipe
      const { embedding, textContent } = await embeddingService.generateRecipeEmbedding(updatedRecipe);
      await db.createEmbedding({
        recipe_id: recipeId,
        embedding: embedding,
        text_content: textContent,
        embedding_type: 'recipe_content'
      });
      console.log('✅ Regenerated embedding for updated recipe:', recipeId);
    } catch (embeddingError) {
      console.error('⚠️ Failed to regenerate embedding for updated recipe:', embeddingError);
      // Don't fail the recipe update if embedding generation fails
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

// Create profile endpoint (called after Supabase Auth signup)
app.post('/api/profile',
  authenticateRequest, // Require authentication
  async (req, res) => {
  try {
    const user = req.user; // Get authenticated user from middleware
    const { userId, firstName, lastName, email } = req.body;

    // Validate input
    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'First name is required and must be a non-empty string'
      });
    }

    if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Last name is required and must be a non-empty string'
      });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Valid email address is required'
      });
    }

    // Use the authenticated user's ID (Supabase Auth UUID)
    const profileUserId = user.id;

    // Create profile in database using Supabase user ID
    // Check if id column is UUID or if we need to use a different column
    let result = null;
    try {
      // Check if id column is UUID type
      const columnCheck = await db.query(`
        SELECT data_type 
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id';
      `);
      
      if (columnCheck.rows.length > 0 && columnCheck.rows[0].data_type === 'uuid') {
        // Use id column directly (UUID type for Supabase Auth)
        result = await db.query(
          `INSERT INTO profiles (id, email, first_name, last_name, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE 
           SET first_name = EXCLUDED.first_name, 
               last_name = EXCLUDED.last_name,
               email = EXCLUDED.email,
               updated_at = CURRENT_TIMESTAMP
           RETURNING id, email, first_name, last_name, created_at, updated_at`,
          [profileUserId, email.trim(), firstName.trim(), lastName.trim()],
          profileUserId // Pass userId for RLS context
        );
      } else {
        // Use id column (UUID from Supabase Auth)
        result = await db.query(
          `INSERT INTO profiles (id, email, first_name, last_name, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE 
           SET first_name = EXCLUDED.first_name, 
               last_name = EXCLUDED.last_name,
               email = EXCLUDED.email,
               updated_at = CURRENT_TIMESTAMP
           RETURNING id, email, first_name, last_name, created_at, updated_at`,
          [profileUserId, email.trim(), firstName.trim(), lastName.trim()],
          profileUserId // Pass userId for RLS context
        );
      }
    } catch (err) {
      // If profiles table doesn't exist, try users table (legacy)
      if (err.message && err.message.includes('does not exist')) {
        const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
        result = await db.query(
          `INSERT INTO users (id, email, display_name, created_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE 
           SET display_name = EXCLUDED.display_name,
               email = EXCLUDED.email,
               updated_at = CURRENT_TIMESTAMP
           RETURNING id, email, display_name, created_at, updated_at`,
          [profileUserId, email.trim(), displayName],
          profileUserId
        );
        // Convert display_name to first_name/last_name for response
        if (result.rows.length > 0 && result.rows[0].display_name) {
          const parts = result.rows[0].display_name.split(' ');
          result.rows[0].first_name = parts[0] || '';
          result.rows[0].last_name = parts.slice(1).join(' ') || '';
        }
      } else {
        throw err;
      }
    }

    if (!result || result.rows.length === 0) {
      return res.status(500).json({
        error: 'Profile creation failed',
        message: 'Failed to create user profile'
      });
    }

    const profile = result.rows[0];

    res.status(201).json({
      message: 'Profile created successfully',
      profile: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    });

  } catch (error) {
    console.error('Profile creation error:', error);
    
    // Check if it's a duplicate key error (profile already exists)
    if (error.code === '23505' || (error.message && error.message.includes('already exists'))) {
      return res.status(409).json({
        error: 'Profile already exists',
        message: 'User profile already exists'
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get profile endpoint - uses Supabase RPC for secure database access
app.get('/api/profile',
  authenticateRequest, // Require authentication
  async (req, res) => {
  try {
    const user = req.user; // Get authenticated user from middleware
    const supabase = getSupabaseClient();

    if (!supabase) {
      return res.status(500).json({
        error: 'Supabase not configured',
        message: 'Please configure SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).'
      });
    }

    // Use Supabase RPC function for secure profile retrieval
    // The RPC function uses auth.uid() automatically and respects RLS
    // We need to set the access token in the Supabase client for the RPC call
    // Extract access token from request (same logic as auth middleware)
    let accessToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.replace('Bearer ', '');
    } else {
      // Check cookies (Supabase stores tokens in cookies)
      const cookies = req.cookies || {};
      const supabaseCookieNames = Object.keys(cookies).filter(name => 
        name.startsWith('sb-') && name.endsWith('-auth-token')
      );
      const possibleCookieNames = [
        ...supabaseCookieNames,
        'sb-access-token',
        'sb-refresh-token',
        'supabase-auth-token',
        'supabase.auth.token',
      ];
      for (const cookieName of possibleCookieNames) {
        if (cookies[cookieName]) {
          try {
            const parsed = JSON.parse(cookies[cookieName]);
            if (parsed.access_token) {
              accessToken = parsed.access_token;
              break;
            }
            if (parsed.token) {
              accessToken = parsed.token;
              break;
            }
            if (Array.isArray(parsed) && parsed.length > 1) {
              accessToken = parsed[1];
              break;
            }
            accessToken = cookies[cookieName];
            break;
          } catch {
            accessToken = cookies[cookieName];
            break;
          }
        }
      }
    }

    if (accessToken) {
      // Create a client with the user's access token for RPC calls
      const userSupabase = createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      );

      // Call RPC function to get user profile
      const { data, error } = await userSupabase.rpc('get_user_profile');

      if (error) {
        console.error('❌ RPC get_user_profile error:', error);
        // Fallback to direct database query if RPC fails
        return res.status(500).json({
          error: 'Failed to retrieve profile',
          message: error.message
        });
      }

      if (!data || data.length === 0) {
        // Profile doesn't exist - auto-create using RPC
        const userEmail = user.email || `${user.id}@unknown.local`;
        const { data: createData, error: createError } = await userSupabase.rpc('create_or_update_profile', {
          p_first_name: 'User',
          p_last_name: '',
          p_email: userEmail
        });

        if (createError || !createData || createData.length === 0) {
          console.error('❌ Failed to auto-create profile:', createError);
          return res.status(404).json({
            error: 'Profile not found',
            message: 'User profile does not exist and could not be auto-created'
          });
        }

        const profile = createData[0];
        return res.json({
          profile: {
            id: profile.id,
            email: profile.email,
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            createdAt: profile.created_at,
            updatedAt: profile.updated_at
          }
        });
      }

      const profile = data[0];
      return res.json({
        profile: {
          id: profile.id,
          email: profile.email,
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          createdAt: profile.created_at,
          updatedAt: profile.updated_at
        }
      });
    }

    // Fallback: If no access token, return error
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No access token found'
    });

  } catch (error) {
    console.error('Profile retrieval error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Update profile endpoint - uses Supabase RPC for secure database access
app.put('/api/profile',
  authenticateRequest, // Require authentication
  async (req, res) => {
  try {
    const user = req.user; // Get authenticated user from middleware
    const { firstName, lastName } = req.body;

    // Validate input
    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'First name is required and must be a non-empty string'
      });
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      return res.status(500).json({
        error: 'Supabase not configured',
        message: 'Please configure SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).'
      });
    }

    // Get access token for RPC call
    // Extract access token from request (same logic as auth middleware)
    let accessToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.replace('Bearer ', '');
    } else {
      // Check cookies (Supabase stores tokens in cookies)
      const cookies = req.cookies || {};
      const supabaseCookieNames = Object.keys(cookies).filter(name => 
        name.startsWith('sb-') && name.endsWith('-auth-token')
      );
      const possibleCookieNames = [
        ...supabaseCookieNames,
        'sb-access-token',
        'sb-refresh-token',
        'supabase-auth-token',
        'supabase.auth.token',
      ];
      for (const cookieName of possibleCookieNames) {
        if (cookies[cookieName]) {
          try {
            const parsed = JSON.parse(cookies[cookieName]);
            if (parsed.access_token) {
              accessToken = parsed.access_token;
              break;
            }
            if (parsed.token) {
              accessToken = parsed.token;
              break;
            }
            if (Array.isArray(parsed) && parsed.length > 1) {
              accessToken = parsed[1];
              break;
            }
            accessToken = cookies[cookieName];
            break;
          } catch {
            accessToken = cookies[cookieName];
            break;
          }
        }
      }
    }

    if (!accessToken) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No access token found'
      });
    }

    // Create a client with the user's access token for RPC calls
    const userSupabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    // Get current profile to get email
    const { data: currentProfile, error: getError } = await userSupabase.rpc('get_user_profile');

    if (getError || !currentProfile || currentProfile.length === 0) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'User profile does not exist'
      });
    }

    const profileEmail = currentProfile[0].email || user.email || `${user.id}@unknown.local`;

    // Use RPC function to update profile
    const { data, error } = await userSupabase.rpc('create_or_update_profile', {
      p_first_name: firstName.trim(),
      p_last_name: (lastName || '').trim(),
      p_email: profileEmail
    });

    if (error) {
      console.error('❌ RPC create_or_update_profile error:', error);
      return res.status(500).json({
        error: 'Failed to update profile',
        message: error.message
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'User profile does not exist'
      });
    }

    const updatedProfile = data[0];

    res.json({
      message: 'Profile updated successfully',
      profile: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        firstName: updatedProfile.first_name || '',
        lastName: updatedProfile.last_name || '',
        createdAt: updatedProfile.created_at,
        updatedAt: updatedProfile.updated_at
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
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
  sanitizeSearchQuery, // Sanitize search query to prevent XSS
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

// Secure error handler (must be last middleware)
app.use(secureErrorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log(`🌐 Server accessible on all network interfaces (including 192.168.1.143:${PORT})`);
  console.log(`📡 n8n webhook URL: ${N8N_WEBHOOK_URL}`);
  console.log(`🔧 Webhook enabled: ${WEBHOOK_ENABLED}`);
  console.log(`🌐 CORS enabled for localhost:5173`);
  console.log(`🔒 Security headers enabled`);
  console.log(`🔗 Server listening on all interfaces (0.0.0.0:${PORT})`);
});
