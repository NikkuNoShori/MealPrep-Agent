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
  initialize: () => Promise<void>
  refreshUser: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null })
    try {
      const currentUser = await authService.getUser()
      set({ user: currentUser || null })
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
    } catch (err: any) {
      set({ user: null, error: err?.message || 'Failed to refresh user' })
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      await authService.signIn(email, password)
      const currentUser = await authService.getUser()
      set({ user: currentUser || null })
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
    } catch (err: any) {
      const errorMessage = err?.message || 'Sign up failed'
      set({ error: errorMessage })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null })
    try {
      await authService.signOut()
      set({ user: null })
    } catch (err: any) {
      set({ error: err?.message || 'Sign out failed' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  }
}))


