import { neon } from '@neondatabase/serverless';
import fetch from 'node-fetch';

// Database connection
const sql = neon(process.env.DATABASE_URL);

// Webhook service
const webhookService = {
  async sendEvent(eventType, data, user = null, metadata = {}) {
    if (process.env.WEBHOOK_ENABLED !== 'true' || !process.env.N8N_WEBHOOK_URL) {
      console.log('Webhook disabled or URL not configured');
      return;
    }

    try {
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data,
        user,
        metadata
      };

      const response = await fetch(process.env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        console.error(`Webhook failed: ${response.status} ${response.statusText}`);
      } else {
        console.log(`Webhook sent successfully: ${eventType}`);
      }
    } catch (error) {
      console.error('Webhook error:', error.message);
    }
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
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
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

export default async function handler(request) {
  try {
    const { method, url, headers, body } = request;
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Handle preflight requests
    if (method === 'OPTIONS') {
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
    } else if (method === 'POST' && path === '/api/recipes') {
      return await handleCreateRecipe(body, user);
    } else if (method === 'GET' && path === '/api/recipes') {
      return await handleGetRecipes(user);
    } else if (method === 'GET' && path === '/health') {
      return new Response(JSON.stringify({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

// Handle sending a chat message
async function handleSendMessage(body, user) {
  try {
    const { message, context } = JSON.parse(body);

    // Generate simple response (AI handled by n8n webhook)
    const aiResponse = `I received your message: "${message}". This will be processed by my n8n workflow.`;

    // Save user message
    const userMessageResult = await sql`
      INSERT INTO chat_messages (user_id, content, sender, message_type, metadata, created_at)
      VALUES (${user.id}, ${message}, 'user', 'text', '{}', NOW())
      RETURNING id
    `;

    // Save AI response
    const aiMessageResult = await sql`
      INSERT INTO chat_messages (user_id, content, sender, message_type, metadata, created_at)
      VALUES (${user.id}, ${aiResponse}, 'ai', 'text', '{}', NOW())
      RETURNING id
    `;

    const aiMessageId = aiMessageResult[0].id;

    // Send webhook event for chat message
    await webhookService.chatMessageSent({
      id: aiMessageId,
      content: message,
      type: 'text'
    }, user);

    return new Response(JSON.stringify({
      message: 'Message processed successfully',
      response: {
        id: aiMessageId,
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      }
    }), {
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
