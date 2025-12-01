/**
 * Authentication helper for Vercel Edge Functions
 * Verifies Supabase Auth tokens in edge function context
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Verify Supabase Auth token in edge function
 * @param {Request} request - The incoming request
 * @returns {Promise<{user: object | null, error: string | null}>}
 */
export async function verifyAuthToken(request) {
  try {
    // Get Supabase URL and anon key from environment
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      // In development, allow requests without auth
      if (process.env.NODE_ENV === 'development') {
        return { user: { id: 'test-user' }, error: null };
      }
      return { user: null, error: 'Authentication not configured' };
    }

    // Create Supabase client for edge function
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Extract token from cookies or Authorization header
    const cookies = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';

    let accessToken = null;

    // Parse cookies
    const cookieMap = {};
    cookies.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookieMap[name] = value;
      }
    });

    // Check for Supabase Auth cookie (common names)
    const possibleCookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'supabase.auth.token',
    ];

    for (const cookieName of possibleCookieNames) {
      if (cookieMap[cookieName]) {
        try {
          // Cookie might be JSON
          const parsed = JSON.parse(cookieMap[cookieName]);
          accessToken = parsed.access_token || parsed.token || cookieMap[cookieName];
        } catch {
          // If not JSON, use directly
          accessToken = cookieMap[cookieName];
        }
        break;
      }
    }

    // Check Authorization header
    if (!accessToken && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.replace('Bearer ', '');
    }

    if (!accessToken) {
      return { user: null, error: 'No authentication token found' };
    }

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return { user: null, error: error?.message || 'Invalid authentication token' };
    }

    return { user: { id: user.id, email: user.email }, error: null };
  } catch (error) {
    console.error('Authentication error:', error);
    // In development, allow with warning
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Development mode: Allowing request without token verification');
      return { user: { id: 'test-user' }, error: null };
    }
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
