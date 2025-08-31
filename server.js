import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

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

    // TODO: Add database connection and recipe storage logic
    // For now, just log the recipe data
    console.log('Recipe data:', JSON.stringify(recipe, null, 2));

    // Simulate successful storage
    const storedRecipe = {
      id: Date.now(),
      ...recipe,
      user_id: user.id,
      created_at: new Date(),
      updated_at: new Date()
    };

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

    // TODO: Add database connection and recipe retrieval logic
    // For now, return empty array
    const recipes = [];

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log(`📡 n8n webhook URL: ${N8N_WEBHOOK_URL}`);
  console.log(`🔧 Webhook enabled: ${WEBHOOK_ENABLED}`);
  console.log(`🌐 CORS enabled for localhost:5173`);
});
