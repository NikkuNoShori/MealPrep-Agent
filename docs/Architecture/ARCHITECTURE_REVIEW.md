# Architecture Review: Database Access, Performance & Security

**Date**: 2025-11-06  
**Status**: Current State Analysis & Recommendations

## Current Architecture Overview

### Database Access Pattern

**Current Approach: Direct Database Connections**

- ✅ **Server-side (`server.js`)**: Using `pg` Pool with direct PostgreSQL connections
- ✅ **Edge Functions (`api/rag/search.js`)**: Using `@neondatabase/serverless` for Vercel Edge Functions
- ❌ **No RPC Layer**: Not using Neon's serverless RPC approach
- ❌ **No Stored Procedures**: Using direct SQL queries instead of database functions

### Connection Management

**Server (`server.js`)**:
```typescript
// Basic connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  // No max/min pool size specified (uses defaults)
  // No idle timeout configured
});
```

**Edge Functions (`api/rag/search.js`)**:
```javascript
// Serverless connection (no pooling needed)
const sql = neon(process.env.DATABASE_URL);
```

---

## Performance Analysis

### Current Performance Characteristics

| Aspect | Current State | Impact |
|--------|--------------|--------|
| **Connection Pooling** | Basic (default settings) | ⚠️ May exhaust connections under load |
| **Query Optimization** | Direct SQL queries | ✅ Good for flexibility |
| **Edge Function Usage** | RAG search only | ✅ Good for low-latency |
| **Caching** | React Query (frontend only) | ⚠️ No backend caching |
| **Database Indexes** | Vector indexes, full-text search | ✅ Good |
| **Connection Management** | Manual pool management | ⚠️ No automatic scaling |

### Performance Bottlenecks

1. **No Connection Pool Configuration**
   - Default pool size may be too small for concurrent requests
   - No idle timeout configuration
   - Risk of connection exhaustion

2. **No Query Result Caching**
   - Every request hits the database
   - No caching layer for frequently accessed data

3. **Mixed Architecture**
   - Some endpoints use server.js (direct connections)
   - Some use edge functions (serverless)
   - No clear strategy for when to use each

4. **No Rate Limiting**
   - API endpoints have no rate limiting
   - Risk of DDoS or excessive resource usage

---

## Security Analysis

### Current Security Issues

#### 🔴 **CRITICAL: No Authentication in API Endpoints**

**Current State**:
```javascript
// server.js - ALL endpoints use test user
const getTestUser = () => ({
  id: '11111111-1111-1111-1111-111111111111',
  // ... hardcoded test user
});

// Used in ALL recipe endpoints
app.post('/api/recipes', async (req, res) => {
  const user = getTestUser(); // ⚠️ No real authentication!
  // ...
});
```

**Impact**: 
- ❌ Any user can access any other user's recipes
- ❌ No user isolation
- ❌ No authorization checks

#### 🔴 **CRITICAL: RLS Policies Not Enforced**

**Current State**:
```sql
-- migrations/008_enable_rls_recipes.sql
CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (auth.uid() = user_id);
```

**Problem**: 
- ❌ RLS policies use `auth.uid()` which is **Supabase-specific**
- ❌ We're using **Stack Auth**, not Supabase
- ❌ RLS policies are likely **not enforced** because `auth.uid()` doesn't exist
- ❌ All queries bypass RLS by using direct database connections

#### ⚠️ **HIGH: Wide Open CORS**

**Current State**:
```javascript
// api/rag/search.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // ⚠️ Allows any origin
  'Access-Control-Allow-Credentials': 'true',
};
```

**Impact**: 
- ⚠️ Any website can make requests to your API
- ⚠️ CSRF vulnerability
- ⚠️ No origin validation

#### ⚠️ **MEDIUM: No Input Validation**

**Current State**:
- No request body validation
- No SQL injection protection beyond parameterized queries
- No rate limiting

#### ⚠️ **MEDIUM: SSL Configuration**

**Current State**:
```javascript
ssl: {
  rejectUnauthorized: false // ⚠️ Disables certificate validation
}
```

**Impact**: 
- ⚠️ Vulnerable to MITM attacks
- ⚠️ Should validate SSL certificates in production

