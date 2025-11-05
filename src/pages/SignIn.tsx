import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoginForm } from '@/components/auth/LoginForm'
import { BackButton } from '@/components/common/BackButton'

const SignIn: React.FC = () => {
  const navigate = useNavigate()

  const handleAuthSuccess = () => {
    navigate('/dashboard')
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
        
        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm">
            <Link 
              to="/forgot-password" 
              className="text-primary hover:underline font-medium"
            >
              Forgot your password?
            </Link>
          </p>
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
