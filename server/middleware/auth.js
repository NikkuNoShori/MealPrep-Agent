import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Stack Auth server SDK lazily to avoid importing 'next' dependency
// Stack Auth requires server secret key for server-side verification
const projectId = process.env.STACK_PROJECT_ID || process.env.VITE_STACK_PROJECT_ID;
const serverSecretKey = process.env.STACK_SERVER_SECRET_KEY;

let stackServerApp = null;
let stackModule = null;

// Lazy load Stack Auth to avoid importing 'next' dependency
async function initializeStackAuth() {
  if (stackServerApp !== null) {
    return stackServerApp; // Already initialized or attempted
  }

  if (!projectId || !serverSecretKey) {
    console.warn('⚠️ Stack Auth server not configured. Missing environment variables:', {
      missingProjectId: !projectId,
      missingServerSecretKey: !serverSecretKey,
      checkedEnvVars: {
        STACK_PROJECT_ID: !!process.env.STACK_PROJECT_ID,
        VITE_STACK_PROJECT_ID: !!process.env.VITE_STACK_PROJECT_ID,
        STACK_SERVER_SECRET_KEY: !!process.env.STACK_SERVER_SECRET_KEY
      }
    });
    console.warn('   Please set STACK_PROJECT_ID and STACK_SERVER_SECRET_KEY in your .env file');
    stackServerApp = false; // Mark as attempted but not configured
    return null;
  }

  try {
    // Dynamic import to avoid loading 'next' dependency at module load time
    if (!stackModule) {
      try {
        stackModule = await import('@stackframe/stack');
      } catch (importError) {
        // Handle case where @stackframe/stack requires 'next' but it's not installed
        if (importError.code === 'ERR_MODULE_NOT_FOUND' && importError.message.includes('next')) {
          console.warn('⚠️ Stack Auth requires Next.js but it is not installed. Stack Auth will not be available.');
          console.warn('   To use Stack Auth, install Next.js: npm install next');
          stackServerApp = false;
          return null;
        }
        throw importError; // Re-throw other import errors
      }
    }
    
    const { StackServerApp } = stackModule;
    stackServerApp = new StackServerApp({
      projectId,
      secretKey: serverSecretKey,
    });
    console.log('✅ Stack Auth server initialized successfully');
    return stackServerApp;
  } catch (error) {
    console.error('❌ Stack Auth server initialization failed:', error.message);
    if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('next')) {
      console.warn('   Stack Auth requires Next.js. Install it with: npm install next');
    }
    stackServerApp = false; // Mark as failed
    return null;
  }
}

/**
 * Authentication middleware for Express
 * Verifies Stack Auth cookies and attaches user to request
 */
export const authenticateRequest = async (req, res, next) => {
  try {
    // Initialize Stack Auth if not already done
    const authApp = await initializeStackAuth();
    
    // Log for debugging
    console.log('🔵 Auth Middleware:', {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      hasAuthApp: !!authApp,
      authAppType: typeof authApp,
      cookies: Object.keys(req.cookies || {}).length > 0 ? Object.keys(req.cookies) : 'none'
    });
    
    // Require Stack Auth configuration - no test user fallback
    if (!authApp) {
      console.error('❌ Stack Auth not configured - authentication required');
      return res.status(500).json({
        error: 'Authentication service not configured',
        message: 'Stack Auth server SDK not initialized. Please configure STACK_PROJECT_ID and STACK_SERVER_SECRET_KEY.',
      });
    }

    // Stack Auth server SDK should have a method to get user from request
    // Try different Stack Auth API methods to get user from cookies/request
    try {
      let user = null;
      
      // Try Stack Auth's getUserFromRequest or similar method
      // Stack Auth server SDK typically handles cookies automatically
      if (typeof authApp.getUserFromRequest === 'function') {
        user = await authApp.getUserFromRequest(req);
      } else if (typeof authApp.getUser === 'function') {
        // getUser might work with request object or cookies
        user = await authApp.getUser(req);
      } else {
        // Fallback: Extract token manually and use getUserFromToken
        const cookies = req.cookies || {};
        
        // Stack Auth cookie names - check common patterns
        const possibleCookieNames = [
          `sf-access-token-${projectId}`, // Stack Auth default pattern
          `stack-auth-${projectId}`,
          'sf-access-token',
          'stack-auth-token',
          'stack-auth',
          'auth-token',
          'session',
        ];
        
        let authToken = null;
        for (const cookieName of possibleCookieNames) {
          if (cookies[cookieName]) {
            authToken = cookies[cookieName];
            console.log(`🔵 Found auth token in cookie: ${cookieName}`);
            break;
          }
        }
        
        // Also check Authorization header
        if (!authToken) {
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            authToken = authHeader.replace('Bearer ', '');
            console.log('🔵 Found auth token in Authorization header');
          }
        }
        
        if (!authToken) {
          console.warn('⚠️ No authentication token found in cookies or headers');
          console.log('Available cookies:', Object.keys(cookies));
          return res.status(401).json({
            error: 'Authentication required',
            message: 'No authentication token found in cookies or Authorization header',
          });
        }
        
        // Try getUserFromToken
        if (typeof authApp.getUserFromToken === 'function') {
          user = await authApp.getUserFromToken(authToken);
        } else if (typeof authApp.verifyToken === 'function') {
          const tokenData = await authApp.verifyToken(authToken);
          if (tokenData && tokenData.userId) {
            user = await authApp.getUserById(tokenData.userId);
          }
        }
      }
      
      if (!user) {
        console.warn('⚠️ Stack Auth could not verify user from token/cookies');
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Authentication token is invalid or expired',
        });
      }

      console.log('✅ Authenticated user:', { id: user.id, email: user.email });
      
      // Attach user to request
      req.user = {
        id: user.id || user.userId,
        email: user.email,
        displayName: user.displayName || user.name || user.displayName,
      };

      return next();
    } catch (authError) {
      console.error('❌ Authentication verification error:', authError);
      console.error('Error details:', {
        message: authError.message,
        stack: authError.stack,
        name: authError.name
      });
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Failed to verify authentication token',
        details: process.env.NODE_ENV === 'development' ? authError.message : undefined
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
    // Initialize Stack Auth if not already done
    const authApp = await initializeStackAuth();
    
    if (!authApp) {
      // No test user fallback - if Stack Auth is not configured, user remains null
      // This allows RLS to handle public vs private access correctly
      // Unauthenticated users will only see public records via RLS
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
        // Stack Auth SDK methods may vary - try common patterns
        let user = null;
        
        // Try different Stack Auth API methods
        if (typeof authApp.getUserFromToken === 'function') {
          user = await authApp.getUserFromToken(authToken);
        } else if (typeof authApp.getUser === 'function') {
          user = await authApp.getUser(authToken);
        } else if (typeof authApp.verifyToken === 'function') {
          const tokenData = await authApp.verifyToken(authToken);
          if (tokenData && tokenData.userId) {
            user = await authApp.getUserById(tokenData.userId);
          }
        } else {
          // Try to get user from session
          const session = await authApp.getSession(authToken);
          if (session && session.userId) {
            user = await authApp.getUserById(session.userId);
          }
        }
        
        if (user) {
          req.user = {
            id: user.id || user.userId,
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

