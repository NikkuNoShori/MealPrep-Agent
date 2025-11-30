/**
 * Main Chat API Endpoint
 * Handles intent detection and routing to appropriate services
 */

import { createClient } from '@supabase/supabase-js';
import { openRouterClient } from '../../src/lib/openrouter';
import { INTENT_DETECTION_SYSTEM_PROMPT, type IntentDetectionResult } from '../../src/prompts/intentRouter';
import { GENERAL_CHAT_SYSTEM_PROMPT } from '../../src/prompts/generalChat';
import { RECIPE_EXTRACTION_SYSTEM_PROMPT, RECIPE_EXTRACTION_USER_PROMPT } from '../../src/prompts/recipeExtraction';

export const config = {
  runtime: 'edge',
};

interface ChatRequest {
  message: string;
  images?: string[];
  sessionId?: string;
  intent?: 'recipe_extraction' | 'rag_search' | null;
  context?: any;
}

/**
 * Detect intent using AI
 */
async function detectIntent(
  message: string,
  images: string[] = []
): Promise<IntentDetectionResult> {
  try {
    const userMessage = images.length > 0
      ? `${message || 'Classify this content'}\n\n[${images.length} image(s) provided]`
      : message;

    const result = await openRouterClient.chatJSON<IntentDetectionResult>(
      INTENT_DETECTION_SYSTEM_PROMPT,
      userMessage,
      'qwen/qwen-2.5-7b-instruct',
      { temperature: 0.1, max_tokens: 150 }
    );

    // Validate intent
    const validIntents = ['recipe_extraction', 'rag_search', 'general_chat'];
    if (!validIntents.includes(result.intent)) {
      console.warn('Invalid intent:', result.intent, 'defaulting to general_chat');
      return {
        intent: 'general_chat',
        reason: 'Invalid intent from classifier',
        confidence: 0.5
      };
    }

    console.log('✅ Intent detected:', result);
    return result;
  } catch (error) {
    console.error('❌ Intent detection error:', error);
    return {
      intent: 'general_chat',
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      confidence: 0.5
    };
  }
}

/**
 * Handle recipe extraction directly (bypass n8n)
 */
async function extractRecipe(
  message: string,
  images: string[]
): Promise<{ success: boolean; recipe?: any; error?: string }> {
  try {
    const userPrompt = RECIPE_EXTRACTION_USER_PROMPT(message, images.length);

    let response: string;
    if (images.length > 0) {
      // Use vision model for images
      response = await openRouterClient.chatWithImages(
        RECIPE_EXTRACTION_SYSTEM_PROMPT,
        userPrompt,
        images,
        'qwen/qwen-2.5-vl-7b-instruct',
        { temperature: 0.1, max_tokens: 2000, response_format: { type: 'json_object' } }
      );
    } else {
      // Use text model for text-only
      response = await openRouterClient.chat(
        RECIPE_EXTRACTION_SYSTEM_PROMPT,
        userPrompt,
        'qwen/qwen-2.5-7b-instruct',
        { temperature: 0.1, max_tokens: 2000 }
      );
    }

    // Parse the JSON response
    const parsed = JSON.parse(response);
    const recipe = parsed.recipe || parsed;

    // Basic validation
    if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
      throw new Error('Invalid recipe structure: missing required fields');
    }

    console.log('✅ Recipe extracted:', recipe.title);
    return { success: true, recipe };
  } catch (error) {
    console.error('❌ Recipe extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Recipe extraction failed'
    };
  }
}

/**
 * Handle general chat directly
 */
