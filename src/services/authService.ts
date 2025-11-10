import { stackClientApp, getStackClientApp } from '../stack/client';
import { Logger } from './logger';
import { apiClient } from './api';

/**
 * Authentication Service
 * Handles all authentication operations using Stack Auth
 */
export const authService = {
  /**
   * Get current authenticated user
   */
  async getUser() {
    if (!stackClientApp) {
      Logger.warn('⚠️ AuthService: Stack Auth not configured, returning null user');
      return null;
    }
    
    try {
      Logger.debug('🟡 AuthService: Getting user from Stack Auth cookies...');
      
      // Stack Auth with tokenStore: "cookie" automatically reads from cookies
      // No localStorage is used - Stack Auth handles cookie persistence
      const user = await stackClientApp.getUser();
      
      Logger.debug('🟡 AuthService: User result from cookies', { 
        hasUser: !!user,
        userId: user?.id,
        source: 'Stack Auth cookies (tokenStore: cookie)'
      });
      
      return user;
    } catch (error: any) {
      Logger.error('🔴 AuthService: Error getting user', error);
      return null;
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
    if (!stackClientApp) {
      throw new Error(
        'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and ' +
        'VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file.'
      );
    }
    
    Logger.info('🟡 AuthService: Starting signUp', { email, firstName, lastName });
    
    try {
      // Stack Auth redirects to /handler/email-verification by default
      // We'll handle both /handler/email-verification and /verify-email routes
      // For development: localhost:5173, for production: use actual domain
      const verificationCallbackUrl = `${window.location.origin}/handler/email-verification`;
      
      // Use Stack Auth's signUpWithCredential with verification callback URL
      // Method signature: signUpWithCredential({ email, password, verification_callback_url?: string })
      const result = await (stackClientApp as any).signUpWithCredential({ 
        email, 
        password,
        verification_callback_url: verificationCallbackUrl
      });
      Logger.debug('🟡 AuthService: signUpWithCredential result', { 
        hasResult: !!result,
        status: (result as any)?.status 
      });
      
      // Check if signUp failed (Stack Auth returns {status: 'error', error: ...})
      if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
        const errorMessage = (result as any).error?.message || 
                            (result as any).error?.toString() || 
                            'Sign up failed';
        Logger.error('🔴 AuthService: SignUp failed', { error: errorMessage });
        throw new Error(errorMessage);
      }
      
      // Wait a moment for Stack Auth to process the session
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify user was created by fetching it
      const user = await this.getUser();
      if (!user) {
        Logger.warn('⚠️ AuthService: User not found immediately after signup, waiting...');
        // Wait a bit longer and retry
        await new Promise(resolve => setTimeout(resolve, 300));
        const retryUser = await this.getUser();
        if (!retryUser) {
          throw new Error('User account created but session not established. Please try signing in.');
        }
        Logger.info('✅ AuthService: User found after retry', { userId: retryUser.id });
        
        // Create profile in database
        // Profile creation failure shouldn't block signup - user can create profile later
        try {
          await this.createProfile(retryUser.id, firstName, lastName, email);
          Logger.info('✅ AuthService: Profile created successfully after retry', { userId: retryUser.id });
        } catch (profileError: any) {
          // Log error but don't throw - signup succeeded, profile can be created later
          Logger.warn('⚠️ AuthService: Profile creation failed after retry, but signup succeeded', { 
            userId: retryUser.id, 
            error: profileError?.message || 'Unknown error' 
          });
        }
        return retryUser;
      }
      
      // Create profile in database after successful Stack Auth signup
      // Profile creation failure shouldn't block signup - user can create profile later
      try {
        await this.createProfile(user.id, firstName, lastName, email);
        Logger.info('✅ AuthService: Profile created successfully', { userId: user.id });
      } catch (profileError: any) {
        // Log error but don't throw - signup succeeded, profile can be created later
        Logger.warn('⚠️ AuthService: Profile creation failed, but signup succeeded', { 
          userId: user.id, 
          error: profileError?.message || 'Unknown error' 
        });
        // User can manually create profile later or it will be created on first profile fetch
      }
      
      Logger.info('✅ AuthService: SignUp successful', { userId: user.id });
      return user;
    } catch (error: any) {
      Logger.error('🔴 AuthService: SignUp error', error);
      throw error;
    }
  },

  /**
   * Create user profile in database
   * @param userId Stack Auth user ID
   * @param firstName User's first name
   * @param lastName User's last name
   * @param email User's email address
   */
  async createProfile(userId: string, firstName: string, lastName: string, email: string) {
    try {
      Logger.info('🟡 AuthService: Creating profile in database', { userId, firstName, lastName, email });
      
      // Create profile in database via API client (uses correct backend URL)
      await apiClient.createProfile({
        userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      
      Logger.info('✅ AuthService: Profile created successfully', { userId });
    } catch (error: any) {
      // If profile already exists, that's okay (idempotent)
      if (error?.status === 409 || error?.message?.includes('already exists')) {
        Logger.info('✅ AuthService: Profile already exists', { userId });
        return;
      }
      Logger.error('🔴 AuthService: Failed to create profile', error);
      // Don't throw - profile creation failure shouldn't block signup
      // The profile can be created later or manually
    }
  },

  /**
   * Sign in existing user
   */
  async signIn(email: string, password: string) {
    if (!stackClientApp) {
      throw new Error(
        'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and ' +
        'VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file.'
      );
    }
    
    Logger.info('🟡 AuthService: Starting signIn', { email });
    
    try {
      const result = await stackClientApp.signInWithCredential({ email, password });
      Logger.debug('🟡 AuthService: signInWithCredential result', { 
        hasResult: !!result,
        status: (result as any)?.status 
      });
      
      // Check if signIn failed (Stack Auth returns {status: 'error', error: ...})
      if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
        const errorMessage = (result as any).error?.message || 
                            (result as any).error?.toString() || 
                            'Sign in failed';
        Logger.error('🔴 AuthService: SignIn failed', { error: errorMessage });
        throw new Error(errorMessage);
      }
      
      // Wait a moment for Stack Auth to process the session cookie
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify user session was established
      const user = await this.getUser();
      if (!user) {
        Logger.warn('⚠️ AuthService: User not found immediately after signin, waiting...');
        // Wait a bit longer and retry
        await new Promise(resolve => setTimeout(resolve, 300));
        const retryUser = await this.getUser();
        if (!retryUser) {
          throw new Error('Sign in successful but session not established. Please try again.');
        }
        Logger.info('✅ AuthService: User found after retry', { userId: retryUser.id });
        return retryUser;
      }
      
      Logger.info('✅ AuthService: SignIn successful', { userId: user.id });
      
      // Note: Profile check removed from login to avoid duplicate API calls
      // Profile will be auto-created when user accesses their profile (GET /api/profile)
      // This avoids timing issues with cookies and reduces unnecessary API calls
      
      return user;
    } catch (error: any) {
      Logger.error('🔴 AuthService: SignIn error', error);
      throw error;
    }
  },

  /**
   * Sign out current user
   */
  async signOut() {
    if (!stackClientApp) {
      Logger.warn('⚠️ AuthService: Stack Auth not configured, cannot sign out');
      return { success: true };
    }
    
    Logger.info('🟡 AuthService: Sign out requested');
    
    try {
      // Check if Stack Auth has a signOut method
      const client = stackClientApp as any;
      
      if (typeof client.signOut === 'function') {
        Logger.debug('🟡 AuthService: Using Stack Auth signOut method');
        await client.signOut();
        Logger.info('✅ AuthService: Sign out successful');
        return { success: true };
      }
      
      // If no signOut method, try to clear the session by clearing cookies
      // Stack Auth stores tokens in cookies, so we need to clear them
      Logger.warn('⚠️ AuthService: signOut method not found, attempting to clear session');
      
      // Clear all cookies related to Stack Auth
      document.cookie.split(';').forEach(cookie => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        // Clear Stack Auth related cookies
        if (name.includes('stack') || name.includes('auth')) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        }
      });
      
      Logger.info('✅ AuthService: Session cleared');
      return { success: true };
    } catch (error: any) {
      Logger.error('🔴 AuthService: SignOut error', error);
      // Even if signOut fails, we should clear local state
      return { success: true };
    }
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    if (!stackClientApp) {
      return false;
    }
    
    try {
      const user = await this.getUser();
      return !!user;
    } catch {
      return false;
    }
  },

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string) {
    if (!stackClientApp) {
      throw new Error(
        'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and ' +
        'VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file.'
      );
    }
    
    Logger.info('🟡 AuthService: Requesting password reset', { email });
    
    try {
      // Stack Auth redirects to /handler/password-reset by default
      // We'll handle both /handler/password-reset and /reset-password routes
      const redirectTo = `${window.location.origin}/handler/password-reset`;
      
      // Use Stack Auth's sendForgotPasswordEmail method
      // Method signature: sendForgotPasswordEmail(email: string, options?: { redirectTo?: string })
      const result = await (stackClientApp as any).sendForgotPasswordEmail(email, {
        redirectTo
      });
      
      // Check if result indicates an error
      if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
        const errorMessage = (result as any).error?.message || 
                            (result as any).error?.toString() || 
                            'Failed to send password reset email';
        Logger.error('🔴 AuthService: Password reset request failed', { error: errorMessage });
        throw new Error(errorMessage);
      }
      
      Logger.info('✅ AuthService: Password reset email sent successfully');
      return result;
      
    } catch (error: any) {
      Logger.error('🔴 AuthService: Password reset error', error);
      
      // If error is already an Error object with a message, throw it as-is
      if (error instanceof Error) {
        throw error;
      }
      
      // Otherwise, create a new error with the error message
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      throw new Error(
        `Failed to send password reset email: ${errorMessage}. ` +
        `Please check your email address and try again.`
      );
    }
  },

  /**
   * Verify email with verification code
   * @param code Verification code from email link
   * @returns Promise with verification result
   */
  async verifyEmail(code: string) {
    if (!stackClientApp) {
      throw new Error(
        'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and ' +
        'VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file.'
      );
    }
    
    Logger.info('🟡 AuthService: Verifying email with code', { code: code.substring(0, 10) + '...' });
    
    try {
      // Stack Auth's verifyEmail method
      // Method signature: verifyEmail(code: string) or verifyContactChannel(code: string)
      const client = stackClientApp as any;
      
      Logger.debug('🔍 AuthService: Checking available verification methods', {
        hasVerifyEmail: typeof client.verifyEmail === 'function',
        hasVerifyContactChannel: typeof client.verifyContactChannel === 'function',
        hasVerify: typeof client.verify === 'function',
        clientMethods: Object.keys(client).filter(key => key.toLowerCase().includes('verify'))
      });
      
      let result = null;
      
      // Try different Stack Auth API methods for email verification
      if (typeof client.verifyEmail === 'function') {
        Logger.debug('🔍 AuthService: Using verifyEmail method');
        result = await client.verifyEmail(code);
      } else if (typeof client.verifyContactChannel === 'function') {
        Logger.debug('🔍 AuthService: Using verifyContactChannel method');
        result = await client.verifyContactChannel(code);
      } else if (typeof client.verify === 'function') {
        Logger.debug('🔍 AuthService: Using verify method');
        result = await client.verify(code);
      } else {
        // Fallback: Make direct API call to Stack Auth's verify endpoint
        Logger.debug('🔍 AuthService: No client method found, using REST API fallback');
        const projectId = (import.meta as any).env?.VITE_STACK_PROJECT_ID;
        const response = await fetch('https://api.stack-auth.com/api/v1/contact-channels/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            projectId,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          Logger.error('🔴 AuthService: REST API verification failed', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          throw new Error(errorData.error?.message || `Email verification failed: ${response.status} ${response.statusText}`);
        }
        
        result = await response.json();
      }
      
      // Check if result indicates an error
      if (result && typeof result === 'object') {
        // Check for error status
        if ('status' in result && result.status === 'error') {
          const errorMessage = (result as any).error?.message || 
                              (result as any).error?.toString() || 
                              'Email verification failed';
          Logger.error('🔴 AuthService: Email verification failed', { 
            error: errorMessage,
            result: result
          });
          throw new Error(errorMessage);
        }
        
        // Check for error property
        if ('error' in result && result.error) {
          const errorMessage = (result as any).error?.message || 
                              (result as any).error?.toString() || 
                              String(result.error);
          Logger.error('🔴 AuthService: Email verification failed', { 
            error: errorMessage,
            result: result
          });
          throw new Error(errorMessage);
        }
      }
      
      Logger.info('✅ AuthService: Email verified successfully', { result });
      return { success: true, result };
      
    } catch (error: any) {
      // Log full error details for debugging
      Logger.error('🔴 AuthService: Email verification error', {
        error: error,
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorName: error?.name,
        errorType: typeof error,
        errorString: String(error),
        errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      
      // If error is already an Error object with a message, throw it as-is
      if (error instanceof Error) {
        throw error;
      }
      
      // Otherwise, create a new error with the error message
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      throw new Error(
        `Failed to verify email: ${errorMessage}. ` +
        `The verification link may have expired. Please request a new verification email.`
      );
    }
  },

  /**
   * Update user profile (first name and last name)
   * @param profile Profile data with firstName and lastName
   * @returns Promise with updated user
   */
  async updateProfile(profile: { firstName: string; lastName?: string }) {
    if (!stackClientApp) {
      throw new Error(
        'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and ' +
        'VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file.'
      );
    }
    
    Logger.info('🟡 AuthService: Updating profile', { firstName: profile.firstName, lastName: profile.lastName });
    
    try {
      const client = stackClientApp as any;
      
      // Try different Stack Auth API methods for updating profile
      let result = null;
      
      if (typeof client.updateProfile === 'function') {
        result = await client.updateProfile({ 
          firstName: profile.firstName, 
          lastName: profile.lastName || '' 
        });
      } else if (typeof client.updateUser === 'function') {
        result = await client.updateUser({ 
          firstName: profile.firstName, 
          lastName: profile.lastName || '' 
        });
      } else {
        // Fallback: Make direct API call to update profile in our database
        const projectId = (import.meta as any).env?.VITE_STACK_PROJECT_ID;
        const user = await this.getUser();
        if (!user || !user.id) {
          throw new Error('User not found');
        }
        
        const response = await fetch('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: profile.firstName,
            lastName: profile.lastName || '',
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to update profile');
        }
        
        result = await response.json();
      }
      
      // Check if result indicates an error
      if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
        const errorMessage = (result as any).error?.message || 
                            (result as any).error?.toString() || 
                            'Failed to update profile';
        Logger.error('🔴 AuthService: Update profile failed', { error: errorMessage });
        throw new Error(errorMessage);
      }
      
      // Refresh user to get updated data
      const updatedUser = await this.getUser();
      Logger.info('✅ AuthService: Profile updated successfully');
      return updatedUser;
      
    } catch (error: any) {
      Logger.error('🔴 AuthService: Update profile error', error);
      throw error instanceof Error ? error : new Error('Failed to update profile');
    }
  },

  /**
   * Change user password
   * @param currentPassword Current password
   * @param newPassword New password
   * @returns Promise with success result
   */
  async changePassword(currentPassword: string, newPassword: string) {
    if (!stackClientApp) {
      throw new Error(
        'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and ' +
        'VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file.'
      );
    }
    
    Logger.info('🟡 AuthService: Changing password');
    
    try {
      const client = stackClientApp as any;
      
      // Try different Stack Auth API methods for changing password
      let result = null;
      
      if (typeof client.changePassword === 'function') {
        result = await client.changePassword(currentPassword, newPassword);
      } else if (typeof client.updatePassword === 'function') {
        result = await client.updatePassword({ currentPassword, newPassword });
      } else if (typeof client.updatePassword === 'function' && typeof client.verifyPassword === 'function') {
        // Two-step: verify current password, then update
        const verifyResult = await client.verifyPassword(currentPassword);
        if (!verifyResult || (verifyResult as any).status === 'error') {
          throw new Error('Current password is incorrect');
        }
        result = await client.updatePassword(newPassword);
      } else {
        throw new Error('Stack Auth does not support changing password');
      }
      
      // Check if result indicates an error
      if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
        const errorMessage = (result as any).error?.message || 
                            (result as any).error?.toString() || 
                            'Failed to change password';
        Logger.error('🔴 AuthService: Change password failed', { error: errorMessage });
        throw new Error(errorMessage);
      }
      
      Logger.info('✅ AuthService: Password changed successfully');
      return { success: true };
      
    } catch (error: any) {
      Logger.error('🔴 AuthService: Change password error', error);
      throw error instanceof Error ? error : new Error('Failed to change password');
    }
  },

  /**
   * Resend email verification
   * @returns Promise with success result
   */
  async resendVerificationEmail() {
    if (!stackClientApp) {
      throw new Error(
        'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and ' +
        'VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file.'
      );
    }
    
    Logger.info('🟡 AuthService: Resending verification email');
    
    try {
      const client = stackClientApp as any;
      const verificationCallbackUrl = `${window.location.origin}/verify-email`;
      
      // Log available methods for debugging
      const availableMethods = Object.keys(client).filter(key => 
        key.toLowerCase().includes('verif') || 
        key.toLowerCase().includes('email') ||
        key.toLowerCase().includes('resend') ||
        key.toLowerCase().includes('send')
      );
      const allMethods = Object.keys(client);
      Logger.debug('🔍 AuthService: Available verification methods', {
        availableMethods,
        allMethods: allMethods.slice(0, 30), // First 30 methods
        totalMethods: allMethods.length
      });
      
      // Get user email first (needed for some methods)
      const user = await this.getUser();
      let userEmail = user?.email;
      
      // If user object doesn't have email, try to get it from profile
      if (!userEmail) {
        try {
          const profile = await apiClient.getProfile();
          userEmail = profile?.profile?.email;
          Logger.debug('🔍 AuthService: Got email from profile', { email: userEmail });
        } catch (profileError) {
          Logger.warn('⚠️ AuthService: Could not get email from profile', { error: profileError });
        }
      }
      
      if (!userEmail) {
        Logger.error('🔴 AuthService: User email not found', { 
          hasUser: !!user,
          userKeys: user ? Object.keys(user) : [],
          userEmail: user?.email
        });
        throw new Error('User email not found. Please ensure your profile has an email address.');
      }
      
      // Try different Stack Auth API methods for resending verification email
      let result = null;
      
      // Try methods that take email as parameter (like sendForgotPasswordEmail)
      if (typeof client.sendVerificationEmail === 'function') {
        Logger.debug('🔍 AuthService: Trying sendVerificationEmail method');
        try {
          // Try with email as first parameter (like sendForgotPasswordEmail)
          result = await client.sendVerificationEmail(userEmail, { redirectTo: verificationCallbackUrl });
          Logger.debug('✅ AuthService: sendVerificationEmail with email succeeded');
        } catch (e: any) {
          Logger.debug('🔍 AuthService: sendVerificationEmail with email failed, trying without email', { error: e?.message });
          try {
            // Try without email (method might get email from current user)
            result = await client.sendVerificationEmail({ redirectTo: verificationCallbackUrl });
            Logger.debug('✅ AuthService: sendVerificationEmail without email succeeded');
          } catch (e2: any) {
            Logger.debug('❌ AuthService: sendVerificationEmail without email also failed', { error: e2?.message });
          }
        }
      } else if (typeof client.resendVerificationEmail === 'function') {
        Logger.debug('🔍 AuthService: Using resendVerificationEmail method');
        result = await client.resendVerificationEmail({ redirectTo: verificationCallbackUrl });
      } else if (typeof client.resendEmailVerification === 'function') {
        Logger.debug('🔍 AuthService: Using resendEmailVerification method');
        result = await client.resendEmailVerification({ redirectTo: verificationCallbackUrl });
      } else if (typeof client.sendEmailVerification === 'function') {
        Logger.debug('🔍 AuthService: Using sendEmailVerification method');
        result = await client.sendEmailVerification({ redirectTo: verificationCallbackUrl });
      } else {
        // No SDK method found - try using Stack Auth REST API directly
        Logger.debug('🔍 AuthService: No SDK method found, trying REST API');
        try {
          const projectId = (import.meta as any).env?.VITE_STACK_PROJECT_ID;
          if (!projectId) {
            throw new Error('VITE_STACK_PROJECT_ID is not configured');
          }
          
          // Get access token from Stack Auth client or cookies
          let accessToken = null;
          
          // Try to get token from Stack Auth client first
          try {
            const client = stackClientApp as any;
            if (typeof client.getAccessToken === 'function') {
              accessToken = await client.getAccessToken();
              Logger.debug('🔍 AuthService: Got access token from client.getAccessToken()');
            } else if (client._tokenStore && typeof client._tokenStore.getAccessToken === 'function') {
              accessToken = await client._tokenStore.getAccessToken();
              Logger.debug('🔍 AuthService: Got access token from client._tokenStore.getAccessToken()');
            } else if (client.tokenStore && typeof client.tokenStore.getAccessToken === 'function') {
              accessToken = await client.tokenStore.getAccessToken();
              Logger.debug('🔍 AuthService: Got access token from client.tokenStore.getAccessToken()');
            }
          } catch (tokenError) {
            Logger.debug('🔍 AuthService: Could not get token from client methods', { error: tokenError });
          }
          
          // Fallback: Try to get token from cookies
          if (!accessToken) {
            Logger.debug('🔍 AuthService: Trying to get access token from cookies');
            const cookies = document.cookie.split(';');
            
            // Try different possible cookie names
            const possibleCookieNames = [
              `stack-access-${projectId}`,
              'stack-access',
              `stack-access-token-${projectId}`,
              'stack-access-token'
            ];
            
            for (const cookieName of possibleCookieNames) {
              for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === cookieName || name.startsWith('stack-access')) {
                  try {
                    // Cookie might be a JSON array ["refresh_token", "access_token"]
                    const parsed = JSON.parse(decodeURIComponent(value));
                    accessToken = Array.isArray(parsed) ? parsed[1] : parsed;
                    Logger.debug('🔍 AuthService: Found access token in cookie', { cookieName: name });
                    break;
                  } catch {
                    // If not JSON, use the value directly
                    accessToken = decodeURIComponent(value);
                    Logger.debug('🔍 AuthService: Found access token in cookie (raw)', { cookieName: name });
                    break;
                  }
                }
                if (accessToken) break;
              }
              if (accessToken) break;
            }
          }
          
          if (!accessToken) {
            Logger.debug('🔍 AuthService: Available cookies', { 
              cookies: document.cookie.split(';').map(c => c.trim().split('=')[0])
            });
            throw new Error('No access token found in cookies or client methods');
          }
          
          // Try Stack Auth REST API endpoints for resending verification email
          // Try multiple possible endpoint patterns
          const possibleEndpoints = [
            `https://api.stack-auth.com/api/v1/users/me/contact-channels/send-verification`,
            `https://api.stack-auth.com/api/v1/users/me/send-verification-email`,
            `https://api.stack-auth.com/api/v1/contact-channels/resend-verification`,
            `https://api.stack-auth.com/api/v1/contact-channels/send-verification`,
            `https://api.stack-auth.com/api/v1/users/${user?.id}/send-verification-email`
          ];
          
          let lastError = null;
          for (const apiUrl of possibleEndpoints) {
            try {
              Logger.debug('🔍 AuthService: Trying REST API endpoint', { apiUrl, email: userEmail });
              
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                  'X-Stack-Project-Id': projectId
                },
                body: JSON.stringify({
                  email: userEmail,
                  redirectTo: verificationCallbackUrl
                })
              });
              
              if (response.ok) {
                const apiResult = await response.json();
                Logger.info('✅ AuthService: Verification email sent via REST API', { apiUrl, result: apiResult });
                result = apiResult;
                break; // Success, exit loop
              } else {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                lastError = new Error(errorData.message || `API request failed with status ${response.status}`);
                Logger.debug('🔍 AuthService: Endpoint failed', { apiUrl, status: response.status, error: lastError.message });
                // Continue to next endpoint
              }
            } catch (fetchError: any) {
              lastError = fetchError;
              Logger.debug('🔍 AuthService: Endpoint error', { apiUrl, error: fetchError.message });
              // Continue to next endpoint
            }
          }
          
          if (!result && lastError) {
            throw lastError;
          }
        } catch (apiError: any) {
          Logger.warn('⚠️ AuthService: REST API fallback failed', { error: apiError?.message });
          // If REST API also fails, show helpful error message
          const allMethods = Object.keys(client);
          Logger.error('🔴 AuthService: No method found for resending verification email', {
            sdkMethods: availableMethods.length,
            totalMethods: allMethods.length,
            restApiError: apiError?.message,
            note: 'Stack Auth does not provide a public API for resending verification emails'
          });
          
          throw new Error(
            'Resending verification emails is not available via the Stack Auth API. ' +
            'Please use the Stack Auth dashboard to resend verification emails, or contact support if you need this feature.'
          );
        }
      }
      
      // Check if we actually got a result
      if (!result) {
        Logger.error('🔴 AuthService: No result from verification email methods');
        throw new Error(
          'Failed to resend verification email. Please use the Stack Auth dashboard to resend verification emails manually.'
        );
      }
      
      // Check if result indicates an error
      if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
        const errorMessage = (result as any).error?.message || 
                            (result as any).error?.toString() || 
                            'Failed to resend verification email';
        Logger.error('🔴 AuthService: Resend verification email failed', { error: errorMessage });
        throw new Error(errorMessage);
      }
      
      Logger.info('✅ AuthService: Verification email sent successfully', { result });
      return { success: true };
      
    } catch (error: any) {
      Logger.error('🔴 AuthService: Resend verification email error', error);
      throw error instanceof Error ? error : new Error('Failed to resend verification email');
    }
  },

  /**
   * Sign in with Google OAuth
   * @returns Promise that resolves when OAuth flow is initiated
   */
  async signInWithGoogle() {
    if (!stackClientApp) {
      throw new Error(
        'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and ' +
        'VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file.'
      );
    }

    Logger.info('🟡 AuthService: Starting Google OAuth sign in');

    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      
      // Stack Auth OAuth methods
      const client = stackClientApp as any;
      
      // Try different possible OAuth method names
      if (typeof client.signInWithOAuth === 'function') {
        Logger.debug('🔍 AuthService: Using signInWithOAuth method');
        await client.signInWithOAuth({
          provider: 'google',
          redirectUrl: redirectUrl
        });
      } else if (typeof client.signInWithGoogle === 'function') {
        Logger.debug('🔍 AuthService: Using signInWithGoogle method');
        await client.signInWithGoogle({ redirectUrl });
      } else if (typeof client.oauthSignIn === 'function') {
        Logger.debug('🔍 AuthService: Using oauthSignIn method');
        await client.oauthSignIn('google', { redirectUrl });
      } else {
        // Fallback: Try to construct OAuth URL manually
        const projectId = (import.meta as any).env?.VITE_STACK_PROJECT_ID;
        if (!projectId) {
          throw new Error('VITE_STACK_PROJECT_ID is not configured');
        }
        
        const oauthUrl = `https://api.stack-auth.com/api/v1/oauth/google/authorize?project_id=${projectId}&redirect_url=${encodeURIComponent(redirectUrl)}`;
        Logger.debug('🔍 AuthService: Redirecting to OAuth URL', { oauthUrl });
        window.location.href = oauthUrl;
        return;
      }

      Logger.info('✅ AuthService: Google OAuth flow initiated');
    } catch (error: any) {
      Logger.error('🔴 AuthService: Google OAuth error', error);
      throw error instanceof Error ? error : new Error('Failed to initiate Google OAuth');
    }
  },
};

// Export Stack Auth client for direct access if needed
export { stackClientApp, getStackClientApp };

