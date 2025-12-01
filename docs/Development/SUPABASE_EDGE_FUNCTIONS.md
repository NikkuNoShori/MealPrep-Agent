# Supabase Edge Functions

## Overview

Supabase Edge Functions are Deno-based serverless functions that run on Supabase's edge network. They're useful for:
- Serverless API endpoints
- Webhook handlers
- Background jobs
- Complex business logic

## Current Status

**We do NOT currently have any Supabase Edge Functions created.**

We're using:
- **Express.js** for local development (`server.js`)
- **Vercel Edge Functions** for production (`api/rag/search.js`, `api/rag/auth.js`)

## When to Use Supabase Edge Functions

Consider using Supabase Edge Functions if you want to:
1. **Migrate to serverless**: Replace Express.js with serverless functions
2. **Reduce infrastructure**: No need to manage Express.js server
3. **Better integration**: Direct access to Supabase services
4. **Edge deployment**: Functions run closer to users globally

## Setup

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Initialize Supabase Functions

```bash
supabase init
```

This creates:
```
supabase/
  functions/
    _shared/          # Shared utilities
    example/          # Example function
```

### 3. Create a Function

```bash
supabase functions new profile-management
```

This creates:
```
supabase/functions/profile-management/index.ts
```

### 4. Example Function

```typescript
// supabase/functions/profile-management/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle request
    const { method } = req
    if (method === 'GET') {
      // Get profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ profile: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (method === 'POST') {
      // Create/update profile
      const body = await req.json()
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: body.email,
          first_name: body.first_name,
          last_name: body.last_name,
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ profile: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### 5. Deploy Function

```bash
supabase functions deploy profile-management
```

### 6. Call Function

```typescript
// From frontend
const { data, error } = await supabase.functions.invoke('profile-management', {
  body: { email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
  method: 'POST'
})
```

## Benefits vs Express.js

| Feature | Express.js | Supabase Edge Functions |
|---------|------------|-------------------------|
| **Deployment** | Manual server setup | Automatic serverless |
| **Scaling** | Manual scaling | Auto-scaling |
| **Cost** | Server costs | Pay per invocation |
| **Latency** | Single region | Global edge network |
| **Integration** | Manual setup | Built-in Supabase integration |
| **Development** | Local server | Local Deno runtime |

## Migration Path

If you want to migrate from Express.js to Supabase Edge Functions:

1. **Create Edge Functions** for each Express.js endpoint
2. **Test locally** using `supabase functions serve`
3. **Deploy functions** using `supabase functions deploy`
4. **Update frontend** to call Edge Functions instead of Express.js
5. **Remove Express.js** server once all endpoints are migrated

## Recommendation

**Current approach (Express.js + Vercel Edge Functions) is fine for now.**

Consider Supabase Edge Functions if:
- You want to reduce infrastructure management
- You need global edge deployment
- You want better Supabase integration
- You're building a new feature from scratch

For existing Express.js endpoints, migration is optional and can be done gradually.

