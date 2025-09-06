import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation()
  const { user, isLoading, initialize } = useAuthStore()
  const initializedRef = React.useRef(false)

  useEffect(() => {
    if (!initializedRef.current && !user) {
      initializedRef.current = true
      initialize()
    }
  }, [initialize, user])

  if (isLoading) {
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


