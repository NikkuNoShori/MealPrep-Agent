# Deploy RAG API Server to n8n Machine

## 🎯 **Goal**
Deploy your RAG API server to the same machine where n8n is running so they can communicate via localhost.

## 📋 **Files to Copy**

Copy these files from your development machine to the n8n server:

### **Required Files:**
```
server.js
backend/rag-api-simple.js
package.json
package-lock.json
```

### **Optional Files (for reference):**
```
docs/Development/n8n-rag-config-fixed.md
migrations/ (if you want to set up the database later)
```

## 🚀 **Deployment Steps**

### **Step 1: Copy Files to n8n Server**
```bash
# Create a directory on the n8n server
mkdir -p /path/to/rag-api-server
cd /path/to/rag-api-server

# Copy the files (use scp, rsync, or file transfer)
# server.js
# backend/rag-api-simple.js
# package.json
# package-lock.json
```

### **Step 2: Install Dependencies**
```bash
# On the n8n server
cd /path/to/rag-api-server
npm install
```

### **Step 3: Start the Server**
```bash
# On the n8n server
node server.js
```

### **Step 4: Verify Server is Running**
```bash
# Test the server
curl http://localhost:3000/api/rag/test
# Should return: {"success": true, "message": "RAG API is working!"}
```

### **Step 5: Update n8n Workflow**
1. **Import the updated configuration** from `n8n-rag-config-fixed.md`
2. **Or manually update** the RAG Search node URL to: `http://localhost:3000/api/rag/search`

## 🔧 **Configuration Details**

### **Server Configuration:**
- **Port**: 3000
- **Interface**: 0.0.0.0 (all interfaces)
- **RAG Endpoint**: `/api/rag/search`
- **Test Endpoint**: `/api/rag/test`

### **n8n Configuration:**
- **URL**: `http://localhost:3000/api/rag/search`
- **Method**: POST
- **Content-Type**: application/json
- **Body**: JSON with `query`, `userId`, `limit`

## 🧪 **Testing**

### **Test 1: Server Health**
```bash
curl http://localhost:3000/api/rag/test
```

### **Test 2: RAG Search**
```bash
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "chicken recipes", "userId": "test-user", "limit": 5}'
```

### **Test 3: n8n Workflow**
1. **Trigger the n8n workflow**
2. **Check the RAG Search node** - should connect successfully
3. **Verify response** - should return mock recipe data

## 🔍 **Troubleshooting**

### **Port Already in Use:**
```bash
# Check what's using port 3000
netstat -tulpn | grep :3000
# Kill the process if needed
kill -9 <PID>
```

### **Permission Issues:**
```bash
# Make sure you have permission to run Node.js
chmod +x server.js
```

### **Dependencies Missing:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📝 **Environment Variables (Optional)**

If you want to configure the server, create a `.env` file:
```bash
# .env file
PORT=3000
NODE_ENV=production
WEBHOOK_ENABLED=true
N8N_WEBHOOK_URL=http://localhost:5678/webhook/e7acd79d-bd3d-4e8b-851c-6e93f06ccfa1
```

## 🎯 **Expected Results**

After deployment:
- ✅ **Server runs on n8n machine** at `localhost:3000`
- ✅ **n8n workflow connects successfully** to RAG API
- ✅ **Mock recipe data returned** from RAG search
- ✅ **End-to-end workflow works** without connection errors

## 🔄 **Development Workflow**

For future updates:
1. **Develop on your local machine**
2. **Test locally** with `npm run server`
3. **Copy updated files** to n8n server
4. **Restart server** on n8n machine
5. **Test n8n workflow**

This approach ensures both n8n and your RAG API are on the same machine, eliminating network connectivity issues! 🚀
