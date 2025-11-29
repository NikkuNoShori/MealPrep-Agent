import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/services/supabase'
import { Loader2 } from 'lucide-react'
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const AuthCallback: React.FC = () => {
  useDocumentTitle();
  const navigate = useNavigate()
  const { refreshUser } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Wait for OAuth callback to be processed
        const result = await authService.handleOAuthCallback()
        
        if (result.user) {
          // Refresh user state in store
          await refreshUser()
          // Small delay to ensure state is updated
          setTimeout(() => {
            navigate('/dashboard', { replace: true })
          }, 100)
        } else {
          throw new Error('No user data received from OAuth callback')
        }
      } catch (error: any) {
        console.error('OAuth callback error:', error)
        setError(error?.message || 'Failed to complete sign in')
        setTimeout(() => {
          navigate('/signin?error=oauth_failed', { replace: true })
        }, 2000)
      }
    }

    handleCallback()
  }, [navigate, refreshUser])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-600 dark:text-red-400 mb-4">
              <p className="font-semibold">Sign in failed</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <p className="text-xs text-muted-foreground mt-4">Redirecting to sign in...</p>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthCallback

