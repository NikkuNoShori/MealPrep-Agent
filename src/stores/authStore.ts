import { create } from 'zustand'
import { authService } from '@/services/supabase'
import { supabase } from '@/services/supabase'

export interface AuthUser {
  id: string
  email?: string
  [key: string]: any
}

export interface HouseholdMembership {
  householdId: string
  householdName: string
  role: 'owner' | 'admin' | 'member'
}

export type AppRole = 'admin' | 'user' | 'family_member'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  linkedAccounts: Array<{ provider: string; id: string; created_at: string }>
  household: HouseholdMembership | null
  appRole: AppRole | null
  isAdmin: boolean
  initialize: () => Promise<void>
  refreshUser: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  linkGoogleAccount: (redirectTo?: string) => Promise<void>
  unlinkGoogleAccount: () => Promise<void>
  loadLinkedAccounts: () => Promise<void>
  loadHousehold: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

// Track if initialization has been started
let initializationStarted = false

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,
  linkedAccounts: [],
  household: null,
  appRole: null,
  isAdmin: false,

  initialize: async () => {
    // Prevent multiple simultaneous initializations
    if (initializationStarted) {
      return // Already initializing
    }

    initializationStarted = true
    set({ isLoading: true, error: null })
    try {
      // Add timeout to prevent hanging
      const getUserPromise = authService.getUser()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth initialization timeout')), 5000)
      )

      const currentUser = await Promise.race([getUserPromise, timeoutPromise]) as any
      set({ user: currentUser || null })
      if (currentUser) {
        try {
          const accounts = await authService.getLinkedAccounts()
          set({ linkedAccounts: accounts })
        } catch (err) {
          // Don't fail initialization if linked accounts fail
          console.warn('Failed to load linked accounts:', err)
        }
        // Load household membership
        try {
          const { data: membership } = await (supabase
            .from("household_members") as any)
            .select("household_id, role, households(name)")
            .eq("user_id", currentUser.id)
            .limit(1)
            .maybeSingle()

          if (membership) {
            set({
              household: {
                householdId: membership.household_id,
                householdName: membership.households?.name || 'My Household',
                role: membership.role as 'owner' | 'admin' | 'member',
              }
            })
          }
        } catch (err) {
          // Don't fail initialization if household load fails (table may not exist yet)
          console.warn('Failed to load household:', err)
        }
        // Load app role (admin/user)
        try {
          const { data: userRole } = await (supabase
            .from("user_roles") as any)
            .select("roles(name)")
            .eq("user_id", currentUser.id)
            .limit(1)
            .maybeSingle()

          const roleName = userRole?.roles?.name as AppRole | undefined
          set({
            appRole: roleName || 'user',
            isAdmin: roleName === 'admin',
          })
        } catch (err) {
          console.warn('Failed to load app role:', err)
        }
      }
    } catch (err: any) {
      // Clear user and continue - don't block app loading
      console.warn('Auth initialization warning:', err?.message)
      set({ user: null, error: null }) // Don't set error on timeout - just continue unauthenticated
    } finally {
      set({ isLoading: false })
      initializationStarted = false // Reset flag when done
    }
  },

  refreshUser: async () => {
    try {
      const currentUser = await authService.getUser()
      set({ user: currentUser || null, isLoading: false })
      if (currentUser) {
        try {
          const accounts = await authService.getLinkedAccounts()
          set({ linkedAccounts: accounts })
        } catch (err) {
          // Ignore linked accounts errors
        }
        // Reload household membership (may have changed after invite accept)
        try {
          const { data: membership } = await (supabase
            .from("household_members") as any)
            .select("household_id, role, households(name)")
            .eq("user_id", currentUser.id)
            .limit(1)
            .maybeSingle()

          if (membership) {
            set({
              household: {
                householdId: membership.household_id,
                householdName: membership.households?.name || 'My Household',
                role: membership.role as 'owner' | 'admin' | 'member',
              }
            })
          } else {
            set({ household: null })
          }
        } catch (err) {
          console.warn('Failed to reload household:', err)
        }
        // Reload app role
        try {
          const { data: userRole } = await (supabase
            .from("user_roles") as any)
            .select("roles(name)")
            .eq("user_id", currentUser.id)
            .limit(1)
            .maybeSingle()

          const roleName = userRole?.roles?.name as AppRole | undefined
          set({
            appRole: roleName || 'user',
            isAdmin: roleName === 'admin',
          })
        } catch (err) {
          console.warn('Failed to reload app role:', err)
        }
      }
    } catch (err: any) {
      console.error('AuthStore: Refresh user error:', err)
      set({ user: null, error: err?.message || 'Failed to refresh user', isLoading: false })
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

  loadHousehold: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await (supabase
        .from("household_members") as any)
        .select("household_id, role, households(name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()

      if (membership) {
        set({
          household: {
            householdId: membership.household_id,
            householdName: membership.households?.name || 'My Household',
            role: membership.role as 'owner' | 'admin' | 'member',
          }
        })
      } else {
        set({ household: null })
      }
    } catch (err: any) {
      console.warn('Failed to load household:', err)
    }
  },

  requestPasswordReset: async (email: string) => {
    set({ isLoading: true, error: null })
    try {
      await authService.requestPasswordReset(email)
    } catch (err: any) {
      set({ error: err?.message || 'Failed to send password reset email' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null })
    try {
      await authService.signOut()
      set({ user: null, linkedAccounts: [], household: null, appRole: null, isAdmin: false })
    } catch (err: any) {
      set({ error: err?.message || 'Sign out failed' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  }
}))
