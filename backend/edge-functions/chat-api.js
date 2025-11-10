import { neon } from '@neondatabase/serverless';
import fetch from 'node-fetch';

// Vercel Edge Runtime configuration
export const runtime = 'edge';

// Database connection
const sql = neon(process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost/dummy');

// Enhanced webhook service with response handling
const webhookService = {
  async sendEvent(eventType, data, user = null, metadata = {}) {
    console.log('Webhook service called with:', {
      eventType,
      webhookEnabled: process.env.WEBHOOK_ENABLED,
      webhookUrl: process.env.N8N_WEBHOOK_URL ? 'configured' : 'not configured'
    });

    if (process.env.WEBHOOK_ENABLED !== 'true' || !process.env.N8N_WEBHOOK_URL) {
      console.error('Webhook not properly configured');
      console.error('WEBHOOK_ENABLED:', process.env.WEBHOOK_ENABLED);
      console.error('N8N_WEBHOOK_URL:', process.env.N8N_WEBHOOK_URL ? 'set' : 'not set');
      throw new Error('Webhook not configured');
    }

    try {
      // Flatten payload structure for n8n webhook - ensures all fields are at top level
      // This prevents data loss and makes it easier for n8n nodes to access fields
      const payload = {
        // Core message data (flattened from data object)
        content: data.content || data.message || '',
        messageId: data.id || null,
        type: data.type || 'text',
        intent: data.intent || null,
        sessionId: data.sessionId || null,
        userId: user?.id || data.userId || null,
        context: data.context || {},
        
        // Metadata (kept separate for reference)
        event: eventType,
        timestamp: new Date().toISOString(),
        user: user ? {
          id: user.id,
          email: user.email,
          name: user.name
        } : null,
        metadata: metadata || {}
      };

      // Determine timeout based on intent - recipe extraction needs more time for large text
      const isRecipeExtraction = data.intent === 'recipe_extraction';
      const timeoutMs = isRecipeExtraction ? 120000 : 30000; // 120s for recipe extraction, 30s for general chat
      console.log(`Using timeout: ${timeoutMs}ms for intent: ${data.intent || 'general_chat'}`);

      console.log('Sending webhook payload:', JSON.stringify(payload, null, 2));
      console.log('Webhook URL:', process.env.N8N_WEBHOOK_URL);

      const response = await fetch(process.env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs) // Dynamic timeout based on intent
      });

      console.log('Webhook response status:', response.status);
      console.log('Webhook response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Webhook failed: ${response.status} ${response.statusText}`);
        console.error('Webhook error response:', errorText);
        return null;
      } else {
        const responseText = await response.text();
        console.log(`Webhook sent successfully: ${eventType}`);
        console.log('Webhook response body:', responseText);
        
        // Try to parse the response as JSON
        try {
          const responseData = JSON.parse(responseText);
          return responseData;
        } catch (parseError) {
          console.log('Webhook response is not JSON, treating as text');
          return { content: responseText };
        }
      }
    } catch (error) {
      console.error('Webhook error:', error.message);
      console.error('Webhook error stack:', error.stack);
      throw error;
    }
  },

  async chatMessageSent(message, user) {
    console.log('chatMessageSent called with:', { message, user });
    return this.sendEvent('chat.message.sent', message, user);
  },

  async recipeCreated(recipe, user) {
    console.log('recipeCreated called with:', { recipe, user });
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

// User authentication - replace with your actual auth logic
const getAuthenticatedUser = async (request) => {
  // TODO: Implement proper authentication
  // For now, return a test user to allow webhook testing
  return {
    id: '11111111-1111-1111-1111-111111111111',
    neonUserId: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    familyId: '11111111-1111-1111-1111-111111111111',
    householdSize: 4
  };
};

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

    // Get authenticated user
    const user = await getAuthenticatedUser(request);
    
    // Require authentication for all operations
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route handling
    if (method === 'POST' && path === '/api/chat/message') {
      return await handleSendMessage(body, user);
    } else if (method === 'GET' && path === '/api/chat/history') {
      const limit = urlObj.searchParams.get('limit') || 50;
      return await handleGetHistory(user, parseInt(limit));
    } else if (method === 'DELETE' && path === '/api/chat/history') {
      return await handleClearHistory(user);
    } else if (method === 'POST' && path === '/api/recipes') {
      return await handleCreateRecipe(body, user);
    } else if (method === 'GET' && path === '/api/recipes') {
      return await handleGetRecipes(user);
    } else if (method === 'POST' && path === '/api/webhook/n8n-response') {
      return await handleN8nResponse(body);
    } else if (method === 'GET' && path === '/api/health') {
      return new Response(JSON.stringify({
        status: 'OK',
        timestamp: new Date().toISOString(),
        webhookEnabled: process.env.WEBHOOK_ENABLED,
        webhookUrlConfigured: !!process.env.N8N_WEBHOOK_URL,
        databaseUrlConfigured: !!process.env.DATABASE_URL
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (method === 'GET' && path === '/api/debug/env') {
      // Temporary debug endpoint - remove in production
      return new Response(JSON.stringify({
        webhookEnabled: process.env.WEBHOOK_ENABLED,
        webhookUrlConfigured: !!process.env.N8N_WEBHOOK_URL,
        databaseUrlConfigured: !!process.env.DATABASE_URL
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Route not found',
      message: `No handler found for ${method} ${path}`
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle sending a chat message
async function handleSendMessage(body, user) {
  try {
    const { message, context, intent, sessionId } = JSON.parse(body);

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
      intent: intent || null, // Add intent to webhook payload
      sessionId: sessionId || context?.sessionId || null,
      context: context || {}
    }, user);

    // Determine the AI response based on webhook response
    let aiResponse;
    let recipe = null;

    if (webhookResponse && webhookResponse.output) {
      // Use the response from n8n (primary format)
      aiResponse = webhookResponse.output;
      console.log('Using n8n AI response (output field):', aiResponse);
      // Check if recipe is included in the response
      if (webhookResponse.recipe) {
        recipe = webhookResponse.recipe;
        console.log('Found recipe in n8n response:', recipe.title || 'Untitled');
      }
    } else if (webhookResponse && webhookResponse.content) {
      // Alternative response format
      aiResponse = webhookResponse.content;
      console.log('Using n8n AI response (content field):', aiResponse);
      if (webhookResponse.recipe) {
        recipe = webhookResponse.recipe;
      }
    } else if (webhookResponse && webhookResponse.message) {
      // Alternative response format
      aiResponse = webhookResponse.message;
      console.log('Using n8n AI response (message field):', aiResponse);
      if (webhookResponse.recipe) {
        recipe = webhookResponse.recipe;
      }
    } else if (webhookResponse && typeof webhookResponse === 'string') {
      // Direct string response
      aiResponse = webhookResponse;
      console.log('Using n8n AI response (string):', aiResponse);
    } else {
      // No webhook response - return error
      console.log('No response from n8n webhook');
      console.log('Webhook response:', JSON.stringify(webhookResponse, null, 2));
      return new Response(JSON.stringify({ 
        error: 'AI service unavailable',
        message: 'The AI service is currently unavailable. Please try again later.'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save AI response to database
    const aiMessageResult = await sql`
      INSERT INTO chat_messages (user_id, content, sender, message_type, metadata, created_at)
      VALUES (${user.id}, ${aiResponse}, 'ai', 'text', '{}', NOW())
      RETURNING id
    `;

    const aiMessageId = aiMessageResult[0].id;

    // Build response object with optional recipe
    const responseData = {
      message: 'Message processed successfully',
      response: {
        id: aiMessageId,
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      }
    };

    // Include recipe in response if present
    if (recipe) {
      responseData.recipe = recipe;
      console.log('Including recipe in API response:', recipe.title || 'Untitled');
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Send message error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process message' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle getting chat history
async function handleGetHistory(user, limit) {
  try {
    const messages = await sql`
      SELECT * FROM chat_messages 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    // Reverse to get chronological order
    const reversedMessages = messages.reverse().map(msg => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      type: msg.message_type,
      timestamp: msg.created_at
    }));

    return new Response(JSON.stringify({ messages: reversedMessages }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Get history error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get chat history' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle clearing chat history
async function handleClearHistory(user) {
  try {
    await sql`
      DELETE FROM chat_messages 
      WHERE user_id = ${user.id}
    `;

    return new Response(JSON.stringify({ message: 'Chat history cleared successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Clear history error:', error);
    return new Response(JSON.stringify({ error: 'Failed to clear chat history' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle creating a recipe
async function handleCreateRecipe(body, user) {
  try {
    const recipeData = JSON.parse(body);

    const result = await sql`
      INSERT INTO recipes (
        user_id, title, description, ingredients, instructions, 
        prep_time, cook_time, total_time, servings, difficulty, 
        tags, image_url, rating, nutrition_info, source_url, 
        is_public
      )
      VALUES (
        ${user.id}, ${recipeData.title}, ${recipeData.description || null}, 
        ${JSON.stringify(recipeData.ingredients)}, ${JSON.stringify(recipeData.instructions)},
        ${recipeData.prepTime || null}, ${recipeData.cookTime || null}, 
        ${recipeData.totalTime || null}, ${recipeData.servings || 4}, 
        ${recipeData.difficulty || 'medium'}, ${JSON.stringify(recipeData.tags || [])},
        ${recipeData.imageUrl || null}, ${recipeData.rating || null}, 
        ${JSON.stringify(recipeData.nutritionInfo || null)}, ${recipeData.sourceUrl || null},
        ${false}
      )
      RETURNING *
    `;

    const newRecipe = result[0];

    // Send webhook event
    await webhookService.recipeCreated(newRecipe, user);

    return new Response(JSON.stringify({
      message: 'Recipe created successfully',
      recipe: {
        id: newRecipe.id,
        title: newRecipe.title,
        description: newRecipe.description,
        ingredients: newRecipe.ingredients,
        instructions: newRecipe.instructions,
        prep_time: newRecipe.prep_time,
        cook_time: newRecipe.cook_time,
        total_time: newRecipe.total_time,
        servings: newRecipe.servings,
        difficulty: newRecipe.difficulty,
        tags: newRecipe.tags,
        image_url: newRecipe.image_url,
        rating: newRecipe.rating,
        nutrition_info: newRecipe.nutrition_info,
        source_url: newRecipe.source_url,
        is_public: newRecipe.is_public,
        created_at: newRecipe.created_at,
        updated_at: newRecipe.updated_at
      }
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Create recipe error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create recipe' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle getting recipes
async function handleGetRecipes(user) {
  try {
    const recipes = await sql`
      SELECT * FROM recipes 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return new Response(JSON.stringify({ recipes }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Get recipes error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get recipes' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Handle n8n webhook responses (for Option 2 implementation)
async function handleN8nResponse(body) {
  try {
    const responseData = await body.json();
    console.log('Received n8n response webhook:', JSON.stringify(responseData, null, 2));

    // Extract the AI response from n8n
    let aiResponse = null;
    let messageId = null;
    let userId = null;

    // Try different response formats
    if (responseData.content) {
      aiResponse = responseData.content;
    } else if (responseData.message) {
      aiResponse = responseData.message;
    } else if (responseData.response) {
      aiResponse = responseData.response;
    } else if (typeof responseData === 'string') {
      aiResponse = responseData;
    }

    // Extract message ID and user ID if provided
    if (responseData.messageId) {
      messageId = responseData.messageId;
    }
    if (responseData.userId) {
      userId = responseData.userId;
    }

    if (!aiResponse) {
      console.error('No AI response found in n8n webhook data');
      return new Response(JSON.stringify({ error: 'No AI response provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If we have a message ID, update the existing message
    if (messageId) {
      await sql`
        UPDATE chat_messages 
        SET content = ${aiResponse}, updated_at = NOW()
        WHERE id = ${messageId}
      `;
      console.log('Updated existing message with AI response');
    } else {
      // No message ID provided - return error
      console.error('No message ID provided in n8n response');
      return new Response(JSON.stringify({ 
        error: 'Invalid response format',
        message: 'The AI response is missing required information.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'AI response processed successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Handle n8n response error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process n8n response' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
