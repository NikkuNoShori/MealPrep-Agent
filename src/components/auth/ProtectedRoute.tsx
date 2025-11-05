import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Logger } from '@/services/logger'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation()
  const { user, isLoading, refreshUser } = useAuthStore()
  
  // Refresh auth state when ProtectedRoute mounts to ensure we have latest session
  useEffect(() => {
    Logger.debug('🔵 ProtectedRoute: Refreshing auth state on mount')
    refreshUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Redirect to sign in if not authenticated
  if (!user) {
    Logger.debug('🔵 ProtectedRoute: No user found, redirecting to signin')
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  // User is authenticated, render children
  Logger.debug('🔵 ProtectedRoute: User authenticated, rendering children', { userId: user.id })
  return <>{children}</>
}

export default ProtectedRoute


