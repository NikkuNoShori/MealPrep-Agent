import { createClient } from '@supabase/supabase-js'

// Supabase client for authentication
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  Supabase credentials not configured. Authentication may not work.');
  console.warn('⚠️  Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '')

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
  // Get current user
  async getUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        return null
      }
      return user ? {
        id: user.id,
        email: user.email,
        ...user
      } : null
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
  }
}

// Export supabase client for use in components
export { supabase }


