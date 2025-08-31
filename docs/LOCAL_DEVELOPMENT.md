# Local Development Setup

## 🚀 **Quick Start**

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start both frontend and backend (recommended):**
   ```bash
   npm run dev:all
   ```
   This will start both the API server on `http://localhost:3000` and the frontend on `http://localhost:5173`

3. **Or start them separately:**
   ```bash
   # Terminal 1 - Start the API server
   npm run server
   
   # Terminal 2 - Start the frontend
   npm run dev
   ```

4. **Make sure your n8n instance is running:**
   - Your n8n workflow should be active
   - Webhook URL: `http://localhost:5678/webhook/cc0fb704-932c-467c-96a8-87c75f962c35`

## 🔧 **How It Works**

1. **Frontend** (`localhost:5173`) → Sends chat messages to **Local API** (`localhost:3000`)
2. **Local API** → Sends webhook to **n8n** (`localhost:5678`)
3. **n8n** → Processes with AI and returns response
4. **Local API** → Returns AI response to **Frontend**

## 🧪 **Testing**

1. **Test the health endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Test a chat message:**
   ```bash
   curl -X POST http://localhost:3000/api/chat/message \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, can you suggest a healthy dinner recipe?"}'
   ```

3. **Test from the frontend:**
   - Open `http://localhost:5173`
   - Send a message in the chat interface

## 📝 **Environment Variables**

The local server uses these defaults:
- `WEBHOOK_ENABLED=true`
- `N8N_WEBHOOK_URL=http://localhost:5678/webhook/cc0fb704-932c-467c-96a8-87c75f962c35`

You can override them by setting environment variables:
```bash
WEBHOOK_ENABLED=true N8N_WEBHOOK_URL=your-webhook-url npm run server
```

## 🎯 **Expected Flow**

1. User types message in frontend
2. Frontend sends POST to `localhost:3000/api/chat/message`
3. Local API sends webhook to n8n with the message
4. n8n processes with AI and returns response
5. Local API returns AI response to frontend
6. Frontend displays the AI response

## 🚨 **Troubleshooting**

- **CORS errors**: The local server has CORS enabled for `localhost:5173`
- **Webhook not responding**: Check that n8n is running and the workflow is active
- **Port conflicts**: Change the port in `server.js` if needed
