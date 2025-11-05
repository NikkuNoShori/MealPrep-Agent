import { create } from 'zustand'
import { authService } from '@/services/authService'
import { Logger } from '@/services/logger'
import { stackClientApp } from '@/stack/client'

export interface AuthUser {
  id: string
  email?: string
  [key: string]: any
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  initialize: () => Promise<void>
  refreshUser: () => Promise<void>
  signIn: (email: string, password: string) => Promise<AuthUser>
  signUp: (email: string, password: string) => Promise<AuthUser>
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
      
      // Update state with user
      set({ user, isLoading: false })
      
      return user;
    } catch (err: any) {
      Logger.error('🔴 AuthStore: SignIn error', err)
      set({ error: err?.message || 'Sign in failed', isLoading: false })
      throw err
    }
  },

  signUp: async (email: string, password: string) => {
    Logger.info('🔵 AuthStore: Starting signUp', { email })
    set({ isLoading: true, error: null })
    try {
      Logger.info('🔵 AuthStore: Calling authService.signUp...')
      
      // signUp now returns the user directly, with retry logic built-in
      const user = await authService.signUp(email, password)
      
      if (!user) {
        throw new Error('Sign up successful but user not found. Please try signing in.')
      }
      
      Logger.info('🔵 AuthStore: SignUp successful', { userId: user.id })
      Logger.auth('signup', user.id, email)
      
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
        Logger.info('🔵 AuthStore: Setting up polling for auth state changes')
        const pollInterval = setInterval(async () => {
          try {
            const currentUser = await authService.getUser()
            const currentState = useAuthStore.getState()
            // Only update if user changed
            if (currentUser?.id !== currentState.user?.id) {
              Logger.info('🔵 AuthStore: User changed via polling', { 
                hasUser: !!currentUser, 
                userId: currentUser?.id 
              })
              set({ user: currentUser, isLoading: false })
            }
          } catch (err) {
            Logger.debug('🔍 AuthStore: Polling error (non-critical)', err)
          }
        }, 5000) // Check every 5 seconds

        // Store interval ID for cleanup (if needed)
        ;(useAuthStore as any).pollInterval = pollInterval
      }
    } catch (err: any) {
      Logger.error('🔴 AuthStore: Error setting up auth listener', err)
      ;(useAuthStore as any).listenerSetup = false // Reset on error
    }
  }
}))


