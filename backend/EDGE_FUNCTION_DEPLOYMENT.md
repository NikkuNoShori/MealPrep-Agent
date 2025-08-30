# Edge Function Deployment Guide

## 🚀 **Simplified Architecture**

Instead of a complex Express.js backend, we're using edge functions for a much simpler setup:

- **Frontend**: React/Vite app (unchanged)
- **Edge Function**: Handles API calls and webhooks
- **Database**: NeonDB (your existing tables)
- **AI Processing**: n8n workflow (via webhooks)

## 📋 **Setup Steps**

### **1. Run Database Migrations**

First, run these SQL migrations in your NeonDB dashboard:

**Migration 1: `003_create_missing_tables.sql`**
```sql
-- Copy and paste the contents of this file into your NeonDB SQL Editor
```

**Migration 2: `004_add_test_user.sql`**
```sql
-- Copy and paste the contents of this file into your NeonDB SQL Editor
```

### **2. Deploy Edge Function**

#### **Option A: Vercel Edge Functions**
1. Create a `vercel.json` in your project root:
```json
{
  "functions": {
    "backend/edge-functions/chat-api.js": {
      "runtime": "edge"
    }
  }
}
```

2. Deploy to Vercel:
```bash
vercel --prod
```

#### **Option B: Netlify Edge Functions**
1. Create a `netlify.toml` in your project root:
```toml
[functions]
  directory = "backend/edge-functions"
```

2. Deploy to Netlify:
```bash
netlify deploy --prod
```

#### **Option C: Local Development**
For local testing, you can use tools like:
- `wrangler` (Cloudflare Workers)
- `vercel dev`
- `netlify dev`

### **3. Update Environment Variables**

Set these environment variables in your deployment platform:

```bash
DATABASE_URL=your-neon-connection-string
WEBHOOK_ENABLED=true
N8N_WEBHOOK_URL=http://localhost:5678/webhook/cc0fb704-932c-467c-96a8-87c75f962c35
FRONTEND_URL=http://localhost:5173
```

### **4. Update Frontend API URL**

Update your frontend's API base URL to point to your deployed edge function:

```typescript
// In src/services/api.ts
const API_BASE_URL = "https://your-edge-function-url.vercel.app";
```

## ✅ **Benefits of This Approach**

1. **No Server Management**: No Express.js server to run/maintain
2. **Auto-scaling**: Edge functions scale automatically
3. **Simpler Deployment**: Just deploy the function
4. **Lower Costs**: Pay only for actual usage
5. **Better Performance**: Edge functions run closer to users

## 🔧 **API Endpoints Available**

- `POST /api/chat/message` - Send chat message
- `GET /api/chat/history` - Get chat history
- `DELETE /api/chat/history` - Clear chat history
- `POST /api/recipes` - Create recipe
- `GET /api/recipes` - Get recipes
- `GET /health` - Health check

## 🎯 **Next Steps**

1. Run the database migrations
2. Deploy the edge function
3. Update the frontend API URL
4. Test the chat functionality

The edge function will automatically send webhook events to your n8n workflow when chat messages are sent or recipes are created!
