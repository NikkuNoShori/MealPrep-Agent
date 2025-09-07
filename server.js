import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { config } from 'dotenv';
import { db } from './src/services/database.js';
import { embeddingService } from './src/services/embeddingService.js';

// Load environment variables
config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Test user for development
const getTestUser = () => ({
  id: '11111111-1111-1111-1111-111111111111',
  neonUserId: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  familyId: '11111111-1111-1111-1111-111111111111',
  householdSize: 4
});

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
app.post('/api/recipes', async (req, res) => {
  try {
    const { recipe } = req.body;
    const user = getTestUser();

    console.log('Received recipe for storage:', recipe.title);

    // Create the recipe in the database
    const storedRecipe = await db.createRecipe({
      user_id: user.id,
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      cuisine: recipe.cuisine,
      dietary_tags: recipe.dietary_tags,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      rating: recipe.rating,
      is_favorite: recipe.is_favorite || false
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
    console.error('Recipe storage error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get user's recipes
app.get('/api/recipes', async (req, res) => {
  try {
    const user = getTestUser();
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Get recipes from database
    const recipes = await db.getRecipes(user.id, limit, offset);

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

// RAG Search endpoint
app.post('/api/rag/search', async (req, res) => {
  try {
    const { query, userId, limit = 10, searchType = 'semantic' } = req.body;
    
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
app.get('/api/rag/similar/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { userId, limit = 5 } = req.query;
    
    console.log('RAG Similar request:', { recipeId, userId, limit });
    
    // Get the recipe to find similar ones
    const recipe = await db.getRecipe(recipeId, userId);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    // Generate embedding for the recipe
    const { embedding } = await embeddingService.generateRecipeEmbedding(recipe);
    
    // Find similar recipes
    const results = await db.searchSimilarRecipes(embedding, userId, 0.6, parseInt(limit));
    
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
app.post('/api/rag/ingredients', async (req, res) => {
  try {
    const { ingredients, userId, limit = 10 } = req.body;
    
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
app.post('/api/rag/recommendations', async (req, res) => {
  try {
    const { userId, preferences, limit = 10 } = req.body;
    
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
});
