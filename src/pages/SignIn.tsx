import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoginForm } from '@/components/auth/LoginForm'
import { BackButton } from '@/components/common/BackButton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/stores/authStore'

const SignIn: React.FC = () => {
  useDocumentTitle()
  const navigate = useNavigate()
  const { user, isLoading } = useAuthStore()

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !isLoading) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, isLoading, navigate])

  const handleAuthSuccess = () => {
    navigate('/dashboard')
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Don't render sign in if already authenticated (will redirect)
  if (user) {
    return null
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-block">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="text-xl font-bold text-stone-900 dark:text-white">
                MealPrep Agent
              </span>
            </div>
          </Link>
        </div>
        
        <LoginForm onSuccess={handleAuthSuccess} />
        
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignIn
