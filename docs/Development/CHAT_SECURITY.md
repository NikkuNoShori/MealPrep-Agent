# Chat Security - API Key Protection

## Security Best Practices

**⚠️ CRITICAL: Never expose API keys to the frontend!**

The OpenRouter API key must be kept secure and should **never** be exposed in the browser. All chat functionality uses Supabase Edge Functions to protect the API key.

## Architecture

### Current Secure Setup

1. **Frontend** (`src/components/chat/ChatInterface.tsx`)
   - Calls `apiClient.sendMessage()`
   - No API keys exposed

2. **API Client** (`src/services/api.ts`)
   - Routes to Supabase Edge Function: `/functions/v1/chat-api/message`
   - Uses authenticated Supabase client (JWT token)

3. **Supabase Edge Function** (`supabase/functions/chat-api/index.ts`)
   - Receives request with user JWT
   - Validates authentication
   - Uses `Deno.env.get("OPENROUTER_API_KEY")` - **server-side secret**
   - Calls OpenRouter API securely
   - Returns response to frontend

## Environment Variables

### Frontend (`.env` - Safe to expose)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_FRONTEND_URL=http://localhost:5173
```

### Supabase Edge Function Secrets (Set in Supabase Dashboard)
```env
OPENROUTER_API_KEY=sk-or-v1-...          # Main API key
OPENROUTER_API_KEY_QWEN2.5_VL_8b=...     # Optional: Vision model key
OPENROUTER_API_KEY_QWEN2.5_instruct_8b=... # Optional: Instruction model key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
FRONTEND_URL=http://localhost:5173
N8N_RAG_WEBHOOK_URL=...                  # Optional: For RAG search
```

## Setting Supabase Secrets

### Using Supabase CLI
```bash
# Set secrets for Edge Functions
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here
supabase secrets set SUPABASE_URL=your-url
supabase secrets set SUPABASE_ANON_KEY=your-key
```

### Using Supabase Dashboard
1. Go to your Supabase project
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add each secret:
   - `OPENROUTER_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `FRONTEND_URL`

## What NOT to Do

❌ **Never do this:**
```typescript
// DON'T expose API key in frontend
const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY; // ❌ SECURITY RISK
```

✅ **Always do this:**
```typescript
// Use Supabase Edge Function (secure)
await apiClient.sendMessage({ message: "Hello" }); // ✅ Secure
```

## Why This Matters

1. **API Key Theft**: Exposed keys can be stolen from browser DevTools
2. **Cost Abuse**: Stolen keys can be used to rack up charges
3. **Rate Limiting**: Abuse can cause your API to be rate-limited
4. **Best Practice**: Server-side secrets are industry standard

## Verification

To verify your setup is secure:

1. Open browser DevTools → Network tab
2. Send a chat message
3. Check the request to `/functions/v1/chat-api/message`
4. Verify: **No API keys visible in request/response**
5. Check: API key is only in Supabase Edge Function logs (server-side)

## Migration Notes

If you previously had `VITE_OPENROUTER_API_KEY` in your `.env`:

1. ✅ Remove it from `.env` (frontend)
2. ✅ Set it as a Supabase secret (server-side)
3. ✅ Verify chat still works (it should!)
4. ✅ Check that no API keys appear in browser DevTools