async function handleGeneralChat(
  message: string,
  conversationId: string,
  supabase: any
): Promise<string> {
  try {
    // Get recent conversation history
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('content, sender, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationHistory = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

    const response = await openRouterClient.chatWithHistory(
      GENERAL_CHAT_SYSTEM_PROMPT,
      conversationHistory,
      message,
      'qwen/qwen-3-8b',
      { temperature: 0.7, max_tokens: 500 }
    );

    console.log('✅ General chat response generated');
    return response;
  } catch (error) {
    console.error('❌ General chat error:', error);
    return "I apologize, but I'm having trouble processing your message right now. Please try again.";
  }
}

/**
 * Call n8n RAG workflow
 */
async function callRAGWorkflow(
  message: string,
  sessionId: string,
  conversationId: string,
  userId: string
): Promise<string> {
  const n8nUrl = process.env.N8N_RAG_WEBHOOK_URL;

  if (!n8nUrl) {
    console.error('N8N_RAG_WEBHOOK_URL not configured');
    return "Recipe search is temporarily unavailable. Please try again later.";
  }

  try {
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId,
        conversationId,
        userId
      }),
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status}`);
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return data.content || data.message || data.output || text;
    } catch {
      return text;
    }
  } catch (error) {
    console.error('❌ RAG workflow error:', error);
    return "I had trouble searching your recipes. Please try rephrasing your question.";
  }
}

/**
 * Main handler
 */
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // Parse request
    const { message, images = [], sessionId, intent: manualIntent, context }: ChatRequest = await req.json();

    if (!message && images.length === 0) {
      return Response.json({ error: 'Message or images required' }, { status: 400 });
    }

    // Get or create conversation
    const session_id = sessionId || context?.sessionId || `session-${Date.now()}`;
    
    let conversationId: string;
    const { data: existingConv } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_id', session_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingConv) {
      conversationId = existingConv.id;
      if (manualIntent) {
        await supabase
          .from('chat_conversations')
          .update({ selected_intent: manualIntent })
          .eq('id', conversationId);
      }
    } else {
      const title = message?.length > 50 ? message.substring(0, 50) + '...' : (message || 'New conversation');
      const { data: newConv, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title,
          session_id,
          selected_intent: manualIntent || null,
          metadata: context?.metadata || {}
        })
        .select()
        .single();

      if (convError) throw convError;
      conversationId = newConv.id;
    }

    // Save user message
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        content: message || '[Images only]',
        sender: 'user',
        message_type: 'text',
        metadata: { images: images.length, hasImages: images.length > 0 }
      });

    // INTENT DETECTION & ROUTING
    const startTime = Date.now();
    let routingIntent: string;
    let intentMetadata: any = {};

    if (manualIntent) {
      routingIntent = manualIntent;
      intentMetadata = { source: 'manual', intent: manualIntent };
      console.log('📍 Using manual intent:', manualIntent);
    } else {
      console.log('🤖 Detecting intent with AI...');
      const intentResult = await detectIntent(message || '', images);
      routingIntent = intentResult.intent;
      intentMetadata = {
        source: 'ai',
        detectedIntent: intentResult.intent,
        reason: intentResult.reason,
        confidence: intentResult.confidence
      };
    }

    // ROUTE TO APPROPRIATE SERVICE
    let aiResponse: string;
    let recipe: any = null;

    if (routingIntent === 'recipe_extraction') {
      console.log('📝 Routing to Recipe Extraction (direct)...');
      const extractionResult = await extractRecipe(message || '', images);
      if (extractionResult.success) {
        recipe = extractionResult.recipe;
        aiResponse = "I've extracted the recipe! Here's what I found:";
      } else {
        aiResponse = `I had trouble extracting the recipe: ${extractionResult.error}`;
      }
    } else if (routingIntent === 'rag_search') {
      console.log('🔍 Routing to RAG Search (n8n)...');
      aiResponse = await callRAGWorkflow(message || '', session_id, conversationId, user.id);
    } else {
      console.log('💬 Routing to General Chat (direct)...');
      aiResponse = await handleGeneralChat(message || '', conversationId, supabase);
    }

    const routingDuration = Date.now() - startTime;
    console.log(`✅ Routing completed in ${routingDuration}ms`);

    // Save AI response
    const { data: aiMessage } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        content: aiResponse,
        sender: 'ai',
        message_type: recipe ? 'recipe' : 'text',
        metadata: { ...intentMetadata, recipe, routingDuration }
      })
      .select()
      .single();

    return Response.json({
      message: 'Message processed successfully',
      response: {
        id: aiMessage.id,
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date().toISOString()
      },
      recipe,
      conversationId,
      sessionId: session_id,
      intentMetadata
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);
    return Response.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

