# Stack Auth REST API Implementation

## Overview

We use **Stack Auth's REST API directly** instead of the SDK, which is the **recommended approach** for Express.js applications.

## Why REST API Instead of SDK?

### ✅ Benefits of REST API

1. **Framework-Agnostic**: Works with any backend (Express, Fastify, Koa, etc.)
2. **No Dependencies**: Doesn't require Next.js or other framework-specific packages
3. **Recommended Path**: Stack Auth documentation recommends REST API for non-Next.js apps
4. **Simpler**: Direct HTTP requests, easier to debug and maintain
5. **More Reliable**: No SDK version conflicts or import issues

### ❌ Issues with SDK

1. **Next.js Dependency**: `@stackframe/stack` SDK requires Next.js
2. **Framework Lock-in**: Designed primarily for Next.js applications
3. **Import Issues**: Module resolution problems in Express.js
4. **Unnecessary Complexity**: SDK adds abstraction layer we don't need

## Implementation

### Token Verification

```javascript
// server/middleware/auth.js
async function verifyTokenWithStackAuthAPI(token, projectId, serverSecretKey) {
  const verifyUrl = 'https://api.stack-auth.com/api/v1/verify-token';
  const verifyResponse = await fetch(verifyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serverSecretKey}`,
    },
    body: JSON.stringify({
      token: token,
      projectId: projectId,
    }),
  });

  if (!verifyResponse.ok) {
    return null; // Token invalid
  }

  const userData = await verifyResponse.json();
  return userData.user || { id: userData.userId };
}
```

### Authentication Middleware

```javascript
// Extract token from cookies
const cookies = req.cookies || {};
const authToken = cookies['sf-access-token-${projectId}'] || 
                  cookies['stack-auth-token'] || 
                  req.headers.authorization?.replace('Bearer ', '');

// Verify token using REST API
const user = await verifyTokenWithStackAuthAPI(
  authToken, 
  projectId, 
  serverSecretKey
);

if (!user) {
  return res.status(401).json({ error: 'Authentication required' });
}

// Attach user to request
req.user = {
  id: user.id || user.userId,
  email: user.email,
  displayName: user.displayName || user.name,
};
```

## Stack Auth REST API Endpoints

### Token Verification
- **Endpoint**: `POST https://api.stack-auth.com/api/v1/verify-token`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {serverSecretKey}`
- **Body**:
  ```json
  {
    "token": "{authToken}",
    "projectId": "{projectId}"
  }
  ```
- **Response**:
  ```json
  {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "displayName": "User Name"
    }
  }
  ```

## Configuration

### Environment Variables

```env
# Stack Auth Configuration
STACK_PROJECT_ID=your-project-id
# OR
VITE_STACK_PROJECT_ID=your-project-id

STACK_SERVER_SECRET_KEY=your-server-secret-key
```

### Initialization

```javascript
// server/middleware/auth.js
async function initializeStackAuth() {
  const projectId = process.env.STACK_PROJECT_ID || process.env.VITE_STACK_PROJECT_ID;
  const serverSecretKey = process.env.STACK_SERVER_SECRET_KEY;
  
  if (!projectId || !serverSecretKey) {
    return null; // Not configured
  }
  
  // Return REST API wrapper
  return {
    _useRestAPI: true,
    projectId: projectId,
    serverSecretKey: serverSecretKey,
    verifyToken: (token) => verifyTokenWithStackAuthAPI(token, projectId, serverSecretKey)
  };
}
```

## References

- **Stack Auth REST API Docs**: https://docs.stack-auth.com/rest-api/overview
- **Stack Auth API Reference**: https://docs.stack-auth.com/rest-api/reference

## Benefits

1. ✅ **No Next.js Required**: Works with Express.js out of the box
2. ✅ **Framework-Agnostic**: Can be used with any backend framework
3. ✅ **Recommended Approach**: Per Stack Auth documentation for non-Next.js apps
4. ✅ **Simpler**: Direct HTTP requests, easier to understand and debug
5. ✅ **More Reliable**: No SDK version conflicts or import issues
6. ✅ **Better Performance**: No SDK overhead, direct API calls

## Conclusion

Using Stack Auth's REST API directly is the **recommended approach** for Express.js applications. It's simpler, more reliable, and doesn't require framework-specific dependencies like Next.js.

