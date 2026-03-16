import React, { useEffect } from 'react'
import { useThemeStore, initializeTheme } from '../stores/themeStore'

// Convert hex color to HSL string (without the hsl() wrapper, just "h s% l%")
function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

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

    // Apply primary colors (hex-based for primary-500 etc.)
    Object.entries(colorScheme.primary).forEach(([shade, color]) => {
      root.style.setProperty(`--primary-${shade}`, color)
    })

    // Also update the HSL-based --primary var (used by bg-primary, text-primary)
    root.style.setProperty('--primary', hexToHSL(colorScheme.primary[500]))
    root.style.setProperty('--ring', hexToHSL(colorScheme.primary[500]))

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
