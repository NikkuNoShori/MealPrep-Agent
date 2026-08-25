import React from 'react'
import { Link } from 'react-router-dom'

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="inline-block mb-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-xl font-bold text-stone-900 dark:text-white">
              MealPrep Agent
            </span>
          </div>
        </Link>

        <h1 className="text-4xl font-bold text-stone-900 dark:text-white mb-2">404</h1>
        <p className="text-stone-600 dark:text-gray-400 mb-6">
          We couldn't find that page. It may have moved or never existed.
        </p>

        <Link
          to="/"
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}

export default NotFound
