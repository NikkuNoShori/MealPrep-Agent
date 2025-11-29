// Supabase Edge Function for Chat API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get authenticated user from Supabase Auth (required)
    const authHeader = req.headers.get('Authorization')
    let user = null
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
      if (!authError && authUser) {
        user = authUser
      }
    }

    // Require authentication - no test user fallback
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please sign in.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      )
    }

    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // Route handling
    if (method === 'POST' && path.includes('/message')) {
      return await handleSendMessage(req, supabase, user)
    } else if (method === 'GET' && path.includes('/history')) {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      return await handleGetHistory(req, supabase, user, limit)
    } else if (method === 'DELETE' && path.includes('/history')) {
      return await handleClearHistory(req, supabase, user)
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
    const { message, context } = await req.json()

    // Save user message first
    const { data: userMessage, error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        content: message,
        sender: 'user',
        message_type: 'text',
        metadata: {}
      })
      .select()
      .single()

    if (userMsgError) throw userMsgError

    // Send webhook event for chat message and wait for n8n response
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL')
    const webhookEnabled = Deno.env.get('WEBHOOK_ENABLED') === 'true'
    
    let aiResponse = null
    
    if (webhookEnabled && webhookUrl) {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'chat.message.sent',
            timestamp: new Date().toISOString(),
            data: {
              id: userMessage.id,
              content: message,
              type: 'text',
              context
            },
            user: user
          }),
        })

        if (webhookResponse.ok) {
          const responseData = await webhookResponse.json()
          aiResponse = responseData.content || responseData.message || responseData.output || responseData
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
        user_id: user.id,
        content: aiResponse,
        sender: 'ai',
        message_type: 'text',
        metadata: {}
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
        }
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
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const formattedMessages = messages.reverse().map((msg: any) => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      type: msg.message_type,
      timestamp: msg.created_at
    }))

    return new Response(
      JSON.stringify({ messages: formattedMessages }),
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
    const { error } = await supabase
      .from('chat_messages')
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