---

## Recommended Improvements

### 🔴 **Priority 1: Security (Critical)**

#### 1. Implement Proper Authentication

**Action**: Add authentication middleware to all API endpoints

```javascript
// middleware/auth.js
import { authService } from '../src/services/authService.js';

export const authenticateRequest = async (req, res, next) => {
  try {
    // Extract token from cookies or Authorization header
    const token = req.cookies?.authToken || 
                  req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token with Stack Auth
    const user = await authService.getUserFromToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Usage in server.js
app.post('/api/recipes', authenticateRequest, async (req, res) => {
  const user = req.user; // ✅ Real authenticated user
  // ...
});
```

#### 2. Fix RLS Policies for Stack Auth

**Action**: Update RLS policies to work with Stack Auth

**Option A: Use Session Variables (Recommended)**
```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;

-- Create function to set user context
CREATE OR REPLACE FUNCTION set_user_id(user_uuid UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_uuid::text, true);
END;
$$ LANGUAGE plpgsql;

-- Create new policies using session variable
CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (
    current_setting('app.current_user_id', true)::uuid = user_id
  );

CREATE POLICY "Users can insert own recipes" ON recipes
  FOR INSERT WITH CHECK (
    current_setting('app.current_user_id', true)::uuid = user_id
  );

CREATE POLICY "Users can update own recipes" ON recipes
  FOR UPDATE USING (
    current_setting('app.current_user_id', true)::uuid = user_id
  );

CREATE POLICY "Users can delete own recipes" ON recipes
  FOR DELETE USING (
    current_setting('app.current_user_id', true)::uuid = user_id
  );
```

**Update Database Service**:
```typescript
// src/services/database.ts
async query(text: string, params?: any[], userId?: string): Promise<any> {
  const client = await this.pool.connect();
  
  try {
    // Set user context for RLS
    if (userId) {
      await client.query('SELECT set_user_id($1::uuid)', [userId]);
    }
    
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}
```

**Option B: Application-Level Filtering (Simpler, but less secure)**
- Keep RLS disabled
- Always filter by `user_id` in application code
- Less secure but easier to implement

#### 3. Restrict CORS

**Action**: Configure CORS to only allow trusted origins

```javascript
// server.js
const allowedOrigins = [
  'http://localhost:5173',
  'https://meal-prep-agent-delta.vercel.app',
  // Add your production domains
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

#### 4. Enable SSL Certificate Validation

**Action**: Update SSL configuration for production

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: true } // ✅ Validate in production
    : { rejectUnauthorized: false }, // ⚠️ OK for development
});
```

---

### ⚠️ **Priority 2: Performance (High)**

#### 1. Optimize Connection Pooling

**Action**: Configure connection pool for production load

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  },
  // Optimize pool size
  max: 20, // Maximum connections in pool
  min: 2, // Minimum idle connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000,
  // Statement timeout
  statement_timeout: 5000, // 5 second query timeout
});
```

#### 2. Add Query Result Caching

**Action**: Implement Redis or in-memory caching for frequently accessed data

```javascript
// middleware/cache.js
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 minute TTL

export const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    const key = req.originalUrl || req.url;
    const cached = cache.get(key);
    
    if (cached) {
      return res.json(cached);
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to cache response
    res.json = (body) => {
      cache.set(key, body, duration);
      return originalJson(body);
    };
    
    next();
  };
};

// Usage
app.get('/api/recipes', authenticateRequest, cacheMiddleware(300), async (req, res) => {
  // ...
});
```

#### 3. Implement Rate Limiting

**Action**: Add rate limiting to prevent abuse

```javascript
// middleware/rateLimit.js
import rateLimit from 'express-rate-limit';

export const createRateLimiter = (windowMs, max) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Usage
const apiLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
app.use('/api/', apiLimiter);
```

#### 4. Add Request Validation

**Action**: Validate all request bodies and parameters

```javascript
// middleware/validation.js
import { body, validationResult } from 'express-validator';

export const validateRecipe = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('ingredients').isArray().withMessage('Ingredients must be an array'),
  body('instructions').isArray().withMessage('Instructions must be an array'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Usage
app.post('/api/recipes', authenticateRequest, validateRecipe, async (req, res) => {
  // ...
});
```

---

### 📊 **Priority 3: Architecture (Medium)**

#### 1. Consider Neon Serverless RPC

**Option**: Migrate to Neon's serverless RPC for better performance

**Benefits**:
- ✅ Automatic connection pooling
- ✅ Better cold start performance
- ✅ Built-in connection management
- ✅ Optimized for serverless environments

**Implementation**:
```typescript
// Use @neondatabase/serverless everywhere
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// All queries use tagged template literals
const recipes = await sql`
  SELECT * FROM recipes 
  WHERE user_id = ${userId}
`;
```

**Trade-offs**:
- ⚠️ Requires refactoring all database queries
- ⚠️ Less control over connection management
- ✅ Better for serverless/edge deployments

#### 2. Standardize on Edge Functions

**Recommendation**: Move more endpoints to Vercel Edge Functions

**Benefits**:
- ✅ Lower latency (global edge network)
- ✅ Automatic scaling
- ✅ No server management
- ✅ Better cost efficiency

**Endpoints to Consider**:
- `/api/recipes` (GET, POST, PUT, DELETE)
- `/api/rag/*` (already using edge functions)
- `/api/chat/*` (if stateless)

#### 3. Add Database Query Monitoring

**Action**: Enhance query performance monitoring

```typescript
// Already using pg-monitor, but enhance it
async query(text: string, params?: any[], userId?: string): Promise<any> {
  const startTime = Date.now();
  const client = await this.pool.connect();
  
  try {
    if (userId) {
      await client.query('SELECT set_user_id($1::uuid)', [userId]);
    }
    
    const result = await client.query(text, params);
    const duration = Date.now() - startTime;
    
    // Log slow queries
    if (duration > 1000) {
      AppLogger.warn('Slow query detected', {
        duration,
        query: text.substring(0, 200),
        params: params?.slice(0, 3),
      });
    }
    
    return result;
  } finally {
    client.release();
  }
}
```

---

## Migration Plan

### Phase 1: Security (Week 1)
1. ✅ Implement authentication middleware
2. ✅ Fix RLS policies for Stack Auth
3. ✅ Restrict CORS
4. ✅ Enable SSL validation

### Phase 2: Performance (Week 2)
1. ✅ Optimize connection pool
2. ✅ Add rate limiting
3. ✅ Add request validation
4. ✅ Add query caching (optional)

### Phase 3: Architecture (Week 3-4)
1. ✅ Evaluate Neon Serverless RPC migration
2. ✅ Move more endpoints to edge functions
3. ✅ Enhance monitoring and logging

---

## Comparison: Direct DB vs RPC

| Aspect | Direct DB (Current) | Neon Serverless RPC | Recommendation |
|--------|-------------------|---------------------|----------------|
| **Connection Management** | Manual pooling | Automatic | ✅ RPC for new code |
| **Performance** | Good | Better for serverless | ✅ RPC |
| **Flexibility** | Full SQL control | Template literals only | ⚠️ Direct DB if needed |
| **Edge Compatibility** | Requires `@neondatabase/serverless` | Native support | ✅ RPC |
| **Migration Effort** | N/A | Medium | ⚠️ Consider for new features |

---

## Summary

### Current State
- ⚠️ **Security**: 🔴 Critical issues - no authentication, RLS not enforced
- ⚠️ **Performance**: 🟡 Moderate - basic pooling, no caching
- ⚠️ **Architecture**: 🟡 Mixed - direct DB + edge functions

### Recommended Priority
1. **🔴 CRITICAL**: Fix authentication and RLS (Security)
2. **⚠️ HIGH**: Optimize connection pooling and add rate limiting (Performance)
3. **📊 MEDIUM**: Consider RPC migration and standardize on edge functions (Architecture)

### Quick Wins
- Add authentication middleware (2-3 hours)
- Fix RLS policies (1-2 hours)
- Restrict CORS (30 minutes)
- Optimize connection pool (30 minutes)
- Add rate limiting (1 hour)

**Total Quick Win Time**: ~5-7 hours for significant security and performance improvements.

