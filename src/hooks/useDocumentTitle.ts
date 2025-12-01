import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Route to title mapping
const routeTitles: Record<string, string> = {
  '/': 'MealPrep Agent - Smart Meal Planning',
  '/dashboard': 'Dashboard - MealPrep Agent',
  '/chat': 'Chat - MealPrep Agent',
  '/recipes': 'Recipes - MealPrep Agent',
  '/meal-planner': 'Meal Planner - MealPrep Agent',
  '/settings': 'Settings - MealPrep Agent',
  '/signin': 'Sign In - MealPrep Agent',
  '/signup': 'Sign Up - MealPrep Agent',
  '/auth/callback': 'Signing In... - MealPrep Agent',
}

// Default title
const defaultTitle = 'MealPrep Agent'

/**
 * Hook to update document title based on current route
 * @param customTitle - Optional custom title to override route-based title
 */
export const useDocumentTitle = (customTitle?: string) => {
  const location = useLocation()

  useEffect(() => {
    const title = customTitle || routeTitles[location.pathname] || defaultTitle
    document.title = title
  }, [location.pathname, customTitle])
}

