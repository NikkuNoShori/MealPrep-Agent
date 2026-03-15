import { Link } from 'react-router-dom'

const Footer = () => {
  const year = new Date().getFullYear()

  return (
    <footer className="relative z-10 border-t border-stone-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-[#16171c]/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Copyright */}
          <p className="text-xs text-stone-400 dark:text-gray-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            &copy; {year} Transcension Solutions LLC. All rights reserved.
          </p>

          {/* Nav links */}
          <nav className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-xs text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Dashboard
            </Link>
            <Link
              to="/recipes"
              className="text-xs text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Recipes
            </Link>
            <Link
              to="/meal-planner"
              className="text-xs text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Meal Planner
            </Link>
            <Link
              to="/settings"
              className="text-xs text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Settings
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export default Footer
