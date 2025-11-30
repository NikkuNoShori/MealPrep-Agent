// Supabase Edge Function for Chat API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    // Get authenticated user from Supabase Auth (required)
    const authHeader = req.headers.get('Authorization')
    let user = null
    let userToken = null
    
    if (authHeader) {
      userToken = authHeader.replace('Bearer ', '')
      // Create temporary client for auth verification
      const tempSupabase = createClient(supabaseUrl, supabaseKey)
      const { data: { user: authUser }, error: authError } = await tempSupabase.auth.getUser(userToken)
      if (!authError && authUser) {
        user = authUser
      }
    }

    // Require authentication
    if (!user || !userToken) {
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please sign in.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      )
    }

    // Create authenticated Supabase client with user's JWT token for RLS
    const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    })

    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // Route handling
    if (method === 'POST' && path.includes('/message')) {
      return await handleSendMessage(req, supabaseAuth, user)
    } else if (method === 'GET' && path.includes('/history')) {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      return await handleGetHistory(req, supabaseAuth, user, limit)
    } else if (method === 'DELETE' && path.includes('/history')) {
      return await handleClearHistory(req, supabaseAuth, user)
    } else if (method === 'GET' && path.includes('/health')) {
      return new Response(
        JSON.stringify({
          status: 'OK',
          timestamp: new Date().toISOString(),
          webhookEnabled: Deno.env.get('WEBHOOK_ENABLED') === 'true',
          webhookUrlConfigured: !!Deno.env.get('N8N_WEBHOOK_URL'),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    return new Response(
      JSON.stringify({ error: 'Route not found' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

// Handle sending a chat message
async function handleSendMessage(req: Request, supabase: any, user: any) {
  try {
    const { message, context, sessionId, intent, images } = await req.json()

    // Get or create conversation
    let conversationId: string
    const session_id = sessionId || context?.sessionId || `session-${Date.now()}`
    
    // Try to find existing conversation by session_id
    const { data: existingConv, error: findError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_id', session_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingConv && !findError) {
      conversationId = existingConv.id
      
      // Update conversation metadata if intent is provided
      if (intent) {
        await supabase
          .from('chat_conversations')
          .update({ selected_intent: intent })
          .eq('id', conversationId)
      }
    } else {
      // Create new conversation
      const title = message.length > 50 ? message.substring(0, 50) + '...' : message
      const { data: newConv, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: title,
          session_id: session_id,
          selected_intent: intent || null,
          metadata: context?.metadata || {}
        })
        .select()
        .single()

      if (convError) throw convError
      conversationId = newConv.id
    }

    // Save user message
    const { data: userMessage, error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        content: message,
        sender: 'user',
        message_type: 'text',
        metadata: context?.messageMetadata || {}
      })
      .select()
      .single()

    if (userMsgError) throw userMsgError

    // Send webhook event for chat message and wait for n8n response
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL')
    const webhookEnabled = Deno.env.get('WEBHOOK_ENABLED') === 'true'
    
    let aiResponse = null
    let recipe = null
    
    if (webhookEnabled && webhookUrl) {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message,
            intent: intent,
            images: images || [],
            sessionId: session_id,
            conversationId: conversationId,
            context: context
          }),
        })

        if (webhookResponse.ok) {
          // Parse response to check for structured recipe
          const text = await webhookResponse.text()
          try {
            const responseData = JSON.parse(text)
            aiResponse = responseData.content || responseData.message || responseData.output || text
            recipe = responseData.recipe || null
          } catch (e) {
            // Not JSON, use as-is
            aiResponse = text
          }
        }
      } catch (webhookError) {
        console.error('Webhook error:', webhookError)
      }
    }

    if (!aiResponse) {
      aiResponse = "I'm sorry, but I'm having trouble connecting to my AI service right now. Please try again in a moment."
    }

    // Save AI response to database
    const { data: aiMessage, error: aiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        content: aiResponse,
        sender: 'ai',
        message_type: recipe ? 'recipe' : 'text',
        metadata: recipe ? { recipe: recipe } : {}
      })
      .select()
      .single()

    if (aiMsgError) throw aiMsgError

    return new Response(
      JSON.stringify({
        message: 'Message processed successfully',
        response: {
          id: aiMessage.id,
          content: aiResponse,
          sender: 'ai',
          timestamp: new Date().toISOString()
        },
        recipe: recipe, // Include structured recipe if present
        conversationId: conversationId,
        sessionId: session_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}

// Handle getting chat history
async function handleGetHistory(req: Request, supabase: any, user: any, limit: number) {
  try {
    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversationId')

    // If conversationId provided, get messages for that conversation
    if (conversationId) {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const formattedMessages = messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        type: msg.message_type,
        timestamp: msg.created_at,
        metadata: msg.metadata
      }))

      return new Response(
        JSON.stringify({ messages: formattedMessages }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Otherwise, get list of conversations
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select(`
        id,
        title,
        session_id,
        selected_intent,
        created_at,
        updated_at,
        last_message_at
      `)
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    // Get message counts for each conversation
    const conversationIds = conversations.map((c: any) => c.id)
    const { data: messageCounts, error: countError } = await supabase
      .from('chat_messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)

    if (countError) throw countError

    // Count messages per conversation
    const countsMap = new Map<string, number>()
    messageCounts?.forEach((msg: any) => {
      countsMap.set(msg.conversation_id, (countsMap.get(msg.conversation_id) || 0) + 1)
    })

    const formattedConversations = conversations.map((conv: any) => ({
      id: conv.id,
      title: conv.title,
      sessionId: conv.session_id,
      selectedIntent: conv.selected_intent,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      lastMessageAt: conv.last_message_at,
      messageCount: countsMap.get(conv.id) || 0
    }))

    return new Response(
      JSON.stringify({ conversations: formattedConversations }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}

// Handle clearing chat history
async function handleClearHistory(req: Request, supabase: any, user: any) {
  try {
    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversationId')

    // If conversationId provided, delete only that conversation (cascades to messages)
    if (conversationId) {
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id)

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'Conversation deleted successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Otherwise, delete all conversations for user (cascades to all messages)
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('user_id', user.id)

    if (error) throw error

    return new Response(
      JSON.stringify({ message: 'Chat history cleared successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}

