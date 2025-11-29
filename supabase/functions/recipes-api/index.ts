// Supabase Edge Function for Recipes API
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
    if (method === 'POST') {
      return await handleCreateRecipe(req, supabase, user)
    } else if (method === 'GET') {
      return await handleGetRecipes(req, supabase, user)
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

// Handle creating a recipe
async function handleCreateRecipe(req: Request, supabase: any, user: any) {
  try {
    const recipeData = await req.json()

    const { data: newRecipe, error } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        title: recipeData.title,
        description: recipeData.description,
        ingredients: recipeData.ingredients || [],
        instructions: recipeData.instructions || [],
        prep_time: recipeData.prepTime || recipeData.prep_time,
        cook_time: recipeData.cookTime || recipeData.cook_time,
        servings: recipeData.servings || 4,
        difficulty: recipeData.difficulty || 'medium',
        cuisine: recipeData.cuisine,
        dietary_tags: recipeData.dietary_tags || recipeData.tags || [],
        source_url: recipeData.sourceUrl || recipeData.source_url,
        is_favorite: recipeData.is_favorite || false
      })
      .select()
      .single()

    if (error) throw error

    // Send webhook event if configured
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL')
    const webhookEnabled = Deno.env.get('WEBHOOK_ENABLED') === 'true'
    
    if (webhookEnabled && webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'recipe.created',
            timestamp: new Date().toISOString(),
            data: newRecipe,
            user: user
          }),
        })
      } catch (webhookError) {
        console.error('Webhook error:', webhookError)
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Recipe created successfully',
        recipe: newRecipe
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
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

// Handle getting recipes
async function handleGetRecipes(req: Request, supabase: any, user: any) {
  try {
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return new Response(
      JSON.stringify({ recipes: recipes || [] }),
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

