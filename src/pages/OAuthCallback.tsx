import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { ToastService } from '@/services/toast';
import { Logger } from '@/services/logger';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function handleOAuthCallback() {
      try {
        Logger.info('🟡 OAuthCallback: Handling OAuth callback');

        // Get OAuth code and state from URL parameters
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          Logger.error('🔴 OAuthCallback: OAuth error from provider', { error });
          setError(`OAuth error: ${error}`);
          setStatus('error');
          ToastService.error(`OAuth error: ${error}`);
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        if (!code) {
          Logger.error('🔴 OAuthCallback: No OAuth code in callback');
          setError('No authorization code received from OAuth provider');
          setStatus('error');
          ToastService.error('OAuth callback failed: No authorization code');
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        // Stack Auth should handle the OAuth callback automatically via cookies
        // Wait a moment for Stack Auth to process the callback
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify user session was established
        const user = await authService.getUser();
        if (!user || !user.id) {
          Logger.warn('⚠️ OAuthCallback: User not found after OAuth, waiting...');
          // Wait a bit longer and retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryUser = await authService.getUser();
          if (!retryUser || !retryUser.id) {
            throw new Error('OAuth successful but session not established. Please try again.');
          }
          Logger.info('✅ OAuthCallback: User found after retry', { userId: retryUser.id });
          
          // Create profile if it doesn't exist
          try {
            await authService.createProfile(
              retryUser.id,
              retryUser.displayName?.split(' ')[0] || '',
              retryUser.displayName?.split(' ').slice(1).join(' ') || '',
              retryUser.email || ''
            );
          } catch (profileError: any) {
            Logger.warn('⚠️ OAuthCallback: Profile creation failed (may already exist)', { error: profileError.message });
          }

          setStatus('success');
          ToastService.success('Signed in with Google successfully');
          setTimeout(() => navigate('/dashboard', { replace: true }), 1000);
          return;
        }

        Logger.info('✅ OAuthCallback: OAuth successful', { userId: user.id });

        // Create profile if it doesn't exist
        try {
          await authService.createProfile(
            user.id,
            user.displayName?.split(' ')[0] || '',
            user.displayName?.split(' ').slice(1).join(' ') || '',
            user.email || ''
          );
        } catch (profileError: any) {
          Logger.warn('⚠️ OAuthCallback: Profile creation failed (may already exist)', { error: profileError.message });
        }

        setStatus('success');
        ToastService.success('Signed in with Google successfully');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1000);

      } catch (error: any) {
        Logger.error('🔴 OAuthCallback: OAuth callback error', error);
        const errorMessage = error?.message || 'OAuth callback failed';
        setError(errorMessage);
        setStatus('error');
        ToastService.error(errorMessage);
        setTimeout(() => navigate('/signin'), 3000);
      }
    }

    handleOAuthCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Completing sign in with Google...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-8 h-8 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-muted-foreground">Sign in successful! Redirecting...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="w-8 h-8 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-600">{error || 'OAuth callback failed'}</p>
              <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

