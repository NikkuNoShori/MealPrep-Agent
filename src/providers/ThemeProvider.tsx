import React, { useEffect } from 'react'
import { useThemeStore, initializeTheme, applyColorSchemeToCSS } from '../stores/themeStore'

interface ThemeProviderProps {
  children: React.ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { colorScheme, currentTheme } = useThemeStore();

  useEffect(() => {
    // Initialize theme system
    const cleanup = initializeTheme()

    return cleanup
  }, [])

  // Apply color scheme when it (or the light/dark mode) changes.
  // applyColorSchemeToCSS() in themeStore.ts is the SINGLE apply path
  // (MOP-0029 Phase 2) — no duplicate DOM-writing logic lives here.
  // currentTheme is included so a light/dark toggle re-derives the
  // HSL-derived tokens (--primary/--ring/--secondary/--destructive),
  // which are light/dark-aware.
  useEffect(() => {
    applyColorSchemeToCSS(colorScheme)
  }, [colorScheme, currentTheme])

  return <>{children}</>
}
