# Server Logging Guide

## How to Check Server Logs

### Current Setup

The server (`server.js`) currently uses `console.log` and `console.error` for logging. These logs appear in the terminal where you run the server.

### Viewing Server Logs

#### 1. **Terminal Output (Development)**
When running the server locally with `node server.js`, all logs appear in the terminal:

```bash
# Start the server
node server.js

# You'll see logs like:
# 🚀 Local development server running on http://localhost:3000
# 🟡 Backend: Processing password reset request for: user@example.com
# ✅ Backend: Password reset email sent successfully
```

#### 2. **Log File Output (Future Enhancement)**
Currently, the server doesn't write to log files. To enable file logging, you would need to:
- Set up a file logger (e.g., `winston` for Node.js)
- Configure log rotation
- Set log file paths

#### 3. **Database Logs**
Database logs are handled by `pg-monitor` and are routed through the unified `Logger` service. These appear in:
- **Browser console** (if running in browser context)
- **Server terminal** (if running in Node.js context)

### Log Types

#### Server Logs (`server.js`)
- **Webhook logs**: `console.log('Webhook service called with:', ...)`
- **Database connection logs**: `console.log('🔵 Testing database connection...')`
- **Password reset logs**: `console.log('🟡 Backend: Processing password reset request...')`
- **Chat/RAG logs**: `console.log('Received chat message:', ...)`
- **Error logs**: `console.error('❌ Error:', ...)`

#### Database Logs (via `pg-monitor`)
- Query logs
- Connection/disconnection events
- Transaction logs
- Error logs

### Enabling Server-Side Logger

To use the unified Logger in `server.js`:

```javascript
// At the top of server.js
import { Logger } from './src/services/logger.js';

// Replace console.log with Logger
Logger.info('🟡 Backend: Processing password reset request', { email });
Logger.error('❌ Backend: Error', error);
```

### Best Practices

1. **Development**: Use terminal output for quick debugging
2. **Production**: Set up file logging with rotation
3. **Structured Logging**: Use the unified Logger for consistent format
4. **Error Tracking**: Log errors with context (user ID, request details, etc.)

### Monitoring Server Logs

#### Real-time Monitoring
```bash
# Watch server logs in real-time
tail -f server.log  # If log files are enabled

# Or use terminal output when running:
node server.js
```

#### Filtering Logs
```bash
# Filter for errors only
node server.js 2>&1 | grep "❌\|ERROR"

# Filter for specific operations
node server.js 2>&1 | grep "password reset"
```

### Next Steps

1. **Integrate Logger**: Replace `console.log` with `Logger` in `server.js`
2. **File Logging**: Set up file-based logging for production
3. **Log Rotation**: Implement log rotation to manage file sizes
4. **Log Aggregation**: Consider using a log aggregation service (e.g., Logtail, Papertrail) for production

