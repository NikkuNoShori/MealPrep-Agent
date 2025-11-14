import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

// Initialize Supabase client
// Server-side can use anon key for token verification (service role key only needed for admin operations)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Optional - only needed for admin operations

// Log configuration status (without exposing secrets)
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase Auth Middleware: Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceKey,
    urlSource: supabaseUrl ? (process.env.SUPABASE_URL ? 'SUPABASE_URL' : 'VITE_SUPABASE_URL') : 'none',
    urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'none'
  });
}

let supabaseClient = null;

// Initialize Supabase client for server-side token verification
// Uses anon key (service role key only needed for admin operations that bypass RLS)
function initializeSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Prefer anon key (sufficient for token verification)
  // Service role key is only needed for admin operations
  const supabaseKey = supabaseAnonKey || supabaseServiceKey;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase not configured. Missing environment variables:', {
      missingUrl: !supabaseUrl,
      missingAnonKey: !supabaseAnonKey,
      missingServiceKey: !supabaseServiceKey,
    });
    console.warn('   Please set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) in your .env file');
    console.warn('   Note: SUPABASE_SERVICE_ROLE_KEY is optional (only needed for admin operations)');
    return null;
  }

  try {
    // Use anon key for token verification (respects RLS)
    // Service role key can be used if provided, but anon key is sufficient
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('✅ Supabase client initialized successfully', {
      usingServiceKey: !!supabaseServiceKey && !supabaseAnonKey,
      usingAnonKey: !!supabaseAnonKey
    });
    return supabaseClient;
  } catch (error) {
    console.error('❌ Supabase client initialization failed:', error.message);
    return null;
  }
}

/**
 * Extract access token from request
 */
function getAccessToken(req) {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  // Check cookies (Supabase stores tokens in cookies)
  // Supabase uses cookie format: sb-<project-ref>-auth-token
  // The cookie contains: { access_token, refresh_token, expires_at, token_type, user }
  const cookies = req.cookies || {};
  
  // Try to find Supabase auth cookie
  // Supabase cookie format: sb-<project-ref>-auth-token
  // We need to check all cookies that start with 'sb-' and end with '-auth-token'
  const supabaseCookieNames = Object.keys(cookies).filter(name => 
    name.startsWith('sb-') && name.endsWith('-auth-token')
  );
  
  // Also check common cookie names
  const possibleCookieNames = [
    ...supabaseCookieNames,
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token',
    'supabase.auth.token',
  ];

  for (const cookieName of possibleCookieNames) {
    if (cookies[cookieName]) {
      try {
        // Supabase cookie is JSON with structure: { access_token, refresh_token, expires_at, token_type, user }
        const parsed = JSON.parse(cookies[cookieName]);
        
        // Extract access token from parsed cookie
        if (parsed.access_token) {
          return parsed.access_token;
        }
        
        // Fallback to token field
        if (parsed.token) {
          return parsed.token;
        }
        
        // If it's an array (legacy format), get the access token
        if (Array.isArray(parsed) && parsed.length > 1) {
          return parsed[1]; // access_token is typically the second element
        }
        
        // Last resort: use the cookie value directly
        return cookies[cookieName];
      } catch {
        // If not JSON, use directly (might be the token itself)
        return cookies[cookieName];
      }
    }
  }

  return null;
}

/**
 * Authentication middleware for Express
 * Verifies Supabase Auth tokens and attaches user to request
 */
export const authenticateRequest = async (req, res, next) => {
  try {
    const supabase = initializeSupabase();
    
    if (!supabase) {
      console.error('❌ Supabase not configured - authentication required');
      return res.status(500).json({
        error: 'Authentication service not configured',
        message: 'Supabase not initialized. Please configure SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).',
      });
    }

    // Get access token from request
    const accessToken = getAccessToken(req);
    
    if (!accessToken) {
      // Log available cookies for debugging
      const cookies = req.cookies || {};
      const cookieNames = Object.keys(cookies);
      console.warn('⚠️ No authentication token found in cookies or headers');
      console.warn('   Available cookies:', cookieNames);
      console.warn('   Cookie values (first 50 chars):', 
        Object.entries(cookies).reduce((acc, [name, value]) => {
          acc[name] = typeof value === 'string' ? value.substring(0, 50) : value;
          return acc;
        }, {})
      );
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No authentication token found in cookies or Authorization header',
      });
    }

    // Verify token and get user
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.warn('⚠️ Supabase could not verify user from token', { error: error?.message });
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid or expired',
      });
    }

    console.log('✅ Authenticated user:', { id: user.id, email: user.email });
    
    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.first_name || user.user_metadata?.full_name || user.email,
    };

    return next();
  } catch (error) {
    console.error('❌ Authentication middleware error:', error);
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
    const supabase = initializeSupabase();
    
    if (!supabase) {
      // If Supabase is not configured, continue without authentication
      return next();
    }

    const accessToken = getAccessToken(req);
    
    if (accessToken) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        
        if (!error && user) {
          req.user = {
            id: user.id,
            email: user.email,
            displayName: user.user_metadata?.first_name || user.user_metadata?.full_name || user.email,
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
