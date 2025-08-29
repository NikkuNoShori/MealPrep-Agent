import React, { useEffect } from 'react'
import { useThemeStore, initializeTheme } from '../stores/themeStore'

interface ThemeProviderProps {
  children: React.ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { colorScheme } = useThemeStore();

  useEffect(() => {
    // Initialize theme system
    const cleanup = initializeTheme()
    
    return cleanup
  }, [])

  // Apply color scheme when it changes
  useEffect(() => {
    const root = document.documentElement
    
    // Apply primary colors
    Object.entries(colorScheme.primary).forEach(([shade, color]) => {
      root.style.setProperty(`--primary-${shade}`, color)
    })
    
    // Apply secondary colors
    Object.entries(colorScheme.secondary).forEach(([shade, color]) => {
      root.style.setProperty(`--secondary-${shade}`, color)
    })
    
    // Apply neutral colors
    Object.entries(colorScheme.neutral).forEach(([shade, color]) => {
      root.style.setProperty(`--gray-${shade}`, color)
    })
    
    // Apply semantic colors
    root.style.setProperty('--success-100', colorScheme.semantic.success[100])
    root.style.setProperty('--success-800', colorScheme.semantic.success[800])
    root.style.setProperty('--success-900', colorScheme.semantic.success[900])
    root.style.setProperty('--error-500', colorScheme.semantic.error[500])
    root.style.setProperty('--error-600', colorScheme.semantic.error[600])
    root.style.setProperty('--warning-100', colorScheme.semantic.warning[100])
    root.style.setProperty('--warning-800', colorScheme.semantic.warning[800])
  }, [colorScheme])

  return <>{children}</>
}

// Hook for easy theme access
export const useTheme = () => {
  const {
    theme,
    currentTheme,
    isDark,
    isLight,
    colorScheme,
    availableColorSchemes,
    setTheme,
    setColorScheme,
    addColorScheme,
    removeColorScheme,
  } = useThemeStore()

  return {
    theme,
    currentTheme,
    isDark,
    isLight,
    colorScheme,
    availableColorSchemes,
    setTheme,
    setColorScheme,
    addColorScheme,
    removeColorScheme,
  }
}
