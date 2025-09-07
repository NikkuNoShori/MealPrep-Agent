import { stackClientApp } from '../stack/client'

// Use the StackFrame client app for authentication

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

// Auth service using StackFrame client
export const authService = {
  // Get current user
  async getUser() {
    console.log('🟡 AuthService: Getting user...')
    const user = await stackClientApp.getUser()
    console.log('🟡 AuthService: User result:', user)
    return user
  },

  // Sign up
  async signUp(email: string, password: string) {
    console.log('🟡 AuthService: Starting signUp with email:', email)
    console.log('🟡 AuthService: StackClientApp config:', {
      projectId: stackClientApp.projectId
    })
    
    const result = await stackClientApp.signUpWithCredential({ email, password })
    console.log('🟡 AuthService: signUpWithCredential result:', result)
    return result
  },

  // Sign in
  async signIn(email: string, password: string) {
    return await stackClientApp.signInWithCredential({ email, password })
  },

  // Sign out
  async signOut() {
    // Note: signOut method may not be available in this version of StackClientApp
    // This is a placeholder implementation
    console.log('🟡 AuthService: Sign out requested')
    return { success: true }
  },

  // Check if user is authenticated
  async isAuthenticated() {
    const user = await stackClientApp.getUser()
    return !!user
  }
}

// Export the client app for use in components
export { stackClientApp }
