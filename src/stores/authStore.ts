import { create } from 'zustand'
import { authService } from '@/services/authService'
import { Logger } from '@/services/logger'
import { supabase } from '@/lib/supabase'

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
    Logger.info('🔵 AuthStore: Initializing auth, checking Supabase session...')
    set({ isLoading: true, error: null })
    try {
      // Check for existing user session from Supabase
      // Supabase automatically handles session persistence
      const currentUser = await authService.getUser()
      Logger.info('🔵 AuthStore: User found during initialization', { 
        found: currentUser ? 'Yes' : 'No',
        userId: currentUser?.id,
        source: 'Supabase Auth'
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
    // Prevent duplicate listener setup
    if ((useAuthStore as any).listenerSetup) {
      Logger.debug('🔍 AuthStore: Listener already setup, skipping')
      return
    }
    
    ;(useAuthStore as any).listenerSetup = true

    try {
      // Set up Supabase auth state change listener
      Logger.info('🔵 AuthStore: Setting up Supabase auth state listener')
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        Logger.info('🔵 AuthStore: Auth state changed', { event, hasSession: !!session })
        
        if (session?.user) {
          // Transform Supabase user to match expected format
          const user: AuthUser = {
            id: session.user.id,
            email: session.user.email,
            emailVerified: session.user.email_confirmed_at ? true : false,
            firstName: session.user.user_metadata?.first_name,
            first_name: session.user.user_metadata?.first_name,
            lastName: session.user.user_metadata?.last_name,
            last_name: session.user.user_metadata?.last_name,
            displayName: session.user.user_metadata?.full_name || session.user.email,
            ...session.user
          }
          set({ user, isLoading: false })
        } else {
          // User signed out
          set({ user: null, isLoading: false })
        }
      })
      
      // Store subscription for cleanup if needed
      ;(useAuthStore as any).authSubscription = subscription
      
      Logger.info('✅ AuthStore: Supabase auth listener setup successfully')
    } catch (err: any) {
      Logger.error('🔴 AuthStore: Error setting up auth listener', err)
      ;(useAuthStore as any).listenerSetup = false // Reset on error
    }
  }
}))


