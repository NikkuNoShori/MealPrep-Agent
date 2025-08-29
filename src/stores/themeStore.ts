import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

export interface ColorScheme {
  name: string
  primary: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  secondary: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  neutral: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
  }
  semantic: {
    success: {
      100: string
      800: string
      900: string
    }
    error: {
      500: string
      600: string
    }
    warning: {
      100: string
      800: string
    }
  }
}

export interface ThemeState {
  // Theme state
  theme: Theme
  systemTheme: 'light' | 'dark'
  
  // Color schemes
  colorScheme: ColorScheme
  availableColorSchemes: Record<string, ColorScheme>
  
  // Actions
  setTheme: (theme: Theme) => void
  setSystemTheme: (theme: 'light' | 'dark') => void
  setColorScheme: (schemeName: string) => void
  addColorScheme: (name: string, scheme: ColorScheme) => void
  removeColorScheme: (name: string) => void
  
  // Computed values
  currentTheme: 'light' | 'dark'
  isDark: boolean
  isLight: boolean
}

// Default color scheme (current blue/purple theme)
const defaultColorScheme: ColorScheme = {
  name: 'Ocean',
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  secondary: {
    50: '#fdf4ff',
    100: '#fae8ff',
    200: '#f5d0fe',
    300: '#f0abfc',
    400: '#e879f9',
    500: '#d946ef',
    600: '#c026d3',
    700: '#a21caf',
    800: '#86198f',
    900: '#701a75',
  },
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  semantic: {
    success: {
      100: '#dcfce7',
      800: '#166534',
      900: '#14532d',
    },
    error: {
      500: '#ef4444',
      600: '#dc2626',
    },
    warning: {
      100: '#fef3c7',
      800: '#92400e',
    },
  },
}

// Alternative color schemes
const alternativeSchemes: Record<string, ColorScheme> = {
  'Forest': {
    name: 'Forest',
    primary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    secondary: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
    },
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    semantic: {
      success: {
        100: '#dcfce7',
        800: '#166534',
        900: '#14532d',
      },
      error: {
        500: '#ef4444',
        600: '#dc2626',
      },
      warning: {
        100: '#fef3c7',
        800: '#92400e',
      },
    },
  },
  'Sunset': {
    name: 'Sunset',
    primary: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    secondary: {
      50: '#fdf2f8',
      100: '#fce7f3',
      200: '#fbcfe8',
      300: '#f9a8d4',
      400: '#f472b6',
      500: '#ec4899',
      600: '#db2777',
      700: '#be185d',
      800: '#9d174d',
      900: '#831843',
    },
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    semantic: {
      success: {
        100: '#dcfce7',
        800: '#166534',
        900: '#14532d',
      },
      error: {
        500: '#ef4444',
        600: '#dc2626',
      },
      warning: {
        100: '#fef3c7',
        800: '#92400e',
      },
    },
  },
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'light',
      systemTheme: 'light',
      colorScheme: defaultColorScheme,
      availableColorSchemes: {
        'Ocean': defaultColorScheme,
        ...alternativeSchemes,
      },

      // Actions
      setTheme: (theme: Theme) => {
        set({ theme })
        
        // Apply theme to document
        const root = document.documentElement;

        // For light/dark themes, apply directly. For system theme, use systemTheme
        if (theme === "system") {
          const systemTheme = get().systemTheme;
          root.classList.remove("light", "dark");
          root.classList.add(systemTheme);
        } else {
          root.classList.remove("light", "dark");
          root.classList.add(theme);
        }
      },

      setSystemTheme: (systemTheme: 'light' | 'dark') => {
        set({ systemTheme })
        
        // Re-apply theme if using system theme
        const { theme } = get()
        if (theme === 'system') {
          const root = document.documentElement
          root.classList.remove('light', 'dark')
          root.classList.add(systemTheme)
        }
      },

      setColorScheme: (schemeName: string) => {
        const { availableColorSchemes } = get()
        const scheme = availableColorSchemes[schemeName]
        
        if (scheme) {
          set({ colorScheme: scheme })
          
          // Apply CSS custom properties
          applyColorSchemeToCSS(scheme)
        }
      },

      addColorScheme: (name: string, scheme: ColorScheme) => {
        set((state) => ({
          availableColorSchemes: {
            ...state.availableColorSchemes,
            [name]: { ...scheme, name },
          },
        }))
      },

      removeColorScheme: (name: string) => {
        set((state) => {
          const { [name]: removed, ...remaining } = state.availableColorSchemes
          return {
            availableColorSchemes: remaining,
            // Reset to default if current scheme is removed
            colorScheme: state.colorScheme.name === name ? defaultColorScheme : state.colorScheme,
          }
        })
      },

      // Computed values
      get currentTheme() {
        const { theme, systemTheme } = get()
        if (theme === 'system') return systemTheme
        return theme
      },

      get isDark() {
        return get().currentTheme === 'dark'
      },

      get isLight() {
        return get().currentTheme === 'light'
      },
    }),
    {
      name: 'theme-store',
      partialize: (state) => ({
        theme: state.theme,
        colorScheme: state.colorScheme,
        availableColorSchemes: state.availableColorSchemes,
      }),
    }
  )
)

// Helper function to apply color scheme to CSS custom properties
function applyColorSchemeToCSS(scheme: ColorScheme) {
  const root = document.documentElement
  
  // Apply primary colors
  Object.entries(scheme.primary).forEach(([shade, color]) => {
    root.style.setProperty(`--primary-${shade}`, color)
  })
  
  // Apply secondary colors
  Object.entries(scheme.secondary).forEach(([shade, color]) => {
    root.style.setProperty(`--secondary-${shade}`, color)
  })
  
  // Apply neutral colors
  Object.entries(scheme.neutral).forEach(([shade, color]) => {
    root.style.setProperty(`--gray-${shade}`, color)
  })
  
  // Apply semantic colors
  root.style.setProperty('--success-100', scheme.semantic.success[100])
  root.style.setProperty('--success-800', scheme.semantic.success[800])
  root.style.setProperty('--success-900', scheme.semantic.success[900])
  root.style.setProperty('--error-500', scheme.semantic.error[500])
  root.style.setProperty('--error-600', scheme.semantic.error[600])
  root.style.setProperty('--warning-100', scheme.semantic.warning[100])
  root.style.setProperty('--warning-800', scheme.semantic.warning[800])
}

// Initialize theme on store creation
export const initializeTheme = () => {
  const store = useThemeStore.getState()
  
  // Set up system theme detection
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  const updateSystemTheme = (e: MediaQueryListEvent | MediaQueryList) => {
    store.setSystemTheme(e.matches ? 'dark' : 'light')
  }
  
  // Set initial system theme
  updateSystemTheme(mediaQuery)
  
  // Listen for system theme changes
  mediaQuery.addEventListener('change', updateSystemTheme)
  
  // Apply initial theme
  store.setTheme(store.theme)
  
  // Apply initial color scheme
  applyColorSchemeToCSS(store.colorScheme)
  
  return () => {
    mediaQuery.removeEventListener('change', updateSystemTheme)
  }
}

// Export theme utilities
export const getThemeColors = () => {
  const { colorScheme, currentTheme } = useThemeStore.getState()
  return {
    scheme: colorScheme,
    theme: currentTheme,
    isDark: currentTheme === 'dark',
    isLight: currentTheme === 'light',
  }
}

export const getColorValue = (colorPath: string) => {
  const { colorScheme } = useThemeStore.getState()
  const path = colorPath.split('.')
  let value: any = colorScheme
  
  for (const key of path) {
    value = value?.[key]
  }
  
  return value
}
