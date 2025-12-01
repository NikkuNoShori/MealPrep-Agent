import { createClient } from '@supabase/supabase-js'

// Supabase client for authentication
// Use singleton pattern to prevent multiple instances
let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️  Supabase credentials not configured. Authentication may not work.');
    console.warn('⚠️  Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
  }

  supabaseInstance = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    }
  });

  return supabaseInstance;
}

// Export singleton instance
const supabase = getSupabaseClient();

// Handle invalid refresh token errors gracefully
if (typeof window !== 'undefined') {
  // Listen for auth errors and clear invalid sessions
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      // Session is valid
      return;
    }
  });

  // Catch and handle refresh token errors on initial load
  supabase.auth.getSession().catch((error) => {
    if (error?.message?.includes('Invalid Refresh Token') || 
        error?.message?.includes('Refresh Token Not Found')) {
      // Clear invalid session from storage
      console.warn('⚠️ Invalid refresh token detected, clearing session');
      supabase.auth.signOut({ scope: 'local' }).catch(() => {
        // Ignore sign out errors
      });
    }
  });
}

// Recipe service - using API endpoints (not direct database access)
export const recipeService = {
  // Get all recipes for the current user
  async getRecipes() {
    // This should use the API endpoint, not direct database access
    // For now, return empty data until we implement the proper API
    return { recipes: [], total: 0 }
  },

  // Get a single recipe by ID
  async getRecipe(id: string) {
    // This should use the API endpoint
    return null
  },

  // Create a new recipe
  async createRecipe(recipeData: any) {
    // This should use the API endpoint
    throw new Error('Recipe creation not implemented yet')
  },

  // Update an existing recipe
  async updateRecipe(id: string, recipeData: any) {
    // This should use the API endpoint
    throw new Error('Recipe update not implemented yet')
  },

  // Delete a recipe
  async deleteRecipe(id: string) {
    // This should use the API endpoint
    throw new Error('Recipe deletion not implemented yet')
  }
}

