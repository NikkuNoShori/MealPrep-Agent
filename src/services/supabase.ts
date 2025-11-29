import { createClient } from '@supabase/supabase-js'

// Supabase client for authentication
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  Supabase credentials not configured. Authentication may not work.');
  console.warn('⚠️  Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

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
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        return null
      }

      // Fetch profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name, avatar_url')
        .eq('id', user.id)
        .single()

      return {
        id: user.id,
        email: user.email,
        display_name: profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        first_name: profile?.first_name || user.user_metadata?.first_name || user.user_metadata?.given_name || profile?.display_name?.split(' ')[0] || user.email?.split('@')[0] || 'User',
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture,
        ...user
      }
    } catch (err) {
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
        const { error: profileError } = await supabase
          .from('profiles')
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
          id: data.user.id,
          email: data.user.email,
          ...data.user
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
        const { error: profileError } = await supabase
          .from('profiles')
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
          id: data.user.id,
          email: data.user.email,
          ...data.user
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
      })

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
            const { error: profileError } = await supabase
              .from("profiles")
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


