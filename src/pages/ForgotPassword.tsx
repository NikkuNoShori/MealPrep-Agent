import React from 'react'
import { Link } from 'react-router-dom'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

const ForgotPassword: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-[rgb(var(--rs-page-bg-rgb))] p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-block">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="text-xl font-bold text-fg">
                MealPrep Agent
              </span>
            </div>
          </Link>
        </div>
        
        <ForgotPasswordForm />
      </div>
    </div>
  )
}

export default ForgotPassword

