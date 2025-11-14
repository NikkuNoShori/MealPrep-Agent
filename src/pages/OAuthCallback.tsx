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

        // Supabase OAuth uses hash fragments (#access_token=...) not query parameters
        // The Supabase client automatically processes hash fragments when detectSessionInUrl is enabled
        const { supabase } = await import('@/lib/supabase');
        
        // Check for error in hash fragments
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const error = hashParams.get('error') || searchParams.get('error');
        
        if (error) {
          Logger.error('🔴 OAuthCallback: OAuth error from provider', { error });
          setError(`OAuth error: ${error}`);
          setStatus('error');
          ToastService.error(`OAuth error: ${error}`);
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }

        // Supabase automatically processes hash fragments (#access_token=...)
        // Wait a moment for Supabase to process the hash fragments
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the session (Supabase has already processed the hash fragments)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          Logger.error('🔴 OAuthCallback: Error getting session', { error: sessionError.message });
          setError(`OAuth error: ${sessionError.message}`);
          setStatus('error');
          ToastService.error(`OAuth error: ${sessionError.message}`);
          setTimeout(() => navigate('/signin'), 3000);
          return;
        }
        
        if (!session || !session.user) {
          // Wait a bit longer and retry (hash processing might take time)
          Logger.warn('⚠️ OAuthCallback: No session found, waiting and retrying...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
          
          if (retryError || !retrySession || !retrySession.user) {
            Logger.error('🔴 OAuthCallback: No session found after retry');
            setError('OAuth successful but session not established. Please try again.');
            setStatus('error');
            ToastService.error('OAuth callback failed: No session');
            setTimeout(() => navigate('/signin'), 3000);
            return;
          }
          
          Logger.info('✅ OAuthCallback: OAuth successful (after retry)', { userId: retrySession.user.id });
          
          // Profile is automatically created by database trigger when user is created in auth.users
          // The trigger extracts first_name and last_name from user_metadata
          // No need to manually create profile - trigger handles it automatically

          setStatus('success');
          ToastService.success('Signed in with Google successfully');
          setTimeout(() => navigate('/dashboard', { replace: true }), 1000);
          return;
        }

        Logger.info('✅ OAuthCallback: OAuth successful', { userId: session.user.id });

        // Profile is automatically created by database trigger when user is created in auth.users
        // The trigger extracts first_name and last_name from user_metadata
        // No need to manually create profile - trigger handles it automatically

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

