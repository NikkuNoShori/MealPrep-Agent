import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // ALL HOOKS MUST BE CALLED FIRST - before any conditional returns
  const location = useLocation()
  const { user, isLoading } = useAuthStore()
  const [waitingForAuth, setWaitingForAuth] = React.useState(false)
  
  // Auth is initialized in App.tsx - no need to initialize here
  
  React.useEffect(() => {
    // If no user but we might be coming from OAuth, wait a moment
    if (!user && !isLoading && !waitingForAuth) {
      const isOAuthCallback = document.referrer.includes('/auth/callback') ||
                              sessionStorage.getItem('oauth_redirecting') === 'true'
      
      if (isOAuthCallback) {
        setWaitingForAuth(true)
        sessionStorage.removeItem('oauth_redirecting')
        
        // Wait up to 2 seconds for auth state to update
        const timer = setTimeout(() => {
          setWaitingForAuth(false)
        }, 2000)
        
        return () => clearTimeout(timer)
      }
    }
  }, [user, isLoading, waitingForAuth])

  // NOW we can do conditional returns after all hooks are called
  // Show loading state while checking auth
  // Give it a moment after OAuth callback to update state
  if (isLoading || (!user && waitingForAuth)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute


