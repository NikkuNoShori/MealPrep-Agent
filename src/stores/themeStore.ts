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

// Default color scheme — warm emerald + amber
const defaultColorScheme: ColorScheme = {
  name: 'Evergreen',
  primary: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#1D9E75',
    600: '#178c66',
    700: '#15754f',
    800: '#115e3e',
    900: '#064e3b',
  },
  secondary: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
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
  'Ocean': {
    name: 'Ocean',
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    secondary: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
    },
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
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
      theme: "system",
      systemTheme: "light",
      colorScheme: defaultColorScheme,
      availableColorSchemes: {
        Evergreen: defaultColorScheme,
        ...alternativeSchemes,
      },

      // Actions
      setTheme: (theme: Theme) => {
        set({ theme });

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

      setSystemTheme: (systemTheme: "light" | "dark") => {
        set({ systemTheme });

        // Re-apply theme if using system theme
        const { theme } = get();
        if (theme === "system") {
          const root = document.documentElement;
          root.classList.remove("light", "dark");
          root.classList.add(systemTheme);
        }
      },

      setColorScheme: (schemeName: string) => {
        const { availableColorSchemes } = get();
        const scheme = availableColorSchemes[schemeName];

        if (scheme) {
          set({ colorScheme: scheme });

          // Apply CSS custom properties
          applyColorSchemeToCSS(scheme);
        }
      },

      addColorScheme: (name: string, scheme: ColorScheme) => {
        set((state) => ({
          availableColorSchemes: {
            ...state.availableColorSchemes,
            [name]: { ...scheme, name },
          },
        }));
      },

      removeColorScheme: (name: string) => {
        set((state) => {
          const { [name]: _removed, ...remaining } = state.availableColorSchemes;
          return {
            availableColorSchemes: remaining,
            // Reset to default if current scheme is removed
            colorScheme:
              state.colorScheme.name === name
                ? defaultColorScheme
                : state.colorScheme,
          };
        });
      },

      // Computed values
      get currentTheme() {
        const { theme, systemTheme } = get();
        if (theme === "system") return systemTheme;
        return theme;
      },

      get isDark() {
        return get().currentTheme === "dark";
      },

      get isLight() {
        return get().currentTheme === "light";
      },
    }),
    {
      name: "theme-store",
      partialize: (state) => ({
        theme: state.theme,
        colorScheme: state.colorScheme,
        availableColorSchemes: state.availableColorSchemes,
      }),
    }
  )
);

// Convert hex color to an HSL triplet string (without the hsl() wrapper,
// just "h s% l%") — the format shadcn's CSS variables expect.
// Moved here from ThemeProvider.tsx (MOP-0029 Phase 2): this is the single
// apply path, so the conversion it depends on lives alongside it.
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

// Light/dark-aware lightness adjustment for an HSL triplet string, used so
// applying a preset doesn't flatten the .dark block's intentionally
// lightened --primary (previously index.css had a hardcoded lighter value
// for dark mode that a preset switch would overwrite identically to light).
function adjustHSLLightness(hsl: string, deltaPercent: number): string {
  const match = hsl.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) return hsl;
  const [, h, s, l] = match;
  const newL = Math.max(0, Math.min(100, parseInt(l, 10) + deltaPercent));
  return `${h} ${s}% ${newL}%`;
}

// Helper function to apply color scheme to CSS custom properties.
// This is the SINGLE apply path (MOP-0029 Phase 2) — ThemeProvider.tsx
// calls this instead of duplicating the logic itself.
export function applyColorSchemeToCSS(scheme: ColorScheme) {
  const root = document.documentElement
  const isDark = root.classList.contains('dark')

  // Apply primary colors (numeric ramp)
  Object.entries(scheme.primary).forEach(([shade, color]) => {
    root.style.setProperty(`--primary-${shade}`, color)
  })

  // Apply secondary colors (numeric ramp)
  Object.entries(scheme.secondary).forEach(([shade, color]) => {
    root.style.setProperty(`--secondary-${shade}`, color)
  })

  // Apply neutral colors
  Object.entries(scheme.neutral).forEach(([shade, color]) => {
    root.style.setProperty(`--gray-${shade}`, color)
  })

  // HSL-derived tokens consumed by shadcn primitives (bg-primary, ring, etc).
  // Dark mode gets a lightened variant so presets don't flatten the .dark
  // block's intentionally brighter --primary (index.css previously hardcoded
  // "160 67% 52%" vs light's "158 70% 37%" — roughly +15% lightness).
  const primaryHSL = hexToHSL(scheme.primary[500])
  const secondaryHSL = hexToHSL(scheme.secondary[500])
  root.style.setProperty('--primary', isDark ? adjustHSLLightness(primaryHSL, 15) : primaryHSL)
  root.style.setProperty('--ring', isDark ? adjustHSLLightness(primaryHSL, 15) : primaryHSL)
  root.style.setProperty('--secondary', isDark ? adjustHSLLightness(secondaryHSL, 15) : secondaryHSL)

  // Apply semantic colors (numeric ramp)
  root.style.setProperty('--success-100', scheme.semantic.success[100])
  root.style.setProperty('--success-800', scheme.semantic.success[800])
  root.style.setProperty('--success-900', scheme.semantic.success[900])
  root.style.setProperty('--error-500', scheme.semantic.error[500])
  root.style.setProperty('--error-600', scheme.semantic.error[600])
  root.style.setProperty('--warning-100', scheme.semantic.warning[100])
  root.style.setProperty('--warning-800', scheme.semantic.warning[800])

  // Derive shadcn's --destructive from semantic.error (MOP-0029 Phase 3)
  // so the 19 existing text-destructive/bg-destructive usages become
  // preset-aware instead of pinned to the static index.css value.
  // Dark mode uses the lighter error[500] shade against the dark surface
  // (matches the existing hardcoded dark --destructive being a distinct,
  // muted treatment from light rather than a uniform lightness bump).
  root.style.setProperty('--destructive', hexToHSL(isDark ? scheme.semantic.error[500] : scheme.semantic.error[600]))

  // Status tokens (success/warning) as HSL, for the alert.tsx status-*
  // Tailwind utilities wired in tailwind.config.js.
  root.style.setProperty('--status-success', hexToHSL(scheme.semantic.success[800]))
  root.style.setProperty('--status-warning', hexToHSL(scheme.semantic.warning[800]))
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
