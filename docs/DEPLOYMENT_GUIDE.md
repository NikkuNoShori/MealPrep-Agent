# Deployment Guide - Fixing CORS Issues

## 🚨 **Current Issue: CORS Error**

The CORS error indicates that the edge function isn't responding properly to preflight requests. Here's how to fix it:

## 🔧 **Step 1: Deploy the Edge Function**

1. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Verify the deployment:**
   - Check that `vercel.json` is properly configured
   - Ensure the edge function is deployed

## 🧪 **Step 2: Test the Deployment**

1. **Test the health endpoint:**
   ```bash
   curl https://meal-prep-agent-pyfznejz1-nickneal1717s-projects.vercel.app/api/health
   ```

2. **Test CORS preflight:**
   ```bash
   curl -X OPTIONS https://meal-prep-agent-pyfznejz1-nickneal1717s-projects.vercel.app/api/chat/message \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -v
   ```

## ⚙️ **Step 3: Environment Variables**

Set these in your Vercel dashboard:

```bash
WEBHOOK_ENABLED=true
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id
DATABASE_URL=your-neon-connection-string
```

## 🔍 **Step 4: Debug Steps**

If the CORS error persists:

1. **Check Vercel Function Logs:**
   - Go to Vercel Dashboard → Your Project → Functions
   - Look for any deployment errors

2. **Test with a simple endpoint:**
   ```bash
   curl https://meal-prep-agent-pyfznejz1-nickneal1717s-projects.vercel.app/api/health
   ```

3. **Check if the function is deployed:**
   - The URL should return a JSON response
   - If it returns 404, the function isn't deployed

## 🚀 **Alternative: Quick Fix**

If the edge function deployment is problematic, you can temporarily:

1. **Use a different API endpoint** (like `/api/chat` instead of `/api/chat/message`)
2. **Deploy as a regular serverless function** instead of edge function
3. **Use a proxy service** like Cloudflare Workers

## 📝 **Expected Response**

The health endpoint should return:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "webhookEnabled": true,
  "webhookUrlConfigured": true,
  "databaseUrlConfigured": true
}
```

## 🆘 **Still Having Issues?**

1. Check Vercel deployment logs
2. Verify the edge function is actually deployed
3. Test with curl before trying from the frontend
4. Consider using a different deployment strategy
