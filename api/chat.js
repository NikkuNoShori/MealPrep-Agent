// Vercel Edge Runtime configuration
export const runtime = 'edge';

// Mock database for now - we'll add real database later
const mockDatabase = {
  messages: [],
  addMessage: (message) => {
    mockDatabase.messages.push({
      id: Date.now(),
      ...message,
      created_at: new Date().toISOString()
    });
  },
  getMessages: () => mockDatabase.messages.slice(-50)
};

// Mock webhook service for now
const webhookService = {
  async sendEvent(eventType, data, user = null, metadata = {}) {
    console.log('Mock webhook event:', eventType, data);
  },

  async chatMessageSent(message, user) {
    return this.sendEvent('chat.message.sent', message, user);
  },

  async recipeCreated(recipe, user) {
    return this.sendEvent('recipe.created', recipe, user);
  }
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

// Mock user for development
const getMockUser = () => ({
  id: '11111111-1111-1111-1111-111111111111',
  neonUserId: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  familyId: '11111111-1111-1111-1111-111111111111',
  householdSize: 4
});

// Chat message handlers
async function handleSendMessage(body, user) {
  try {
    const { message } = await body.json();
    
    // Store user message in mock database
    mockDatabase.addMessage({
      user_id: user.id,
      message,
      role: 'user'
    });

    // Send webhook
    await webhookService.chatMessageSent({ message, userId: user.id }, user);

    // Mock AI response
    const aiResponse = `I received your message: "${message}". This is a mock response from the edge function.`;

    // Store AI response in mock database
    mockDatabase.addMessage({
      user_id: user.id,
      message: aiResponse,
      role: 'assistant'
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: aiResponse,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(JSON.stringify({ error: 'Failed to send message' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleGetHistory(user, limit = 50) {
  try {
    const messages = mockDatabase.getMessages();

    return new Response(JSON.stringify({ 
      messages: messages,
      count: messages.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error getting history:', error);
    return new Response(JSON.stringify({ messages: [], count: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleClearHistory(user) {
  try {
    mockDatabase.messages = [];

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error clearing history:', error);
    return new Response(JSON.stringify({ error: 'Failed to clear history' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export default async function handler(request) {
  try {
    const { method, url, headers, body } = request;
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    console.log('Edge function called:', { method, path, url: urlObj.href });

    // Handle preflight requests
    if (method === 'OPTIONS') {
      console.log('Handling OPTIONS request');
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Mock authentication for development
    const user = getMockUser();

    // Route handling
    if (method === 'POST' && path === '/api/chat/message') {
      return await handleSendMessage(body, user);
    } else if (method === 'GET' && path === '/api/chat/history') {
      const limit = urlObj.searchParams.get('limit') || 50;
      return await handleGetHistory(user, parseInt(limit));
    } else if (method === 'DELETE' && path === '/api/chat/history') {
      return await handleClearHistory(user);
    }

    return new Response(JSON.stringify({ error: 'Route not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
