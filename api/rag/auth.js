/**
 * Authentication helper for Vercel Edge Functions
 * Verifies Stack Auth tokens in edge function context
 */

// Initialize Stack Auth server SDK for edge functions
// Note: Edge functions have limited Node.js API access
// We'll use a simplified token verification approach

/**
 * Verify Stack Auth token in edge function
 * @param {Request} request - The incoming request
 * @returns {Promise<{user: object | null, error: string | null}>}
 */
export async function verifyAuthToken(request) {
  try {
    // Get Stack Auth project ID and secret key from environment
    const projectId = process.env.STACK_PROJECT_ID;
    const serverSecretKey = process.env.STACK_SERVER_SECRET_KEY;

    if (!projectId || !serverSecretKey) {
      // In development, allow requests without auth
      if (process.env.NODE_ENV === 'development') {
        return { user: { id: 'test-user' }, error: null };
      }
      return { user: null, error: 'Authentication not configured' };
    }

    // Extract token from cookies or Authorization header
    const cookies = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';

    let authToken = null;

    // Parse cookies
    const cookieMap = {};
    cookies.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookieMap[name] = value;
      }
    });

    // Check for Stack Auth cookie (common names)
    const possibleCookieNames = [
      `stack-auth-${projectId}`,
      'stack-auth-token',
      'stack-auth',
      'sf-access-token', // Stack Auth default cookie name
      'auth-token',
    ];

    for (const cookieName of possibleCookieNames) {
      if (cookieMap[cookieName]) {
        authToken = cookieMap[cookieName];
        break;
      }
    }

    // Check Authorization header
    if (!authToken && authHeader.startsWith('Bearer ')) {
      authToken = authHeader.replace('Bearer ', '');
    }

    if (!authToken) {
      return { user: null, error: 'No authentication token found' };
    }

    // Verify token with Stack Auth API
    // Note: In edge functions, we need to make an HTTP request to verify
    // For production, you should use Stack Auth's verification endpoint
    try {
      const verifyUrl = `https://api.stack-auth.com/api/v1/verify-token`;
      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serverSecretKey}`,
        },
        body: JSON.stringify({
          token: authToken,
          projectId: projectId,
        }),
      });

      if (!verifyResponse.ok) {
        return { user: null, error: 'Invalid authentication token' };
      }

      const userData = await verifyResponse.json();
      return { user: userData.user || { id: userData.userId }, error: null };
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      // In development, allow with warning
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Development mode: Allowing request without token verification');
        return { user: { id: 'test-user' }, error: null };
      }
      return { user: null, error: 'Token verification failed' };
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return { user: null, error: 'Authentication failed' };
  }
}

/**
 * Optional authentication for edge functions
 * Returns user if authenticated, null otherwise
 */
export async function optionalAuthEdge(request) {
  const { user, error } = await verifyAuthToken(request);
  return { user, error };
}

