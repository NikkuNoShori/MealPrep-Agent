# n8n URL Configuration Options

## 🚨 **Current Issue: ECONNREFUSED ::1:3000**

n8n is trying to connect to IPv6 localhost (`::1:3000`) but can't reach it. This happens when n8n runs in a different environment (Docker, different machine, etc.).

## 🔧 **Solution: Use Network IP Address**

### **Your Machine's IP: `192.168.1.143`**

Update the n8n RAG Search node URL to:
```
http://192.168.1.143:3000/api/rag/search
```

## 📋 **URL Options to Try (in order of preference):**

### **1. Network IP (Recommended)**
```
http://192.168.1.143:3000/api/rag/search
```
- ✅ **Works from any environment**
- ✅ **Accessible from Docker containers**
- ✅ **Works from different machines on same network**

### **2. Docker Host (if n8n is in Docker)**
```
http://host.docker.internal:3000/api/rag/search
```
- ✅ **Works from Docker containers**
- ❌ **Only works if n8n is in Docker**

### **3. IPv4 Localhost**
```
http://127.0.0.1:3000/api/rag/search
```
- ✅ **Works from same machine**
- ❌ **Doesn't work from Docker/containers**

### **4. Localhost (Problematic)**
```
http://localhost:3000/api/rag/search
```
- ❌ **Resolves to IPv6 (::1) in some environments**
- ❌ **Causes ECONNREFUSED errors**

## 🛠️ **How to Update n8n Configuration:**

### **Option 1: Import Updated Config**
1. Import `docs/Development/n8n-rag-config-fixed.md`
2. The URL is already set to `http://192.168.1.143:3000/api/rag/search`

### **Option 2: Manual Update**
1. Open your n8n workflow
2. Click on the "RAG Search" HTTP Request node
3. Change the URL to: `http://192.168.1.143:3000/api/rag/search`
4. Save the workflow

### **Option 3: Use Environment Variable**
Set the URL to use a dynamic value:
```
={{ $json.ragEndpoint || 'http://192.168.1.143:3000/api/rag/search' }}
```

## 🧪 **Testing the Connection:**

### **Test from Command Line:**
```bash
# Test network IP
curl http://192.168.1.143:3000/api/rag/test

# Test RAG search
curl -X POST http://192.168.1.143:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "chicken recipes", "userId": "test-user", "limit": 5}'
```

### **Expected Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "mock-recipe-1",
      "title": "Chicken Stir Fry",
      "description": "Quick and easy chicken stir fry with vegetables",
      "similarity_score": 0.85
    }
  ],
  "total": 1
}
```

## 🔍 **Troubleshooting Steps:**

### **1. Verify Server is Running:**
```bash
netstat -an | findstr :3000
# Should show: TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING
```

### **2. Test Network Connectivity:**
```bash
# From n8n's environment, test if it can reach your machine
ping 192.168.1.143
```

### **3. Check Firewall:**
- Ensure Windows Firewall allows connections on port 3000
- Or temporarily disable firewall for testing

### **4. Verify n8n Environment:**
- Check if n8n is running in Docker
- Check if n8n is on a different machine
- Check if n8n has network access to your machine

## 🎯 **Expected Results:**

After updating to `http://192.168.1.143:3000/api/rag/search`:
- ✅ **No more ECONNREFUSED errors**
- ✅ **RAG Search node connects successfully**
- ✅ **Mock recipe data returned**
- ✅ **Workflow completes end-to-end**

## 📝 **Notes:**

- **Network IP**: `192.168.1.143` is your machine's IP on the local network
- **Port 3000**: Must be accessible from n8n's environment
- **Server Binding**: Server is listening on `0.0.0.0:3000` (all interfaces)
- **CORS**: Enabled for localhost:5173 (frontend)

The network IP should resolve the connection issue! 🎉
