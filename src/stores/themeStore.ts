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
  // MOP-0029 Phase 4 — surface ramp. Supersedes the hardcoded `stone` palette
  // as the semantic owner of page background / card surface / border colors.
  // Same 10-key shape as primary/secondary, PLUS a `dark` sub-ramp: unlike
  // primary/secondary/neutral (whose dark-mode CSS variants are today
  // identical to light, with dark-mode brand tokens instead derived
  // algorithmically via adjustHSLLightness), the approved Phase 9 spec gives
  // surface a genuinely distinct, curated dark ramp per preset — not a
  // formulaic lightness shift — so it must be authored explicitly rather
  // than derived. See COLOR_SCHEMA.md §3 categories 1-2, 5.
  surface: {
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
    dark: {
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
  }
  // MOP-0029 Phase 4 — accent-category ramp (COLOR_SCHEMA.md §6). Six
  // visually-distinct-but-coordinated accents used for meal slots, dashboard
  // stats, status icons, etc. Numeric slots 1-6 in per-preset ramp order —
  // NOT named keys. (The MOP's prose names them e.g. Ochre/Rust/Sage/Clay/
  // Teal/Plum for Evergreen; those names are documentation only, not schema.)
  accentCategory: {
    1: string
    2: string
    3: string
    4: string
    5: string
    6: string
  }
  // MOP-0029 Phase 4 — named decorative gradients (COLOR_SCHEMA.md §9).
  gradient: {
    brand: { from: string; to: string }
    warm: { from: string; to: string }
    subtle: { from: string; to: string }
  }
  // MOP-0029 Phase 4 — reserved data-viz categorical ramp (COLOR_SCHEMA.md
  // §10). Not consumed anywhere yet; declared now so the first chart doesn't
  // have to retrofit a palette. Populated with a colorblind-conscious
  // categorical sequence derived from each preset's accent/brand colors.
  viz: {
    1: string
    2: string
    3: string
    4: string
    5: string
    6: string
    7: string
    8: string
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
  // Surface = unchanged transcription of today's stone-* Tailwind values
  // (MOP-0029 Phase 4 pixel-identical requirement). Do not alter.
  surface: {
    50: '#fafaf9',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
    dark: {
      50: '#1c1917',
      100: '#292524',
      200: '#3a352e',
      300: '#44403c',
      400: '#57534e',
      500: '#78716c',
      600: '#a8a29e',
      700: '#d6d3d1',
      800: '#e7e5e4',
      900: '#f5f5f4',
    },
  },
  accentCategory: {
    1: '#b8860b', // Ochre
    2: '#a44a2e', // Rust
    3: '#6c8560', // Sage
    4: '#c2703f', // Clay
    5: '#0d9488', // Teal
    6: '#7a4a6b', // Plum
  },
  gradient: {
    brand: { from: '#1D9E75', to: '#34d399' },
    warm: { from: '#b8860b', to: '#c2703f' },
    subtle: { from: '#e7e5e4', to: '#f5f5f4' },
  },
  // Reserved (Phase 4) — not consumed yet. Categorical sequence derived from
  // this preset's accent-category ramp + brand primary/secondary for extra
  // headroom past 6 series.
  viz: {
    1: '#b8860b',
    2: '#a44a2e',
    3: '#6c8560',
    4: '#c2703f',
    5: '#0d9488',
    6: '#7a4a6b',
    7: '#1D9E75',
    8: '#f59e0b',
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
    surface: {
      50: '#f7f9f4',
      100: '#eef2e7',
      200: '#dfe6d2',
      300: '#c7d1b3',
      400: '#9fab84',
      500: '#767f5c',
      600: '#5a6146',
      700: '#434833',
      800: '#2b2e20',
      900: '#1a1c14',
      dark: {
        50: '#14150f',
        100: '#1e2116',
        200: '#282c1d',
        300: '#363b27',
        400: '#4a5136',
        500: '#6b734f',
        600: '#8f9871',
        700: '#b6bd9d',
        800: '#d5dac0',
        900: '#eef1e3',
      },
    },
    accentCategory: {
      1: '#ca8a04', // Gold
      2: '#d97706', // Amber
      3: '#0f766e', // Teal
      4: '#7e22ce', // Plum
      5: '#c2410c', // Clay
      6: '#0284c7', // Sky
    },
    gradient: {
      brand: { from: '#22c55e', to: '#86efac' },
      warm: { from: '#ca8a04', to: '#facc15' },
      subtle: { from: '#dfe6d2', to: '#eef2e7' },
    },
    viz: {
      1: '#ca8a04',
      2: '#d97706',
      3: '#0f766e',
      4: '#7e22ce',
      5: '#c2410c',
      6: '#0284c7',
      7: '#22c55e',
      8: '#eab308',
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
    surface: {
      50: '#f6f8fb',
      100: '#eaeef5',
      200: '#d7deea',
      300: '#b9c5da',
      400: '#8b9bbb',
      500: '#647391',
      600: '#4c5975',
      700: '#38435a',
      800: '#242b3b',
      900: '#161a24',
      dark: {
        50: '#0e1016',
        100: '#161a24',
        200: '#1e2330',
        300: '#2a3142',
        400: '#3c465c',
        500: '#576382',
        600: '#7d89a8',
        700: '#a9b2c9',
        800: '#ced4e2',
        900: '#e9ecf2',
      },
    },
    accentCategory: {
      1: '#0d9488', // Teal
      2: '#7c3aed', // Violet
      3: '#d97706', // Amber
      4: '#e11d48', // Rose
      5: '#0891b2', // Cyan
      6: '#475569', // Slate
    },
    gradient: {
      brand: { from: '#3b82f6', to: '#5eead4' },
      warm: { from: '#0d9488', to: '#2dd4bf' },
      subtle: { from: '#d7deea', to: '#eaeef5' },
    },
    viz: {
      1: '#0d9488',
      2: '#7c3aed',
      3: '#d97706',
      4: '#e11d48',
      5: '#0891b2',
      6: '#475569',
      7: '#3b82f6',
      8: '#14b8a6',
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
    surface: {
      50: '#fdf8f5',
      100: '#faeee6',
      200: '#f3d9c8',
      300: '#e7bc9e',
      400: '#d29a6f',
      500: '#b3774c',
      600: '#8f5c39',
      700: '#6d452c',
      800: '#492e1d',
      900: '#2c1c12',
      dark: {
        50: '#1a120c',
        100: '#291d13',
        200: '#382719',
        300: '#4f3722',
        400: '#6f4c2d',
        500: '#96683c',
        600: '#c08a55',
        700: '#d9ab7c',
        800: '#eaccae',
        900: '#f7e6d6',
      },
    },
    accentCategory: {
      1: '#db2777', // Pink
      2: '#9333ea', // Purple
      3: '#0d9488', // Teal
      4: '#ca8a04', // Gold
      5: '#e11d48', // Rose
      6: '#4f46e5', // Indigo
    },
    gradient: {
      brand: { from: '#f97316', to: '#ec4899' },
      warm: { from: '#fb923c', to: '#f472b6' },
      subtle: { from: '#f3d9c8', to: '#faeee6' },
    },
    viz: {
      1: '#db2777',
      2: '#9333ea',
      3: '#0d9488',
      4: '#ca8a04',
      5: '#e11d48',
      6: '#4f46e5',
      7: '#f97316',
      8: '#ec4899',
    },
  },
  'Botanical': {
    name: 'Botanical',
    // Only preset that introduces new primary/secondary brand ramps
    // (terracotta / olive) — MOP-0029 Phase 4. Dark mode is "same" per the
    // approved spec; no separate dark ramp for primary/secondary/accentCategory/gradient.
    primary: {
      50: '#fdf1ec',
      100: '#fbe0d3',
      200: '#f4bda2',
      300: '#e89a6e',
      400: '#d67744',
      500: '#b5542f',
      600: '#963f22',
      700: '#77301a',
      800: '#582212',
      900: '#3a160b',
    },
    secondary: {
      50: '#f3f5ee',
      100: '#e4e9d8',
      200: '#c9d3ae',
      300: '#aabb85',
      400: '#8a9c66',
      500: '#5b6b3f',
      600: '#485631',
      700: '#374225',
      800: '#262f19',
      900: '#161c0e',
    },
    // Not specified by the MOP for Botanical — derived as a warm-neutral gray
    // consistent with the terracotta/olive palette rather than reusing
    // Evergreen's cool gray verbatim (judgment call; see final report).
    neutral: {
      50: '#faf8f6',
      100: '#f2ede8',
      200: '#e3dad2',
      300: '#cfc0b3',
      400: '#a89684',
      500: '#867a6b',
      600: '#5c4f43',
      700: '#463c33',
      800: '#2e2822',
      900: '#1c1815',
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
    surface: {
      50: '#faf6ee',
      100: '#f4ecdd',
      200: '#e8dcc5',
      300: '#d9cbb0',
      400: '#c2b092',
      500: '#a3936f',
      600: '#7d7053',
      700: '#5c5340',
      800: '#3a352a',
      900: '#241f18',
      dark: {
        50: '#161310',
        100: '#1d1811',
        200: '#241d15',
        300: '#332a1e',
        400: '#453a29',
        500: '#6c5c45',
        600: '#a8987e',
        700: '#c9bda6',
        800: '#e1d7c5',
        900: '#f4ecdd',
      },
    },
    accentCategory: {
      1: '#b8860b', // Ochre
      2: '#a44a2e', // Rust
      3: '#6c8560', // Sage
      4: '#7a4a6b', // Plum
      5: '#3d7a6e', // Teal
      6: '#c2703f', // Clay
    },
    gradient: {
      brand: { from: '#b5542f', to: '#d67744' },
      warm: { from: '#5b6b3f', to: '#8a9c66' },
      subtle: { from: '#e8dcc5', to: '#f4ecdd' },
    },
    viz: {
      1: '#b8860b',
      2: '#a44a2e',
      3: '#6c8560',
      4: '#7a4a6b',
      5: '#3d7a6e',
      6: '#c2703f',
      7: '#b5542f',
      8: '#5b6b3f',
    },
  },
}

// MOP-0029 Phase 4 — persisted-state migration for the v0 -> v1 schema
// change (ColorScheme gained required surface/accentCategory/gradient/viz
// fields). Extracted as a standalone, exported, pure function (rather than
// staying inline in the `persist` config) so it's directly unit-testable
// without driving it through zustand's actual localStorage rehydration
// machinery. Backfills every persisted scheme using its own built-in
// preset's new ramps where the name matches (Evergreen/Forest/Ocean/Sunset),
// or falls back to Evergreen's ramps for an unrecognized custom name.
export function migrateThemeStoreState(
  persistedState: unknown,
  version: number
): ThemeState {
  const state = persistedState as {
    theme?: Theme
    colorScheme?: ColorScheme
    availableColorSchemes?: Record<string, ColorScheme>
  }

  if (version >= 1) {
    return state as ThemeState
  }

  const backfillScheme = (scheme: ColorScheme | undefined): ColorScheme | undefined => {
    if (!scheme) return scheme
    const currentByName =
      scheme.name === defaultColorScheme.name
        ? defaultColorScheme
        : alternativeSchemes[scheme.name]
    const source = currentByName ?? defaultColorScheme
    return {
      ...scheme,
      surface: scheme.surface ?? source.surface,
      accentCategory: scheme.accentCategory ?? source.accentCategory,
      gradient: scheme.gradient ?? source.gradient,
      viz: scheme.viz ?? source.viz,
    }
  }

  const migratedAvailable: Record<string, ColorScheme> = {}
  if (state.availableColorSchemes) {
    for (const [key, scheme] of Object.entries(state.availableColorSchemes)) {
      const backfilled = backfillScheme(scheme)
      if (backfilled) migratedAvailable[key] = backfilled
    }
  }

  return {
    ...state,
    colorScheme: backfillScheme(state.colorScheme) ?? defaultColorScheme,
    availableColorSchemes:
      Object.keys(migratedAvailable).length > 0
        ? migratedAvailable
        : { Evergreen: defaultColorScheme, ...alternativeSchemes },
  } as ThemeState
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
      // MOP-0029 Phase 4 — bumped from the implicit v0 because ColorScheme
      // gained required `surface` / `accentCategory` / `gradient` / `viz`
      // fields. Without a migration, persisted state from before this change
      // would hydrate with those ramps `undefined`.
      version: 1,
      migrate: migrateThemeStoreState,
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

// Convert hex to a space-separated "R G B" channel triplet (0-255 each),
// the format Tailwind's `rgb(var(--x) / <alpha-value>)` color functions
// expect (MOP-0029 Phase 4). Needed because Tailwind cannot resolve an
// opacity modifier (e.g. `border-stone-200/80`, used today by `.card` in
// index.css via `@apply`) against a CSS var holding a plain hex string —
// its color parser can't combine an arbitrary var() with an alpha channel,
// and `@apply` throws a build error rather than degrading silently. Wrapping
// the var in `rgb(... / <alpha-value>)` and feeding it R/G/B channel numbers
// is Tailwind's documented pattern for CSS-var-driven colors that must
// support opacity modifiers.
function hexToRGBTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
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

  // MOP-0029 Phase 4 — surface ramp. Genuinely distinct light/dark ramps
  // (not a formulaic derivation), so pick the ramp matching the current
  // .dark class state rather than adjusting lightness.
  // Sets both the plain-hex var (consumed by --rs-* aliases, gradient
  // composites, and anywhere a raw color is needed) and the "-rgb" channel
  // triplet var (consumed by the surface-*/stone-* Tailwind color functions
  // so opacity modifiers like `border-stone-200/80` keep working — see
  // hexToRGBTriplet()).
  const surfaceRamp = isDark ? scheme.surface.dark : scheme.surface
  ;([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const).forEach((shade) => {
    const hex = surfaceRamp[shade]
    root.style.setProperty(`--surface-${shade}`, hex)
    root.style.setProperty(`--surface-${shade}-rgb`, hexToRGBTriplet(hex))
  })

  // MOP-0029 Phase 4 — accent-category ramp. Same in light and dark per the
  // approved spec ("same" in every preset's row) — no isDark branching.
  root.style.setProperty('--accent-cat-1', scheme.accentCategory[1])
  root.style.setProperty('--accent-cat-2', scheme.accentCategory[2])
  root.style.setProperty('--accent-cat-3', scheme.accentCategory[3])
  root.style.setProperty('--accent-cat-4', scheme.accentCategory[4])
  root.style.setProperty('--accent-cat-5', scheme.accentCategory[5])
  root.style.setProperty('--accent-cat-6', scheme.accentCategory[6])

  // MOP-0029 Phase 4 — named gradients. Same in light and dark per spec.
  root.style.setProperty('--gradient-brand-from', scheme.gradient.brand.from)
  root.style.setProperty('--gradient-brand-to', scheme.gradient.brand.to)
  root.style.setProperty('--gradient-warm-from', scheme.gradient.warm.from)
  root.style.setProperty('--gradient-warm-to', scheme.gradient.warm.to)
  root.style.setProperty('--gradient-subtle-from', scheme.gradient.subtle.from)
  root.style.setProperty('--gradient-subtle-to', scheme.gradient.subtle.to)
  // MOP-0029 Phase 8 — "-rgb" channel-triplet twins of the warm gradient
  // stops, same rationale as --surface-*-rgb above: GroceryCart.tsx's
  // empty-state icon tint needs an opacity-modified gradient stop
  // (`from-[...]/10`), and Tailwind's arbitrary-value parser cannot derive
  // an alpha channel from a plain hex-string var() reference (confirmed by
  // direct testing — the class is silently dropped, not merely wrong).
  // Only `warm` needs this twin today; brand/subtle have no opacity-modified
  // consumer yet.
  root.style.setProperty('--gradient-warm-from-rgb', hexToRGBTriplet(scheme.gradient.warm.from))
  root.style.setProperty('--gradient-warm-to-rgb', hexToRGBTriplet(scheme.gradient.warm.to))

  // MOP-0029 Phase 8 — --shadow-accent (COLOR_SCHEMA.md §8). The two
  // confirmed shadow-amber-500/20|25 exceptions (GroceryCart.tsx, Admin.tsx)
  // both sit on a --gradient-warm icon badge, so the glow is derived from
  // that same color rather than introducing an unrelated accent. COLOR_SCHEMA
  // §8 treats accent-tinted shadows as an approved exception, not the
  // default (shadows stay neutral black everywhere else) — this is the one
  // named token that exception is allowed to use, not a general pattern to
  // repeat elsewhere.
  root.style.setProperty('--shadow-accent', `rgba(${hexToRGBTriplet(scheme.gradient.warm.from).replace(/ /g, ', ')}, 0.25)`)
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
