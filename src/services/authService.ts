import { stackClientApp, getStackClientApp } from '../stack/client';
import { Logger } from './logger';

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
   */
  async signUp(email: string, password: string) {
    if (!stackClientApp) {
      throw new Error(
        'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and ' +
        'VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file.'
      );
    }
    
    Logger.info('🟡 AuthService: Starting signUp', { email });
    
    try {
      const result = await stackClientApp.signUpWithCredential({ email, password });
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
        return retryUser;
      }
      
      Logger.info('✅ AuthService: SignUp successful', { userId: user.id });
      return user;
    } catch (error: any) {
      Logger.error('🔴 AuthService: SignUp error', error);
      throw error;
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
};

// Export Stack Auth client for direct access if needed
export { stackClientApp, getStackClientApp };

