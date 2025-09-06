import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { 
  searchRecipes, 
  generateRecipeEmbedding, 
  getSimilarRecipes, 
  searchByIngredients, 
  getRecommendations,
  batchGenerateEmbeddings 
} from './backend/rag-api-simple.js';

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

// Note: Recipe storage moved to direct Neon database access
// This server now only handles chat functionality

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

// Recipe endpoints removed - now using direct Neon database access
// See src/services/neon.ts for recipe operations

// Test endpoint
app.get('/api/rag/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'RAG API is working!',
    timestamp: new Date().toISOString()
  });
});

// RAG API endpoints
// Search recipes using RAG
app.post('/api/rag/search', async (req, res) => {
  try {
    console.log('🔍 RAG Search Request received:');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Content-Type:', req.get('Content-Type'));
    
    const { query, userId, limit } = req.body;
    console.log('Extracted params:', { query, userId, limit });
    
    const result = await searchRecipes({ query, userId, limit });
    console.log('RAG Search result:', result);
    res.json(result);
  } catch (error) {
    console.error('RAG search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate embedding for a recipe
app.post('/api/rag/embedding', async (req, res) => {
  try {
    const { recipeId } = req.body;
    const result = await generateRecipeEmbedding(recipeId);
    res.json(result);
  } catch (error) {
    console.error('Generate embedding error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get similar recipes
app.get('/api/rag/similar/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { userId, limit } = req.query;
    const result = await getSimilarRecipes(recipeId, userId, limit);
    res.json(result);
  } catch (error) {
    console.error('Get similar recipes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search by ingredients
app.post('/api/rag/ingredients', async (req, res) => {
  try {
    const { ingredients, userId, limit } = req.body;
    const result = await searchByIngredients(ingredients, userId, limit);
    res.json(result);
  } catch (error) {
    console.error('Search by ingredients error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recommendations
app.get('/api/rag/recommendations', async (req, res) => {
  try {
    const { userId, ...preferences } = req.query;
    const result = await getRecommendations(userId, preferences);
    res.json(result);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch generate embeddings
app.post('/api/rag/batch-embeddings', async (req, res) => {
  try {
    const { recipeIds } = req.body;
    const result = await batchGenerateEmbeddings(recipeIds);
    res.json(result);
  } catch (error) {
    console.error('Batch generate embeddings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log(`📡 n8n webhook URL: ${N8N_WEBHOOK_URL}`);
  console.log(`🔧 Webhook enabled: ${WEBHOOK_ENABLED}`);
  console.log(`🌐 CORS enabled for localhost:5173`);
  console.log(`🔗 Server listening on all interfaces (0.0.0.0:${PORT})`);
});
