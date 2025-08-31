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
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://agents.eaglesightlabs.com/webhook/cc0fb704-932c-467c-96a8-87c75f962c35';

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
      const payload = {
        content: data.content,
        user: user?.displayName || 'User',
        timestamp: new Date().toISOString()
      };

      console.log('Sending webhook payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
        
        try {
          const responseData = JSON.parse(responseText);
          return responseData;
        } catch (parseError) {
          return { content: responseText };
        }
      }
      } catch (error) {
    console.error('Webhook error:', error.message);
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
    console.log('Testing webhook connectivity...');
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    res.json({
      status: response.status,
      ok: response.ok,
      webhookUrl: N8N_WEBHOOK_URL,
      message: response.ok ? 'Webhook is reachable' : 'Webhook returned error status'
    });
  } catch (error) {
    res.json({
      status: 'error',
      webhookUrl: N8N_WEBHOOK_URL,
      message: error.message,
      error: 'Webhook is not reachable'
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
      context
    }, user);

    // Determine the AI response based on webhook response
    let aiResponse;

    if (webhookResponse && webhookResponse.content) {
      aiResponse = webhookResponse.content;
      console.log('Using n8n AI response:', aiResponse);
    } else if (webhookResponse && webhookResponse.message) {
      aiResponse = webhookResponse.message;
      console.log('Using n8n AI response (message field):', aiResponse);
    } else if (webhookResponse && typeof webhookResponse === 'string') {
      aiResponse = webhookResponse;
      console.log('Using n8n AI response (string):', aiResponse);
    } else {
      console.log('No response from n8n webhook - n8n may not be running');
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'The AI service (n8n) is currently unavailable. Please make sure n8n is running on http://localhost:5678 and the workflow is active.'
      });
    }

    res.json({
      message: 'Message processed successfully',
      response: {
        id: Date.now().toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log(`📡 n8n webhook URL: ${N8N_WEBHOOK_URL}`);
  console.log(`🔧 Webhook enabled: ${WEBHOOK_ENABLED}`);
  console.log(`🌐 CORS enabled for localhost:5173`);
});