// Auth service using Supabase Auth
export const authService = {
  // Get current user with profile data
  async getUser() {
    try {
      console.log('🟡 authService.getUser: Starting...')
      
      // First check if we have a session - this is more reliable than getUser() immediately after OAuth
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
      console.log('🟡 authService.getUser: Session check:', {
        hasSession: !!currentSession,
        hasUser: !!currentSession?.user,
        error: sessionError?.message
      })
      
      // If we have a session with a user, use that directly
      if (currentSession?.user) {
        console.log('✅ authService.getUser: Using user from session:', currentSession.user.id)
        const user = currentSession.user
        
        // Fetch profile data (don't fail if profile doesn't exist)
        let profile: any = null
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, first_name, last_name, avatar_url')
            .eq('id', user.id)
            .single()
          if (!error) {
            profile = data
          }
        } catch (err) {
          // Ignore profile fetch errors
          profile = null
        }

        // Extract avatar URL - Google OAuth provides 'picture' in user_metadata
        const avatarUrl = profile?.avatar_url || 
                         user.user_metadata?.avatar_url || 
                         user.user_metadata?.picture ||
                         user.user_metadata?.avatar_url
        
        console.log('🟡 authService.getUser: Avatar URL sources:', {
          profile_avatar_url: profile?.avatar_url,
          user_metadata_avatar_url: user.user_metadata?.avatar_url,
          user_metadata_picture: user.user_metadata?.picture,
          user_metadata_full: user.user_metadata,
          final_avatar_url: avatarUrl
        })

        return {
          ...user,
          email: user.email,
          display_name: profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          first_name: profile?.first_name || user.user_metadata?.first_name || user.user_metadata?.given_name || profile?.display_name?.split(' ')[0] || user.email?.split('@')[0] || 'User',
          avatar_url: avatarUrl,
        }
      }
      
      // Fallback: Try getUser() if no session (for cases where session isn't available yet)
      console.log('🟡 authService.getUser: No session found, trying getUser()...')
      const getUserPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('getUser timeout')), 3000)
      )
      
      let result: any
      try {
        result = await Promise.race([getUserPromise, timeoutPromise])
      } catch (timeoutError) {
        // Timeout occurred - clear invalid session
        console.warn('getUser timeout - clearing invalid session')
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        return null
      }
      
      const { data: { user }, error } = result || { data: { user: null }, error: null }
      
      console.log('🟡 authService.getUser: getUser() result:', {
        hasUser: !!user,
        error: error?.message
      })
      
      // Handle invalid refresh token errors
      if (error) {
        if (error.message?.includes('Invalid Refresh Token') || 
            error.message?.includes('Refresh Token Not Found') ||
            error.message?.includes('JWT')) {
          // Clear invalid session
          console.warn('Invalid token detected, clearing session')
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
          return null
        }
        console.warn('authService.getUser: Error from getUser():', error.message)
        return null
      }
      
      if (!user) {
        console.warn('authService.getUser: No user returned from getUser()')
        return null
      }

      // Fetch profile data (don't fail if profile doesn't exist)
      let profile: any = null
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, first_name, last_name, avatar_url')
          .eq('id', user.id)
          .single()
        if (!error) {
          profile = data
        }
      } catch (err) {
        // Ignore profile fetch errors
        profile = null
      }

      // Extract avatar URL - Google OAuth provides 'picture' in user_metadata
      const avatarUrl = profile?.avatar_url || 
                       user.user_metadata?.avatar_url || 
                       user.user_metadata?.picture ||
                       user.user_metadata?.avatar_url

      return {
        ...user,
        email: user.email,
        display_name: profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        first_name: profile?.first_name || user.user_metadata?.first_name || user.user_metadata?.given_name || profile?.display_name?.split(' ')[0] || user.email?.split('@')[0] || 'User',
        avatar_url: avatarUrl,
      }
    } catch (err: any) {
      // Handle any other errors gracefully
      if (err?.message?.includes('timeout')) {
        console.warn('Auth getUser timeout - clearing invalid session')
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      }
      return null
    }
  },

  // Sign up
  async signUp(email: string, password: string) {
    try {
      // Create user in Supabase Auth (auth.users table)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      // After auth user is created, create/update profile in profiles table
      // Note: The trigger should handle this automatically, but we do it here as backup
      if (data.user) {
        const { error: profileError } = await (supabase
          .from('profiles') as any)
          .upsert({
            id: data.user.id, // Use auth.users.id as the primary key
            email: data.user.email,
            display_name: data.user.email?.split('@')[0] || 'User',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
        
        if (profileError) {
          console.error('Error creating user profile:', profileError)
          // Don't throw - auth user is created, profile can be created later
        }
      }
      
      return {
        user: data.user ? {
          ...data.user,
          email: data.user.email,
        } : null,
        session: data.session
      }
    } catch (err: any) {
      throw new Error(err.message || 'Sign up failed')
    }
  },

  // Sign in
  async signIn(email: string, password: string) {
    try {
      // First, try to sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        // If user doesn't exist in auth.users, check if they exist in custom users table
        // This handles migration of existing users
        if (error.message.includes('Invalid login credentials') || error.message.includes('User not found')) {
          // Check if user exists in profiles table
          const { data: existingUser, error: userCheckError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single()
          
          if (existingUser && !userCheckError) {
            // User exists in custom table but not in auth.users
            // We need to create an auth user or provide migration path
            throw new Error('Account exists but needs to be migrated. Please use "Forgot Password" to reset your password and activate your account.')
          }
        }
        throw new Error(error.message)
      }
      
      // After successful sign in, ensure profile exists in profiles table
      // Note: The trigger should handle this automatically, but we do it here as backup
      if (data.user) {
        const { error: profileError } = await (supabase
          .from('profiles') as any)
          .upsert({
            id: data.user.id,
            email: data.user.email,
            display_name: data.user.email?.split('@')[0] || 'User',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
        
        if (profileError) {
          console.error('Error syncing user profile:', profileError)
        }
      }
      
      return {
        user: data.user ? {
          ...data.user,
          email: data.user.email,
        } : null,
        session: data.session
      }
    } catch (err: any) {
      throw new Error(err.message || 'Sign in failed')
    }
  },

  // Sign out
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        throw new Error(error.message)
      }
      return { success: true }
    } catch (err: any) {
      throw new Error(err.message || 'Sign out failed')
    }
  },

  // Check if user is authenticated
  async isAuthenticated() {
    const user = await this.getUser()
    return !!user
  },

  // Sign in with Google OAuth
  async signInWithGoogle(redirectTo?: string) {
    try {
      const redirectUrl = redirectTo || `${window.location.origin}/auth/callback`
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      return { url: data.url }
    } catch (err: any) {
      throw new Error(err.message || 'Google sign in failed')
    }
  },

  // Link Google account to existing user
  async linkGoogleAccount(redirectTo?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User must be signed in to link accounts')
      }

      const redirectUrl = redirectTo || `${window.location.origin}/auth/callback`
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      // Note: Supabase will automatically link the account if the email matches
      // If emails don't match, the user will need to use the same email for both accounts
      return { url: data.url }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to link Google account')
    }
  },

  // Unlink Google account
  async unlinkGoogleAccount() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Find Google identity
      const googleIdentity = user.identities?.find(
        (identity: any) => identity.provider === 'google'
      )

      if (!googleIdentity) {
        throw new Error('Google account is not linked')
      }

      const { error } = await supabase.auth.unlinkIdentity({
        provider: 'google',
        identityId: googleIdentity.id,
      } as any)

      if (error) {
        throw new Error(error.message)
      }

      return { success: true }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to unlink Google account')
    }
  },

  // Get linked accounts for current user
  async getLinkedAccounts() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        return []
      }

      return user.identities?.map((identity: any) => ({
        provider: identity.provider,
        id: identity.id,
        created_at: identity.created_at,
      })) || []
    } catch (err) {
      console.error('Error getting linked accounts:', err)
      return []
    }
  },

  // Request password reset
  async requestPasswordReset(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      return { success: true }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to send password reset email')
    }
  },

  // Handle OAuth callback - wait for session to be available
  async handleOAuthCallback(): Promise<{ user: any; session: any }> {
    return new Promise((resolve, reject) => {
      let resolved = false
      let subscription: any = null

      // Set a timeout to avoid infinite waiting
      const timeout = setTimeout(() => {
        if (subscription) {
          subscription.unsubscribe()
        }
        if (!resolved) {
          resolved = true
          reject(new Error('OAuth callback timeout - session not received. Please try signing in again.'))
        }
      }, 15000) // 15 second timeout

      // Helper to resolve and clean up
      const resolveCallback = async (session: any) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        if (subscription) {
          subscription.unsubscribe()
        }

        try {
          // Ensure profile exists
          if (session?.user) {
            const { error: profileError } = await (supabase
              .from("profiles") as any)
              .upsert(
                {
                  id: session.user.id,
                  email: session.user.email,
                  display_name:
                    session.user.user_metadata?.full_name ||
                    session.user.user_metadata?.name ||
                    session.user.email?.split("@")[0] ||
                    "User",
                  first_name:
                    session.user.user_metadata?.first_name ||
                    session.user.user_metadata?.given_name ||
                    session.user.user_metadata?.full_name?.split(" ")[0] ||
                    "",
                  avatar_url:
                    session.user.user_metadata?.avatar_url ||
                    session.user.user_metadata?.picture,
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: "id",
                }
              );
            
            if (profileError) {
              console.error('Error syncing user profile:', profileError)
              // Don't throw - profile can be created later
            }
          }

          resolve({
            user: session?.user ? {
              id: session.user.id,
              email: session.user.email,
              ...session.user
            } : null,
            session: session
          })
        } catch (err: any) {
          reject(new Error(err.message || 'Failed to process OAuth callback'))
        }
      }

      // Listen for auth state changes (primary method)
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (resolved) return

          if (event === 'SIGNED_IN' && session) {
            await resolveCallback(session)
          } else if (event === 'SIGNED_OUT') {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              if (subscription) {
                subscription.unsubscribe()
              }
              reject(new Error('OAuth callback failed - user not signed in'))
            }
          }
        }
      )
      subscription = authSubscription

      // Also try to get session immediately (in case it's already available)
      // Wait a small delay first to let Supabase process the URL
      setTimeout(async () => {
        if (resolved) return

        try {
          const { data, error } = await supabase.auth.getSession()
          if (data.session && !error && !resolved) {
            await resolveCallback(data.session)
          }
        } catch (err) {
          // Ignore errors here, let the onAuthStateChange handle it
          console.error('Error getting session:', err)
        }
      }, 500) // Wait 500ms for Supabase to process the URL
    })
  }
}

// Export supabase client for use in components
export { supabase }


