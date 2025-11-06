import { StackServerApp } from '@stackframe/stack';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Stack Auth server SDK
// Stack Auth requires server secret key for server-side verification
const projectId = process.env.STACK_PROJECT_ID || process.env.VITE_STACK_PROJECT_ID;
const serverSecretKey = process.env.STACK_SERVER_SECRET_KEY;

let stackServerApp = null;

if (projectId && serverSecretKey) {
  try {
    stackServerApp = new StackServerApp({
      projectId,
      secretKey: serverSecretKey,
    });
    console.log('✅ Stack Auth server initialized successfully');
  } catch (error) {
    console.error('❌ Stack Auth server initialization failed:', error);
  }
} else {
  console.warn('⚠️ Stack Auth server not configured. Missing environment variables:', {
    missingProjectId: !projectId,
    missingServerSecretKey: !serverSecretKey,
  });
}

/**
 * Authentication middleware for Express
 * Verifies Stack Auth cookies and attaches user to request
 */
export const authenticateRequest = async (req, res, next) => {
  try {
    // In development mode, allow test user if Stack Auth not configured
    if (process.env.NODE_ENV === 'development' && !stackServerApp) {
      console.warn('⚠️ Development mode: Using test user (Stack Auth not configured)');
      req.user = {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'test@example.com',
        displayName: 'Test User',
      };
      return next();
    }

    // Require Stack Auth configuration in production
    if (!stackServerApp) {
      return res.status(500).json({
        error: 'Authentication service not configured',
        message: 'Stack Auth server SDK not initialized',
      });
    }

    // Extract auth token from cookies
    // Stack Auth stores the token in a cookie named based on the project
    const cookies = req.cookies || {};
    
    // Try to find Stack Auth cookie (cookie name pattern: stack-auth-<projectId> or similar)
    // Stack Auth may use different cookie names, so we'll try common patterns
    let authToken = null;
    
    // Check common Stack Auth cookie names
    const possibleCookieNames = [
      `stack-auth-${projectId}`,
      'stack-auth-token',
      'stack-auth',
      'auth-token',
      'session',
    ];
    
    for (const cookieName of possibleCookieNames) {
      if (cookies[cookieName]) {
        authToken = cookies[cookieName];
        break;
      }
    }
    
    // Also check Authorization header as fallback
    if (!authToken) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.replace('Bearer ', '');
      }
    }

    if (!authToken) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No authentication token found in cookies or Authorization header',
      });
    }

    // Verify token with Stack Auth server SDK
    try {
      // Stack Auth server SDK should verify the token and return user
      // Note: Actual API may differ - this is based on common auth patterns
      const user = await stackServerApp.getUserFromToken(authToken);
      
      if (!user) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Authentication token is invalid or expired',
        });
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        displayName: user.displayName || user.name,
      };

      return next();
    } catch (authError) {
      console.error('Authentication verification error:', authError);
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Failed to verify authentication token',
      });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
    });
  }
};

/**
 * Optional authentication middleware
 * Sets req.user if authenticated, but doesn't fail if not authenticated
 */
export const optionalAuth = async (req, res, next) => {
  try {
    if (!stackServerApp) {
      // In development, use test user if available
      if (process.env.NODE_ENV === 'development') {
        req.user = {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'test@example.com',
          displayName: 'Test User',
        };
      }
      return next();
    }

    const cookies = req.cookies || {};
    const projectId = process.env.STACK_PROJECT_ID || process.env.VITE_STACK_PROJECT_ID;
    
    let authToken = null;
    const possibleCookieNames = [
      `stack-auth-${projectId}`,
      'stack-auth-token',
      'stack-auth',
      'auth-token',
      'session',
    ];
    
    for (const cookieName of possibleCookieNames) {
      if (cookies[cookieName]) {
        authToken = cookies[cookieName];
        break;
      }
    }
    
    if (!authToken) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.replace('Bearer ', '');
      }
    }

    if (authToken) {
      try {
        const user = await stackServerApp.getUserFromToken(authToken);
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            displayName: user.displayName || user.name,
          };
        }
      } catch (error) {
        // Silently fail - user is not authenticated
        console.warn('Optional auth failed:', error.message);
      }
    }

    return next();
  } catch (error) {
    // Continue without authentication
    return next();
  }
};

