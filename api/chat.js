import { neon } from '@neondatabase/serverless';

// Database connection
const sql = neon(process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost/dummy');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

// Webhook service
const webhookService = {
  async sendEvent(eventType, data, user = null, metadata = {}) {
    console.log('Webhook service called with:', {
      eventType,
      webhookEnabled: process.env.WEBHOOK_ENABLED,
      webhookUrl: process.env.N8N_WEBHOOK_URL ? 'configured' : 'not configured'
    });

    if (process.env.WEBHOOK_ENABLED !== 'true' || !process.env.N8N_WEBHOOK_URL) {
      console.error('Webhook not properly configured');
      throw new Error('Webhook not configured');
    }

    try {
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data,
        user,
        metadata
      };

      console.log('Sending webhook payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(process.env.N8N_WEBHOOK_URL, {
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
      throw error;
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

  try {
    const { method, url } = req;
    const urlObj = new URL(url, `https://${req.headers.host}`);
    const path = urlObj.pathname;

    console.log('Function called:', { method, path });

    // Get test user
    const user = getTestUser();

    // Route handling
    if (method === 'POST' && path === '/api/chat/message') {
      const { message, context } = req.body;

      // Save user message first
      const userMessageResult = await sql`
        INSERT INTO chat_messages (user_id, content, sender, message_type, metadata, created_at)
        VALUES (${user.id}, ${message}, 'user', 'text', '{}', NOW())
        RETURNING id
      `;

      const userMessageId = userMessageResult[0].id;

      // Send webhook event for chat message and wait for n8n response
      console.log('Sending message to n8n webhook and waiting for response...');
      const webhookResponse = await webhookService.chatMessageSent({
        id: userMessageId,
        content: message,
        type: 'text',
        context
      }, user);

      // Determine the AI response based on webhook response
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
        return res.status(503).json({ 
          error: 'AI service unavailable',
          message: 'The AI service (n8n) is currently unavailable. Please make sure n8n is running on http://localhost:5678 and the workflow is active.'
        });
      }

      // Save AI response to database
      const aiMessageResult = await sql`
        INSERT INTO chat_messages (user_id, content, sender, message_type, metadata, created_at)
        VALUES (${user.id}, ${aiResponse}, 'ai', 'text', '{}', NOW())
        RETURNING id
      `;

      const aiMessageId = aiMessageResult[0].id;

      return res.status(200).json({
        message: 'Message processed successfully',
        response: {
          id: aiMessageId,
          content: aiResponse,
          sender: 'ai',
          timestamp: new Date()
        }
      });

    } else if (method === 'GET' && path === '/api/health') {
      return res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        webhookEnabled: process.env.WEBHOOK_ENABLED === 'true',
        webhookUrlConfigured: !!process.env.N8N_WEBHOOK_URL,
        databaseUrlConfigured: !!process.env.DATABASE_URL
      });

    } else {
      return res.status(404).json({ 
        error: 'Route not found',
        message: `No handler found for ${method} ${path}`
      });
    }

  } catch (error) {
    console.error('Function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
