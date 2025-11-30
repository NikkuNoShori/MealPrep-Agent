import { create } from 'zustand'
import { authService } from '@/services/supabase'

export interface AuthUser {
  id: string
  email?: string
  [key: string]: any
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  linkedAccounts: Array<{ provider: string; id: string; created_at: string }>
  initialize: () => Promise<void>
  refreshUser: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  linkGoogleAccount: (redirectTo?: string) => Promise<void>
  unlinkGoogleAccount: () => Promise<void>
  loadLinkedAccounts: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,
  linkedAccounts: [],

  initialize: async () => {
    set({ isLoading: true, error: null })
    try {
      const currentUser = await authService.getUser()
      set({ user: currentUser || null })
      if (currentUser) {
        const accounts = await authService.getLinkedAccounts()
        set({ linkedAccounts: accounts })
      }
    } catch (err: any) {
      set({ user: null, error: err?.message || 'Failed to initialize auth' })
    } finally {
      set({ isLoading: false })
    }
  },

  refreshUser: async () => {
    try {
      const currentUser = await authService.getUser()
      set({ user: currentUser || null })
      if (currentUser) {
        const accounts = await authService.getLinkedAccounts()
        set({ linkedAccounts: accounts })
      }
    } catch (err: any) {
      set({ user: null, error: err?.message || 'Failed to refresh user' })
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      await authService.signIn(email, password);
      // Wait a moment for session to be fully established
      await new Promise((resolve) => setTimeout(resolve, 100));
      const currentUser = await authService.getUser();
      set({ user: currentUser || null });
      if (currentUser) {
        const accounts = await authService.getLinkedAccounts();
        set({ linkedAccounts: accounts });
      }
    } catch (err: any) {
      set({ error: err?.message || 'Sign in failed' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  signUp: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const signUpResult = await authService.signUp(email, password)
      
      // If signup succeeded but no session (email confirmation required), 
      // automatically sign in the user
      if (signUpResult.user && !signUpResult.session) {
        await authService.signIn(email, password)
      }
      
      const currentUser = await authService.getUser()
      set({ user: currentUser || null })
      if (currentUser) {
        const accounts = await authService.getLinkedAccounts()
        set({ linkedAccounts: accounts })
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Sign up failed'
      set({ error: errorMessage })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  signInWithGoogle: async (redirectTo?: string) => {
    set({ isLoading: true, error: null })
    try {
      const { url } = await authService.signInWithGoogle(redirectTo)
      if (url) {
        window.location.href = url
      }
    } catch (err: any) {
      set({ error: err?.message || 'Google sign in failed' })
      set({ isLoading: false })
      throw err
    }
  },

  linkGoogleAccount: async (redirectTo?: string) => {
    set({ isLoading: true, error: null })
    try {
      const { url } = await authService.linkGoogleAccount(redirectTo)
      if (url) {
        window.location.href = url
      }
    } catch (err: any) {
      set({ error: err?.message || 'Failed to link Google account' })
      set({ isLoading: false })
      throw err
    }
  },

  unlinkGoogleAccount: async () => {
    set({ isLoading: true, error: null })
    try {
      await authService.unlinkGoogleAccount()
      const accounts = await authService.getLinkedAccounts()
      set({ linkedAccounts: accounts })
    } catch (err: any) {
      set({ error: err?.message || 'Failed to unlink Google account' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  loadLinkedAccounts: async () => {
    try {
      const accounts = await authService.getLinkedAccounts()
      set({ linkedAccounts: accounts })
    } catch (err: any) {
      console.error('Failed to load linked accounts:', err)
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null })
    try {
      await authService.signOut()
      set({ user: null, linkedAccounts: [] })
    } catch (err: any) {
      set({ error: err?.message || 'Sign out failed' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  }
}))


