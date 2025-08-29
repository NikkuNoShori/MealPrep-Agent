import { neon } from '@neondatabase/serverless';
import { n8nAI } from '../services/n8nAI.js';

// Database connection for edge function
const sql = neon(process.env.DATABASE_URL);

// Chat Edge Function
export default async function chatEdgeFunction(request) {
  try {
    // Parse the request
    const { method, url, headers, body } = request;
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Extract user ID from Authorization header
    const authHeader = headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TODO: Implement proper JWT verification here
    // For now, we'll extract user ID from a custom header
    const userId = headers.get('X-User-ID');
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route handling
    switch (method) {
      case 'POST':
        if (path === '/api/chat/message') {
          return await handleSendMessage(body, userId);
        } else if (path === '/api/chat/add-recipe') {
          return await handleAddRecipe(body, userId);
        }
        break;

      case 'GET':
        if (path === '/api/chat/history') {
          const limit = searchParams.get('limit') || 50;
          return await handleGetHistory(userId, parseInt(limit));
        }
        break;

      case 'DELETE':
        if (path === '/api/chat/history') {
          return await handleClearHistory(userId);
        }
        break;

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ error: 'Route not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Chat edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });
  }
}

// Handle sending a chat message
async function handleSendMessage(body, userId) {
  try {
    const { message, context } = JSON.parse(body);

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Process through N8N AI workflow
    const aiResponse = await n8nAI.processChatMessage(message, context);

    // Save user message
    const userMessageResult = await sql`
      INSERT INTO chat_messages (user_id, content, sender, message_type, created_at)
      VALUES (${userId}, ${message}, 'user', 'text', NOW())
      RETURNING id, created_at
    `;

    // Save AI response
    const aiMessageResult = await sql`
      INSERT INTO chat_messages (user_id, content, sender, message_type, created_at)
      VALUES (${userId}, ${aiResponse}, 'ai', 'text', NOW())
      RETURNING id, created_at
    `;

    const response = {
      message: 'Message processed successfully',
      userMessage: {
        id: userMessageResult[0].id,
        content: message,
        sender: 'user',
        timestamp: userMessageResult[0].created_at,
      },
      aiResponse: {
        id: aiMessageResult[0].id,
        content: aiResponse,
        sender: 'ai',
        timestamp: aiMessageResult[0].created_at,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Send message error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle adding recipe through chat
async function handleAddRecipe(body, userId) {
  try {
    const { recipeText } = JSON.parse(body);

    if (!recipeText) {
      return new Response(JSON.stringify({ error: 'Recipe text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse recipe through N8N AI workflow
    const parsedRecipe = await n8nAI.parseRecipe(recipeText);

    // Save recipe to database
    const recipeResult = await sql`
      INSERT INTO recipes (
        user_id, title, description, ingredients, instructions, 
        prep_time, cook_time, servings, difficulty, cuisine_type,
        dietary_tags, created_at, updated_at
      ) VALUES (
        ${userId}, ${parsedRecipe.title}, ${parsedRecipe.description || ''},
        ${JSON.stringify(parsedRecipe.ingredients || [])},
        ${JSON.stringify(parsedRecipe.instructions || [])},
        ${parsedRecipe.prepTime || 0}, ${parsedRecipe.cookTime || 0},
        ${parsedRecipe.servings || 1}, ${parsedRecipe.difficulty || 'medium'},
        ${parsedRecipe.cuisineType || ''}, ${JSON.stringify(parsedRecipe.dietaryTags || [])},
        NOW(), NOW()
      ) RETURNING id, created_at
    `;

    const confirmationMessage = `I've added "${parsedRecipe.title}" to your recipe collection! You can find it in your recipes section.`;

    const response = {
      message: 'Recipe added successfully',
      recipe: {
        id: recipeResult[0].id,
        ...parsedRecipe,
        createdAt: recipeResult[0].created_at,
      },
      confirmation: confirmationMessage,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Add recipe error:', error);
    return new Response(JSON.stringify({ error: 'Failed to add recipe' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle getting chat history
async function handleGetHistory(userId, limit) {
  try {
    const messages = await sql`
      SELECT id, content, sender, message_type, created_at
      FROM chat_messages
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    // Reverse to get chronological order
    const chronologicalMessages = messages.reverse().map(msg => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      type: msg.message_type,
      timestamp: msg.created_at,
    }));

    return new Response(JSON.stringify({ messages: chronologicalMessages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get chat history' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle clearing chat history
async function handleClearHistory(userId) {
  try {
    await sql`
      DELETE FROM chat_messages
      WHERE user_id = ${userId}
    `;

    return new Response(JSON.stringify({ message: 'Chat history cleared successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Clear chat history error:', error);
    return new Response(JSON.stringify({ error: 'Failed to clear chat history' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
