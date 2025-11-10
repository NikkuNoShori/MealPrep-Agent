import { create } from 'zustand'
import { authService } from '@/services/authService'
import { Logger } from '@/services/logger'
import { stackClientApp } from '@/stack/client'

export interface AuthUser {
  id: string
  email?: string
  firstName?: string
  first_name?: string
  lastName?: string
  last_name?: string
  displayName?: string
  [key: string]: any
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  initialize: () => Promise<void>
  refreshUser: () => Promise<void>
  signIn: (email: string, password: string) => Promise<AuthUser>
  signUp: (firstName: string, lastName: string, email: string, password: string) => Promise<AuthUser>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  setupAuthListener: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    Logger.info('🔵 AuthStore: Initializing auth, checking Stack Auth cookies for existing session...')
    set({ isLoading: true, error: null })
    try {
      // Check for existing user session from Stack Auth cookies
      // Stack Auth with tokenStore: "cookie" automatically reads from cookies
      // No localStorage needed - cookies persist across page refreshes
      const currentUser = await authService.getUser()
      Logger.info('🔵 AuthStore: User found during initialization', { 
        found: currentUser ? 'Yes' : 'No',
        userId: currentUser?.id,
        source: 'Stack Auth cookies'
      })
      set({ user: currentUser || null, isLoading: false })
    } catch (err: any) {
      Logger.error('🔴 AuthStore: Initialization error', err)
      set({ user: null, error: err?.message || 'Failed to initialize auth', isLoading: false })
    }
  },

  refreshUser: async () => {
    try {
      const currentUser = await authService.getUser()
      set({ user: currentUser || null })
    } catch (err: any) {
      set({ user: null, error: err?.message || 'Failed to refresh user' })
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      Logger.info('🔵 AuthStore: Starting signIn...')
      
      // signIn now returns the user directly, with retry logic built-in
      const user = await authService.signIn(email, password)
      
      if (!user) {
        throw new Error('Sign in successful but user not found. Please try again.')
      }
      
      Logger.info('🔵 AuthStore: SignIn successful', { userId: user.id })
      Logger.auth('signin', user.id, email)
      
      // Stop any existing polling since we now have a user
      const existingInterval = (useAuthStore as any).pollInterval
      if (existingInterval) {
        Logger.debug('🔍 AuthStore: Stopping polling after signin')
        clearInterval(existingInterval)
        ;(useAuthStore as any).pollInterval = null
      }
      
      // Clear any existing chat state and set flag to create a new chat on next visit
      localStorage.removeItem("chat-current-conversation-id");
      localStorage.setItem("chat-create-temporary-session", "true");
      Logger.info('🔵 AuthStore: Set flag to create new chat on next visit')
      
      // Update state with user
      set({ user, isLoading: false })
      
      return user;
    } catch (err: any) {
      Logger.error('🔴 AuthStore: SignIn error', err)
      set({ error: err?.message || 'Sign in failed', isLoading: false })
      throw err
    }
  },

  signUp: async (firstName: string, lastName: string, email: string, password: string) => {
    Logger.info('🔵 AuthStore: Starting signUp', { email, firstName, lastName })
    set({ isLoading: true, error: null })
    try {
      Logger.info('🔵 AuthStore: Calling authService.signUp...')
      
      // signUp now returns the user directly, with retry logic built-in
      const user = await authService.signUp(firstName, lastName, email, password)
      
      if (!user) {
        throw new Error('Sign up successful but user not found. Please try signing in.')
      }
      
      Logger.info('🔵 AuthStore: SignUp successful', { userId: user.id })
      Logger.auth('signup', user.id, email)
      
      // Stop any existing polling since we now have a user
      const existingInterval = (useAuthStore as any).pollInterval
      if (existingInterval) {
        Logger.debug('🔍 AuthStore: Stopping polling after signup')
        clearInterval(existingInterval)
        ;(useAuthStore as any).pollInterval = null
      }
      
      // Clear any existing chat state and set flag to create a new chat on next visit
      localStorage.removeItem("chat-current-conversation-id");
      localStorage.setItem("chat-create-temporary-session", "true");
      Logger.info('🔵 AuthStore: Set flag to create new chat on next visit')
      
      // Update state with user
      set({ user, isLoading: false })
      
      return user;
    } catch (err: any) {
      Logger.error('🔴 AuthStore: SignUp error', err)
      set({ error: err?.message || 'Sign up failed', isLoading: false })
      throw err
    }
  },

  signOut: async () => {
    const userId = useAuthStore.getState().user?.id
    set({ isLoading: true, error: null })
    try {
      await authService.signOut()
      
      // Clear user state
      set({ user: null, isLoading: false })
      
      // Restart polling to detect when user logs in again
      const existingInterval = (useAuthStore as any).pollInterval
      if (!existingInterval) {
        Logger.debug('🔍 AuthStore: Restarting polling after signout')
        // Polling will be restarted by setupAuthListener if needed
        // But we need to check if listener is already set up
        if ((useAuthStore as any).listenerSetup) {
          // Re-setup listener to restart polling
          ;(useAuthStore as any).listenerSetup = false
          useAuthStore.getState().setupAuthListener()
        }
      }
      
      Logger.auth('signout', userId)
      Logger.info('🔵 AuthStore: Sign out successful')
    } catch (err: any) {
      Logger.error('🔴 AuthStore: SignOut error', err)
      // Even if signOut fails, clear local state
      set({ user: null, error: err?.message || 'Sign out failed', isLoading: false })
    }
  },

  requestPasswordReset: async (email: string) => {
    Logger.info('🔵 AuthStore: Requesting password reset', { email })
    set({ error: null })
    try {
      await authService.requestPasswordReset(email)
      Logger.auth('password-reset', undefined, email)
      Logger.info('🔵 AuthStore: Password reset request sent successfully')
    } catch (err: any) {
      Logger.error('🔴 AuthStore: Password reset request failed', err)
      set({ error: err?.message || 'Failed to send password reset email' })
      throw err
    }
  },

  setupAuthListener: () => {
    if (!stackClientApp) {
      Logger.warn('⚠️ AuthStore: Cannot setup auth listener - Stack Auth not configured')
      return
    }

    // Prevent duplicate listener setup
    const store = useAuthStore.getState()
    if ((useAuthStore as any).listenerSetup) {
      Logger.debug('🔍 AuthStore: Listener already setup, skipping')
      return
    }
    
    ;(useAuthStore as any).listenerSetup = true

    try {
      // Check if Stack Auth has an onUserChange or similar listener
      const client = stackClientApp as any
      
      // Try to set up a listener for auth state changes
      if (typeof client.onUserChange === 'function') {
        Logger.info('🔵 AuthStore: Setting up onUserChange listener')
        client.onUserChange(async (user: AuthUser | null) => {
          Logger.info('🔵 AuthStore: User changed via listener', { hasUser: !!user, userId: user?.id })
          set({ user, isLoading: false })
        })
      } else if (typeof client.subscribe === 'function') {
        // Alternative: subscribe to auth state changes
        Logger.info('🔵 AuthStore: Setting up subscribe listener')
        client.subscribe((user: AuthUser | null) => {
          Logger.info('🔵 AuthStore: User changed via subscribe', { hasUser: !!user, userId: user?.id })
          set({ user, isLoading: false })
        })
      } else {
        // Fallback: Poll for user changes periodically (less efficient but works)
        // Clear any existing polling interval first to prevent duplicates
        const existingInterval = (useAuthStore as any).pollInterval
        if (existingInterval) {
          Logger.debug('🔍 AuthStore: Clearing existing polling interval')
          clearInterval(existingInterval)
          ;(useAuthStore as any).pollInterval = null
        }
        
        // Only set up polling if we don't already have a user
        // If user is already loaded, no need to poll
        const currentState = useAuthStore.getState()
        if (currentState.user) {
          Logger.info('🔵 AuthStore: User already loaded, skipping polling setup')
          return
        }
        
        Logger.info('🔵 AuthStore: Setting up polling for auth state changes (no user detected)')
        const pollInterval = setInterval(async () => {
          try {
            const currentState = useAuthStore.getState()
            
            // Skip polling if we already have a user - only poll to detect login
            // This prevents unnecessary calls when user is already authenticated
            if (currentState.user) {
              Logger.info('🔵 AuthStore: User detected during poll, stopping polling')
              clearInterval(pollInterval)
              ;(useAuthStore as any).pollInterval = null
              return
            }
            
            // Only poll if we don't have a user (to detect when they log in)
            const currentUser = await authService.getUser()
            if (currentUser?.id !== currentState.user?.id) {
              Logger.info('🔵 AuthStore: User changed via polling', { 
                hasUser: !!currentUser, 
                userId: currentUser?.id 
              })
              set({ user: currentUser, isLoading: false })
              
              // Stop polling once we have a user
              if (currentUser) {
                Logger.info('🔵 AuthStore: User detected, stopping polling')
                clearInterval(pollInterval)
                ;(useAuthStore as any).pollInterval = null
              }
            }
          } catch (err) {
            Logger.debug('🔍 AuthStore: Polling error (non-critical)', err)
          }
        }, 30000) // Check every 30 seconds (only when no user is loaded)

        // Store interval ID for cleanup (if needed)
        ;(useAuthStore as any).pollInterval = pollInterval
      }
    } catch (err: any) {
      Logger.error('🔴 AuthStore: Error setting up auth listener', err)
      ;(useAuthStore as any).listenerSetup = false // Reset on error
    }
  }
}))


