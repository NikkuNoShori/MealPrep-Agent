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
    let resolved = false
    let subscription: any = null
    let timeoutId: any = null

    const handleCallback = async () => {
      try {
        // Import supabase client directly
        const { supabase } = await import('@/services/supabase')
        
        // Set up auth state change listener as primary method
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (resolved) return
            
            if (event === 'SIGNED_IN' && session?.user) {
              resolved = true
              if (subscription) {
                subscription.unsubscribe()
              }
              if (timeoutId) {
                clearTimeout(timeoutId)
              }
              
              // Refresh user state in store and wait for it to complete
              await refreshUser()
              
              // Verify the user is in the store before navigating
              const { user: storeUser } = useAuthStore.getState()
              
              if (!storeUser) {
                // Wait a bit more and check again
                await new Promise(resolve => setTimeout(resolve, 500))
                const { user: retryStoreUser } = useAuthStore.getState()
                
                if (!retryStoreUser) {
                  console.error('AuthCallback: User not in store after refresh')
                  setError('Failed to update user state')
                  setTimeout(() => {
                    navigate('/signin?error=oauth_failed', { replace: true })
                  }, 2000)
                  return
                }
              }
              
              // Set a flag in sessionStorage to help ProtectedRoute detect OAuth redirect
              sessionStorage.setItem('oauth_redirecting', 'true')
              
              // Additional delay to ensure Zustand state is propagated to all components
              await new Promise(resolve => setTimeout(resolve, 500))
              
              navigate('/dashboard', { replace: true })
            } else if (event === 'SIGNED_OUT' && !resolved) {
              resolved = true
              if (subscription) {
                subscription.unsubscribe()
              }
              if (timeoutId) {
                clearTimeout(timeoutId)
              }
              setError('OAuth callback failed - user not signed in')
              setTimeout(() => {
                navigate('/signin?error=oauth_failed', { replace: true })
              }, 2000)
            } else if (event === 'TOKEN_REFRESHED' && session?.user && !resolved) {
              resolved = true
              if (subscription) {
                subscription.unsubscribe()
              }
              if (timeoutId) {
                clearTimeout(timeoutId)
              }
              
              await refreshUser()
              await new Promise(resolve => setTimeout(resolve, 200))
              navigate('/dashboard', { replace: true })
            }
          }
        )
        subscription = authSub
        
        // Also try to get session immediately (fallback)
        // Wait a moment for Supabase to process the URL hash fragments
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('AuthCallback: Session error:', sessionError)
          // Don't throw - let the auth state change listener handle it
        }
        
        if (session?.user && !resolved) {
          resolved = true
          if (subscription) {
            subscription.unsubscribe()
          }
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          
          // Refresh user state in store
          await refreshUser()
          
          // Small delay to ensure state is updated
          await new Promise(resolve => setTimeout(resolve, 200))
          
          navigate('/dashboard', { replace: true })
          return
        }
        
        if (!session && !resolved) {
          // Try once more after a delay
          await new Promise(resolve => setTimeout(resolve, 2000))
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession()
          
          if (retrySession?.user && !resolved) {
            resolved = true
            if (subscription) {
              subscription.unsubscribe()
            }
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
            
            await refreshUser()
            await new Promise(resolve => setTimeout(resolve, 200))
            navigate('/dashboard', { replace: true })
            return
          }
          
          if (!retrySession && !resolved) {
            // Set timeout - if no session after 8 seconds, show error
            timeoutId = setTimeout(() => {
              if (!resolved) {
                console.error('AuthCallback: Timeout - no session received')
                resolved = true
                if (subscription) {
                  subscription.unsubscribe()
                }
                setError('OAuth callback timeout - session not received. Please try again.')
                setTimeout(() => {
                  navigate('/signin?error=oauth_failed', { replace: true })
                }, 2000)
              }
            }, 8000)
          }
        }
      } catch (error: any) {
        if (!resolved) {
          resolved = true
          if (subscription) {
            subscription.unsubscribe()
          }
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          console.error('AuthCallback: Error:', error)
          setError(error?.message || 'Failed to complete sign in')
          setTimeout(() => {
            navigate('/signin?error=oauth_failed', { replace: true })
          }, 2000)
        }
      }
    }

    handleCallback()
    
    // Cleanup on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
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

