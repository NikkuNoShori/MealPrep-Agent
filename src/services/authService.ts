import { supabase } from '../lib/supabase'
import { Logger } from './logger'
import { apiClient } from './api'

/**
 * Authentication Service
 * Handles all authentication operations using Supabase Auth
 */
export const authService = {
  /**
   * Get current authenticated user
   */
  async getUser() {
    try {
      Logger.debug('🟡 AuthService: Getting user from Supabase...')
      
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        Logger.debug('🟡 AuthService: No user found', { error: error.message })
        return null
      }
      
      Logger.debug('🟡 AuthService: User result', { 
        hasUser: !!user,
        userId: user?.id,
        source: 'Supabase Auth'
      })
      
      // Transform Supabase user to match expected format
      if (user) {
        return {
          ...user,
          email: user.email,
          emailVerified: user.email_confirmed_at ? true : false,
        }
      }
      
      return null
    } catch (error: any) {
      Logger.error('🔴 AuthService: Error getting user', error)
      return null
    }
  },

  /**
   * Sign up new user
   * @param firstName User's first name (required)
   * @param lastName User's last name (required)
   * @param email User's email address (required)
   * @param password User's password (required)
   * @returns Promise with authenticated user
   */
  async signUp(firstName: string, lastName: string, email: string, password: string) {
    Logger.info('🟡 AuthService: Starting signUp', { email, firstName, lastName })
    
    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      })
      
      if (error) {
        Logger.error('🔴 AuthService: SignUp failed', { error: error.message })
        throw new Error(error.message)
      }
      
      if (!data.user) {
        throw new Error('User account created but user data not returned')
      }
      
      Logger.info('✅ AuthService: SignUp successful', { userId: data.user.id })
      
      // Profile is automatically created by database trigger when user is created in auth.users
      // No need to manually create profile - trigger handles it
      // The trigger extracts first_name and last_name from user_metadata
      
      // Transform Supabase user to match expected format
      return {
        ...data.user,
        email: data.user.email,
        emailVerified: data.user.email_confirmed_at ? true : false,
      }
    } catch (error: any) {
      Logger.error('🔴 AuthService: SignUp error', error)
      throw error instanceof Error ? error : new Error('Sign up failed')
    }
  },

  /**
   * Create user profile in database
   * @param userId Supabase user ID
   * @param firstName User's first name
   * @param lastName User's last name
   * @param email User's email address
   */
  // Profile creation is handled automatically by database trigger
  // No need for manual profile creation - trigger handles it when user is created in auth.users

  /**
   * Sign in existing user
   */
  async signIn(email: string, password: string) {
    Logger.info('🟡 AuthService: Starting signIn', { email })
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        Logger.error('🔴 AuthService: SignIn failed', { error: error.message })
        throw new Error(error.message)
      }
      
      if (!data.user) {
        throw new Error('Sign in successful but user data not returned')
      }
      
      Logger.info('✅ AuthService: SignIn successful', { userId: data.user.id })
      
      // Transform Supabase user to match expected format
      return {
        ...data.user,
        email: data.user.email,
        emailVerified: data.user.email_confirmed_at ? true : false,
      }
    } catch (error: any) {
      Logger.error('🔴 AuthService: SignIn error', error)
      throw error instanceof Error ? error : new Error('Sign in failed')
    }
  },

  /**
   * Sign out current user
   */
  async signOut() {
    Logger.info('🟡 AuthService: Sign out requested')
    
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        Logger.error('🔴 AuthService: SignOut error', error)
        // Even if signOut fails, we should clear local state
        return { success: true }
      }
      
      Logger.info('✅ AuthService: Sign out successful')
      return { success: true }
    } catch (error: any) {
      Logger.error('🔴 AuthService: SignOut error', error)
      // Even if signOut fails, we should clear local state
      return { success: true }
    }
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    try {
      const user = await this.getUser()
      return !!user
    } catch {
      return false
    }
  },

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string) {
    Logger.info('🟡 AuthService: Requesting password reset', { email })
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) {
        Logger.error('🔴 AuthService: Password reset request failed', { error: error.message })
        throw new Error(error.message)
      }
      
      Logger.info('✅ AuthService: Password reset email sent successfully')
      return { success: true }
    } catch (error: any) {
      Logger.error('🔴 AuthService: Password reset error', error)
      throw error instanceof Error ? error : new Error('Failed to send password reset email')
    }
  },

  /**
   * Verify email with verification code
   * @param code Verification code from email link
   * @returns Promise with verification result
   */
  async verifyEmail(code: string, email?: string) {
    Logger.info('🟡 AuthService: Verifying email with code', { code: code.substring(0, 10) + '...' })
    
    try {
      // Get user email if not provided
      let userEmail = email
      if (!userEmail) {
        const { data: { user } } = await supabase.auth.getUser()
        userEmail = user?.email
      }
      
      if (!userEmail) {
        throw new Error('Email is required for verification')
      }
      
      const { data, error } = await supabase.auth.verifyOtp({
        token: code,
        type: 'email',
        email: userEmail,
      })
      
      if (error) {
        Logger.error('🔴 AuthService: Email verification failed', { error: error.message })
        throw new Error(error.message)
      }
      
      Logger.info('✅ AuthService: Email verified successfully')
      return { success: true, user: data.user }
    } catch (error: any) {
      Logger.error('🔴 AuthService: Email verification error', error)
      throw error instanceof Error ? error : new Error('Failed to verify email')
    }
  },

  /**
   * Update user profile (first name and last name)
   * @param profile Profile data with firstName and lastName
   * @returns Promise with updated user
   */
  async updateProfile(profile: { firstName: string; lastName?: string }) {
    Logger.info('🟡 AuthService: Updating profile', { firstName: profile.firstName, lastName: profile.lastName })
    
    try {
      // Update profile in database via API
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName || '',
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || 'Failed to update profile')
      }
      
      // Refresh user to get updated data
      const updatedUser = await this.getUser()
      Logger.info('✅ AuthService: Profile updated successfully')
      return updatedUser
    } catch (error: any) {
      Logger.error('🔴 AuthService: Update profile error', error)
      throw error instanceof Error ? error : new Error('Failed to update profile')
    }
  },

  /**
   * Change user password
   * @param currentPassword Current password
   * @param newPassword New password
   * @returns Promise with success result
   */
  async changePassword(currentPassword: string, newPassword: string) {
    Logger.info('🟡 AuthService: Changing password')
    
    try {
      // Get current user to verify current password
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.email) {
        throw new Error('User not found')
      }
      
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      
      if (signInError) {
        throw new Error('Current password is incorrect')
      }
      
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      
      if (updateError) {
        throw new Error(updateError.message)
      }
      
      Logger.info('✅ AuthService: Password changed successfully')
      return { success: true }
    } catch (error: any) {
      Logger.error('🔴 AuthService: Change password error', error)
      throw error instanceof Error ? error : new Error('Failed to change password')
    }
  },

  /**
   * Resend email verification
   * @returns Promise with success result
   */
  async resendVerificationEmail() {
    Logger.info('🟡 AuthService: Resending verification email')
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user || !user.email) {
        throw new Error('User not found. Please sign in first.')
      }
      
      // Supabase doesn't have a direct resend verification method
      // We need to use the signUp method again with the same email
      // This will send a new verification email
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      })
      
      if (error) {
        Logger.error('🔴 AuthService: Resend verification email failed', { error: error.message })
        throw new Error(error.message)
      }
      
      Logger.info('✅ AuthService: Verification email sent successfully')
      return { success: true }
    } catch (error: any) {
      Logger.error('🔴 AuthService: Resend verification email error', error)
      throw error instanceof Error ? error : new Error('Failed to resend verification email')
    }
  },

  /**
   * Sign in with Google OAuth
   * @returns Promise that resolves when OAuth flow is initiated
   */
  async signInWithGoogle() {
    Logger.info('🟡 AuthService: Starting Google OAuth sign in')

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) {
        Logger.error('🔴 AuthService: Google OAuth error', error)
        throw new Error(error.message)
      }
      
      // Supabase OAuth redirects automatically, so we don't need to do anything else
      if (data.url) {
        window.location.href = data.url
      }
      
      Logger.info('✅ AuthService: Google OAuth flow initiated')
    } catch (error: any) {
      Logger.error('🔴 AuthService: Google OAuth error', error)
      throw error instanceof Error ? error : new Error('Failed to initiate Google OAuth')
    }
  },
}
