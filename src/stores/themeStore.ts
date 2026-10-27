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
  // `neutral` (-> --gray-*) gained a `dark` sub-ramp 2026-10-20, mirroring
  // `surface.dark` below. Found live: applyColorSchemeToCSS wrote this ramp
  // with zero light/dark branching, so every `dark:text-gray-*` site (150+
  // call sites — chat, modals, dashboard widgets, grocery cart) rendered
  // the LIGHT-mode value even in dark mode, regardless of how dark that
  // mode's page background was. A 2026-10-18 fix lightened the CSS
  // fallback for 500/600 only, but JS overwrote it back on every load —
  // never actually took effect. Only 100-500 get a dark variant: 600-900
  // are also used as dark-mode backgrounds/borders (confirmed via grep —
  // e.g. `border-surface-300 dark:border-gray-600`, `dark:bg-gray-800/900`
  // card surfaces) where the original darker value is exactly what's
  // wanted, so those stay identical to light mode as before.
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
    dark: {
      100: string
      200: string
      300: string
      400: string
      500: string
      // 600-900 are dark-mode BACKGROUNDS/BORDERS (cards, chat bubbles, dividers), tinted per preset so
      // they match the surface family instead of the cool Tailwind slate/navy the light gray ramp implies.
      600: string
      700: string
      800: string
      900: string
    }
  }
  // Contrast-guaranteed text tiers per mode + accessible brand color. These are the ONLY
  // sanctioned sources for text color (text-fg / text-fg-secondary / text-fg-muted /
  // text-fg-faint / text-brand). Raw surface-*/gray-* ramps are background/border ramps.
  fg: {
    // control = form-field border colour (WCAG 1.4.11: >= 3:1 against the surface the field sits on). Wired to --input.
    light: { primary: string; secondary: string; muted: string; faint: string; control: string }
    dark: { primary: string; secondary: string; muted: string; faint: string; control: string }
  }
  brand: { light: string; dark: string }
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
}

// Derived values — intentionally NOT stored on ThemeState. Zustand's set()
// does Object.assign(state, partial) internally, which flattens a `get x()`
// accessor into a frozen plain value on the very first set() call (MOP-0029
// qa-auditor finding, 2026-10-11: after the first setTheme()/setSystemTheme(),
// currentTheme/isDark/isLight stopped updating on every toggle after). Use
// these as Zustand selectors instead: useThemeStore(selectCurrentTheme).
export function selectCurrentTheme(state: ThemeState): 'light' | 'dark' {
  return state.theme === 'system' ? state.systemTheme : state.theme
}
export function selectIsDark(state: ThemeState): boolean {
  return selectCurrentTheme(state) === 'dark'
}
export function selectIsLight(state: ThemeState): boolean {
  return selectCurrentTheme(state) === 'light'
}

// Default color scheme — warm emerald + amber
const defaultColorScheme: ColorScheme = {
  name: 'Evergreen',
  // 2026-10-20 contrast contract: 500 is the AA-safe solid fill (white text) and
  // light-mode brand text; 400 is the dark-mode brand text/fill. See fg/brand below.
  primary: {
    50: '#f5f9f8',
    100: '#e9f1ef',
    200: '#c9e9df',
    300: '#9ad5c3',
    400: '#23c190',
    500: '#157356',
    600: '#115c45',
    700: '#0d4735',
    800: '#0a3528',
    900: '#06231a',
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
    dark: {
      100: '#d1d5dc',
      200: '#b5bcc7',
      300: '#99a3b1',
      400: '#7a889a',
      500: '#8995a6',
      600: '#44403c',
      700: '#3a352e',
      800: '#292524',
      900: '#1c1917',
    },
  },
  // Contrast-guaranteed text tiers + brand color per mode (enforced by themeStore.contrast.test.ts).
  fg: {
    light: {
      primary: '#1c1917',
      secondary: '#57534e',
      muted: '#69655f',
      faint: '#878079',
      control: '#8f8982',
    },
    dark: {
      primary: '#fcfbfb',
      secondary: '#d1d0cf',
      muted: '#a7a4a2',
      faint: '#7f7b78',
      control: '#706c69',
    },
  },
  brand: { light: '#157356', dark: '#23c190' },
  semantic: {
    success: {
      100: '#dcfce7',
      800: '#166534',
      900: '#14532d',
    },
    error: {
      500: '#f87171', // dark-mode error: text on its own tint was 4.4:1 at #ef4444
      600: '#a91b1b', // AA as text on its own 10% tint on every preset (#dc2626 measured 4.1:1) and >6:1 with white text as a fill
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
      // 200/300 lightened 2026-10-20 — same WCAG AA failure as 400/500 below,
      // found via the same codebase sweep: this ramp was authored purely as
      // background-depth steps (50 darkest -> 900 lightest), but 47 call
      // sites across 17 files pair it with light-mode text classes as a
      // dark-mode TEXT color (e.g. `text-surface-700 dark:text-surface-200`,
      // `text-surface-600 dark:text-surface-300` -- the landing page's
      // "Sign in" button used the latter, confirmed unreadable ~1.9:1).
      // Confirmed unused as a dark-mode background/border/ring anywhere in
      // the app (grepped), so raising these is safe. New values preserve the
      // intended hierarchy relative to the already-fixed 400/500/600 (200 >
      // 300 > 600 > 500 > 400 in brightness): 200 ~13:1 (pairs with
      // high-emphasis light-700), 300 ~7:1 (pairs with medium light-600).
      200: '#d8d4cf',
      300: '#a39b92',
      // 400/500 lightened 2026-10-19 — see matching comment in index.css.
      // Original values (#57534e, #78716c) measured 2.15-3.74:1 contrast as
      // text against this app's actual dark surfaces, failing WCAG AA.
      400: '#8c857f',
      500: '#9c958e',
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
    // Primary ramp replaced 2026-10-20 ("Warm pantry" design) — a sage
    // green brand accent (exact value at 500) in place of the original
    // saturated Tailwind green, applied in both light and dark mode per
    // user decision (primary has no light/dark split in this schema; dark
    // mode derives from this ramp algorithmically via adjustHSLLightness).
    // 2026-10-20 contrast contract: 500 is the AA-safe solid fill (white text) and
    // light-mode brand text; 400 is the dark-mode brand text/fill. See fg/brand below.
    primary: {
      50: '#f6f8f7',
      100: '#ebf0ed',
      200: '#d0e2d8',
      300: '#a7c8b6',
      400: '#65bb8b',
      500: '#2F6B4A',
      600: '#26563b',
      700: '#1d422e',
      800: '#163122',
      900: '#0e2016',
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
      dark: {
        100: '#d1d5dc',
        200: '#b5bcc7',
        300: '#99a3b1',
        400: '#7a889a',
        500: '#8995a6',
        600: '#363b27',
        700: '#282c1d',
        800: '#1e2116',
        900: '#14150f',
      },
    },
    // Contrast-guaranteed text tiers + brand color per mode (enforced by themeStore.contrast.test.ts).
    fg: {
      light: {
        primary: '#2A251F',
        secondary: '#595146',
        muted: '#685d51',
        faint: '#857868',
        control: '#897c6c',
      },
      dark: {
        primary: '#fbfcfb',
        secondary: '#ced1c6',
        muted: '#a2a791',
        faint: '#787e65',
        control: '#6a6f59',
      },
    },
    brand: { light: '#2F6B4A', dark: '#65bb8b' },
    semantic: {
      success: {
        100: '#dcfce7',
        800: '#166534',
        900: '#14532d',
      },
      error: {
        500: '#f87171', // dark-mode error: text on its own tint was 4.4:1 at #ef4444
        600: '#a91b1b', // AA as text on its own 10% tint on every preset (#dc2626 measured 4.1:1) and >6:1 with white text as a fill
      },
      warning: {
        100: '#fef3c7',
        800: '#92400e',
      },
    },
    // Light surface ramp replaced 2026-10-20 ("Warm pantry" design) — the
    // user's own designed replacement for the original Forest light ramp,
    // which caused eye strain/glare. Anchors (Page/Border/Secondary-text/
    // Text) are the designer-specified hex values; 100/200/400/700/800 are
    // interpolated between those anchors and 500 is solved to hit ~4.8:1
    // contrast against white (the "muted text" tier, same AA bar as the
    // rest of this session's contrast sweep) rather than linearly
    // interpolated, which measured only 3.3:1. dark sub-ramp untouched.
    surface: {
      50: '#EFE9DF',
      100: '#e9e2d6',
      200: '#e3dacd',
      300: '#DDD3C4',
      400: '#ada293',
      500: '#7d7162',
      600: '#5C5348',
      700: '#4b443a',
      800: '#3b342d',
      900: '#2A251F',
      dark: {
        50: '#14150f',
        100: '#1e2116',
        // 200/300/400/500 lightened 2026-10-20 — same WCAG AA sweep as
        // Evergreen (see themeStore.ts's Evergreen surface.dark comment and
        // index.css): these were background-depth steps repurposed as
        // dark-mode text, measuring 1.1-3.8:1 contrast. New values keep
        // Forest's hue (~73°) and target the same contrast tiers used for
        // Evergreen (200 ~13:1, 300 ~7:1, 400 ~5.3:1, 500 ~5.8:1, all
        // against this app's actual dark page/card backgrounds).
        200: '#d2d7c4',
        300: '#97a176',
        400: '#828b60',
        500: '#889365',
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
    // Primary ramp replaced 2026-10-20 ("Slate and saffron" design) — a
    // warm saffron/amber brand accent (exact value at 500) in place of
    // the original blue, applied in both light and dark mode per user
    // decision. Note: 500 measures 4.23:1 against white — passes AA for
    // large/bold text and icons (3:1) but is slightly under the 4.5:1 bar
    // for small plain text; flagged, not altered, since it's the exact
    // user-specified value.
    // 2026-10-20 contrast contract: 500 is the AA-safe solid fill (white text) and
    // light-mode brand text; 400 is the dark-mode brand text/fill. See fg/brand below.
    primary: {
      50: '#faf8f5',
      100: '#f2eee8',
      200: '#ebdac6',
      300: '#dabb95',
      400: '#ea9835',
      500: '#87500e',
      600: '#6c400b',
      700: '#543209',
      800: '#3e2506',
      900: '#291804',
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
      dark: {
        100: '#cfd6df',
        200: '#b2bdcb',
        300: '#95a4b8',
        400: '#7688a2',
        500: '#8596ad',
        600: '#2a3142',
        700: '#1e2330',
        800: '#161a24',
        900: '#0e1016',
      },
    },
    // Contrast-guaranteed text tiers + brand color per mode (enforced by themeStore.contrast.test.ts).
    fg: {
      light: {
        primary: '#1C2630',
        secondary: '#455260',
        muted: '#505f6f',
        faint: '#677a8e',
        control: '#6a7e93',
      },
      dark: {
        primary: '#fbfcfc',
        secondary: '#ccd0d6',
        muted: '#9da5b1',
        faint: '#707d8e',
        control: '#636e7d',
      },
    },
    brand: { light: '#87500e', dark: '#ea9835' },
    semantic: {
      success: {
        100: '#dcfce7',
        800: '#166534',
        900: '#14532d',
      },
      error: {
        500: '#f87171', // dark-mode error: text on its own tint was 4.4:1 at #ef4444
        600: '#a91b1b', // AA as text on its own 10% tint on every preset (#dc2626 measured 4.1:1) and >6:1 with white text as a fill
      },
      warning: {
        100: '#fef3c7',
        800: '#92400e',
      },
    },
    // Light surface ramp replaced 2026-10-20 ("Slate and saffron" design) —
    // same methodology as Forest's: designer-specified anchors (Page/
    // Border/Secondary-text/Text), 500 solved for ~4.8:1 contrast against
    // white rather than linearly interpolated (which only hit 3.2:1).
    surface: {
      50: '#E4E8EC',
      100: '#dce1e6',
      200: '#d3d9e0',
      300: '#CBD2DA',
      400: '#97a4b1',
      500: '#627587',
      600: '#4A5866',
      700: '#3b4754',
      800: '#2b3742',
      900: '#1C2630',
      dark: {
        50: '#0e1016',
        100: '#161a24',
        // 200/300/400/500 lightened 2026-10-20 — same WCAG AA sweep as
        // Evergreen/Forest. Keeps Ocean's hue (~223°).
        200: '#d0d5e0',
        300: '#929db6',
        400: '#7a87a6',
        500: '#7b88a7',
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
    // 2026-10-20 contrast contract: 500 is the AA-safe solid fill (white text) and
    // light-mode brand text; 400 is the dark-mode brand text/fill. See fg/brand below.
    primary: {
      50: '#faf7f5',
      100: '#f3ece7',
      200: '#efd5c3',
      300: '#e0b18f',
      400: '#fa8f42',
      500: '#a14504',
      600: '#813703',
      700: '#642b02',
      800: '#4a2002',
      900: '#301501',
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
      dark: {
        100: '#d1d5dc',
        200: '#b5bcc7',
        300: '#99a3b1',
        400: '#7a889a',
        500: '#8995a6',
        600: '#4f3722',
        700: '#382719',
        800: '#291d13',
        900: '#1a120c',
      },
    },
    // Contrast-guaranteed text tiers + brand color per mode (enforced by themeStore.contrast.test.ts).
    fg: {
      light: {
        primary: '#2c1c12',
        secondary: '#7c4f31',
        muted: '#855635',
        faint: '#aa6d44',
        control: '#b8784d',
      },
      dark: {
        primary: '#fcfbfb',
        secondary: '#dacec1',
        muted: '#b9a088',
        faint: '#937658',
        control: '#82684d',
      },
    },
    brand: { light: '#a14504', dark: '#fa8f42' },
    semantic: {
      success: {
        100: '#dcfce7',
        800: '#166534',
        900: '#14532d',
      },
      error: {
        500: '#f87171', // dark-mode error: text on its own tint was 4.4:1 at #ef4444
        600: '#a91b1b', // AA as text on its own 10% tint on every preset (#dc2626 measured 4.1:1) and >6:1 with white text as a fill
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
      // 500 darkened 2026-10-20 — same light-mode AA sweep as Forest/
      // Botanical. Original value measured 3.71:1 against white.
      500: '#9a6741',
      600: '#8f5c39',
      700: '#6d452c',
      800: '#492e1d',
      900: '#2c1c12',
      dark: {
        50: '#1a120c',
        100: '#291d13',
        // 200/300/400/500 lightened 2026-10-20 — same WCAG AA sweep as
        // Evergreen/Forest/Ocean. Keeps Sunset's hue (~29°).
        200: '#e5d2bf',
        300: '#c29467',
        400: '#b27b47',
        500: '#b9834f',
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
    // Primary/secondary replaced 2026-10-20 ("Herb garden" design) — olive
    // green (exact value at 500) as the primary brand accent, tomato-red
    // (exact value at 500) as the secondary "highlight" accent, applied
    // in both light and dark mode per user decision (no dark/light split
    // for these ramps; dark mode derives algorithmically).
    // 2026-10-20 contrast contract: 500 is the AA-safe solid fill (white text) and
    // light-mode brand text; 400 is the dark-mode brand text/fill. See fg/brand below.
    primary: {
      50: '#f8f8f6',
      100: '#eef0eb',
      200: '#dae2cf',
      300: '#bbc9a6',
      400: '#8eb753',
      500: '#4e662b',
      600: '#3e5222',
      700: '#303f1b',
      800: '#242f14',
      900: '#171f0d',
    },
    secondary: {
      50: '#f9f6f6',
      100: '#f1ebe9',
      200: '#e6d0cb',
      300: '#d1a89e',
      400: '#d36c55',
      500: '#B5482F',
      600: '#913a26',
      700: '#702d1d',
      800: '#532116',
      900: '#36160e',
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
      dark: {
        100: '#dbd4cd',
        200: '#c5baaf',
        300: '#afa091',
        400: '#988371',
        500: '#a39180',
        600: '#332a1e',
        700: '#241d15',
        800: '#1d1811',
        900: '#161310',
      },
    },
    // Contrast-guaranteed text tiers + brand color per mode (enforced by themeStore.contrast.test.ts).
    fg: {
      light: {
        primary: '#1F241B',
        secondary: '#4b5544',
        muted: '#57624f',
        faint: '#707e66',
        control: '#748269',
      },
      dark: {
        primary: '#fcfbfb',
        secondary: '#d5cfc7',
        muted: '#ada393',
        faint: '#867a66',
        control: '#776b5a',
      },
    },
    brand: { light: '#4e662b', dark: '#8eb753' },
    semantic: {
      success: {
        100: '#dcfce7',
        800: '#166534',
        900: '#14532d',
      },
      error: {
        500: '#f87171', // dark-mode error: text on its own tint was 4.4:1 at #ef4444
        600: '#a91b1b', // AA as text on its own 10% tint on every preset (#dc2626 measured 4.1:1) and >6:1 with white text as a fill
      },
      warning: {
        100: '#fef3c7',
        800: '#92400e',
      },
    },
    // Light surface ramp replaced 2026-10-20 ("Herb garden" design) — same
    // methodology as Forest/Ocean: designer-specified anchors (Page/
    // Border/Secondary-text/Text), 500 solved for ~4.8:1 contrast against
    // white rather than linearly interpolated (which only hit 3.2:1).
    surface: {
      50: '#E7EBE2',
      100: '#dfe4d8',
      200: '#d6ddcf',
      300: '#CED6C5',
      400: '#9ca793',
      500: '#697760',
      600: '#4E5847',
      700: '#3e4738',
      800: '#2f352a',
      900: '#1F241B',
      dark: {
        50: '#161310',
        100: '#1d1811',
        // 200/300/400/500 lightened 2026-10-20 — same WCAG AA sweep as
        // Evergreen/Forest/Ocean/Sunset. Keeps Botanical's hue (~35°).
        200: '#dcd4c8',
        300: '#ad9a7e',
        400: '#9a8463',
        500: '#a38e6f',
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

// Persisted shape (v3+): only the user's CHOICES are stored — the light/dark
// mode and the preset NAME. The palette itself is always resolved from the
// code-defined presets on load. Earlier versions (v0-v2) persisted the entire
// ColorScheme object, so a browser that had ever saved settings kept serving
// that stale snapshot and silently ignored every later palette/contrast fix
// shipped in code. Presets are application data, not user data.
export interface PersistedThemeState {
  theme?: Theme
  colorSchemeName?: string
}

export function migrateThemeStoreState(
  persistedState: unknown,
  _version: number
): PersistedThemeState {
  const state = (persistedState ?? {}) as {
    theme?: Theme
    colorSchemeName?: string
    colorScheme?: { name?: string }
  }
  return {
    theme: state.theme,
    colorSchemeName: state.colorSchemeName ?? state.colorScheme?.name,
  }
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

    }),
    {
      name: "theme-store",
      // v3: persist only { theme, colorSchemeName } (see PersistedThemeState).
      version: 3,
      migrate: migrateThemeStoreState,
      partialize: (state): PersistedThemeState => ({
        theme: state.theme,
        colorSchemeName: state.colorScheme.name,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as PersistedThemeState
        const scheme = p.colorSchemeName ? current.availableColorSchemes[p.colorSchemeName] : undefined
        return { ...current, theme: p.theme ?? current.theme, colorScheme: scheme ?? current.colorScheme }
      },
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

// ── Contrast helpers (WCAG 2.x relative luminance) ──
// Exported so the contrast-contract unit test and any future tooling use the
// exact same math as the runtime foreground-selection below.
function channelToLinear(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
// Near-black used for text on bright fills. Not pure #000 — keeps the UI soft.
const ON_COLOR_DARK = '#0b0d10'
const ON_COLOR_LIGHT = '#ffffff'
/** The text color (white or near-black) that reads better on a given fill. */
export function onColor(fillHex: string): string {
  return contrastRatio(ON_COLOR_LIGHT, fillHex) >= contrastRatio(ON_COLOR_DARK, fillHex)
    ? ON_COLOR_LIGHT
    : ON_COLOR_DARK
}
function hexToHslTuple(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      default: h = ((r - g) / d + 4) / 6
    }
  }
  return [h, s, l]
}
function hslTupleToHex(h: number, s: number, l: number): string {
  const f = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r: number, g: number, b: number
  if (s === 0) { r = g = b = l } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3)
  }
  return '#' + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}
/** White or near-black, whichever reads better across ALL of the given fills (used for gradients). */
export function onColorForFills(fills: string[]): string {
  const minWith = (fg: string) => Math.min(...fills.map((f) => contrastRatio(fg, f)))
  return minWith(ON_COLOR_LIGHT) >= minWith(ON_COLOR_DARK) ? ON_COLOR_LIGHT : ON_COLOR_DARK
}
/** Hex with its HSL lightness shifted by deltaPercent (clamped 0-100). */
export function shiftLightness(hex: string, deltaPercent: number): string {
  const [h, s, l] = hexToHslTuple(hex)
  return hslTupleToHex(h, s, Math.max(0, Math.min(1, l + deltaPercent / 100)))
}

// Helper function to apply color scheme to CSS custom properties.
// This is the SINGLE apply path (MOP-0029 Phase 2) — ThemeProvider.tsx
// calls this instead of duplicating the logic itself.
export function applyColorSchemeToCSS(scheme: ColorScheme) {
  const root = document.documentElement
  const isDark = root.classList.contains('dark')

  // Apply primary colors (numeric ramp)
  // Every ramp also gets a "-rgb" channel-triplet twin so Tailwind opacity modifiers
  // (bg-primary-500/10, ring-primary-500/30, dark:bg-primary-900/30 ...) work. With plain
  // hex vars Tailwind silently DROPS those utilities — 80+ tints/rings/shadows never rendered.
  Object.entries(scheme.primary).forEach(([shade, color]) => {
    root.style.setProperty(`--primary-${shade}`, color)
    root.style.setProperty(`--primary-${shade}-rgb`, hexToRGBTriplet(color))
  })

  // Apply secondary colors (numeric ramp)
  Object.entries(scheme.secondary).forEach(([shade, color]) => {
    root.style.setProperty(`--secondary-${shade}`, color)
    root.style.setProperty(`--secondary-${shade}-rgb`, hexToRGBTriplet(color))
  })

  // Apply neutral colors. 100-500 are the dark TEXT-capable tiers and 600-900 the preset-tinted dark backgrounds (see the
  // ColorScheme.neutral type comment) — 600-900 stay identical to light
  // mode in both branches since those are also consumed as dark-mode
  // backgrounds/borders where the darker light-mode value is correct.
  ;([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const).forEach((shade) => {
    const color = isDark && shade in scheme.neutral.dark
      ? scheme.neutral.dark[shade as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900]
      : scheme.neutral[shade]
    root.style.setProperty(`--gray-${shade}`, color)
    root.style.setProperty(`--gray-${shade}-rgb`, hexToRGBTriplet(color))
  })

  // Solid "action" fills (shadcn bg-primary / bg-secondary / bg-destructive).
  // The fill comes from the scheme (light: brand.light, dark: brand.dark — both
  // contrast-contract values) and the TEXT on it is computed from the actual
  // fill, never a fixed light/dark constant: the old static foreground tokens
  // were the root cause of white-on-mint buttons and light-on-yellow badges.
  const primaryFill = isDark ? scheme.brand.dark : scheme.brand.light
  const secondaryFill = isDark ? shiftLightness(scheme.secondary[500], 15) : scheme.secondary[500]
  const destructiveFill = isDark ? scheme.semantic.error[500] : scheme.semantic.error[600]
  root.style.setProperty('--primary', hexToHSL(primaryFill))
  root.style.setProperty('--primary-foreground', hexToHSL(onColor(primaryFill)))
  root.style.setProperty('--ring', hexToHSL(primaryFill))
  root.style.setProperty('--secondary', hexToHSL(secondaryFill))
  root.style.setProperty('--secondary-foreground', hexToHSL(onColor(secondaryFill)))
  root.style.setProperty('--destructive-foreground', hexToHSL(onColor(destructiveFill)))

  // Contrast-contract text tiers + brand text color (Tailwind: text-fg,
  // text-fg-secondary, text-fg-muted, text-fg-faint, text-brand).
  const tiers = scheme.fg[isDark ? 'dark' : 'light']
  root.style.setProperty('--fg-rgb', hexToRGBTriplet(tiers.primary))
  root.style.setProperty('--fg-secondary-rgb', hexToRGBTriplet(tiers.secondary))
  root.style.setProperty('--fg-muted-rgb', hexToRGBTriplet(tiers.muted))
  root.style.setProperty('--fg-faint-rgb', hexToRGBTriplet(tiers.faint))
  root.style.setProperty('--brand-rgb', hexToRGBTriplet(primaryFill))
  // shadcn's border-input (every Input/Textarea/Select). Was ~1.2:1 against its surroundings; now >= 3:1.
  root.style.setProperty('--input', hexToHSL(tiers.control))

  // Foreground for glyphs sitting on the decorative warm gradient (header badges etc.).
  root.style.setProperty('--on-warm-rgb', hexToRGBTriplet(onColorForFills([scheme.gradient.warm.from, scheme.gradient.warm.to])))

  // Legacy --rs-accent family now follows the preset (it was a static
  // Evergreen green for every preset) and the same AA-safe fill.
  root.style.setProperty('--rs-accent', primaryFill)
  root.style.setProperty('--rs-accent-hover', isDark ? shiftLightness(primaryFill, 6) : scheme.primary[600])
  root.style.setProperty('--rs-accent-light', isDark ? `rgba(${hexToRGBTriplet(primaryFill).replace(/ /g, ', ')}, 0.14)` : scheme.primary[100])

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
  root.style.setProperty('--destructive', hexToHSL(destructiveFill))

  // Status tokens (success/warning) as HSL, for the alert.tsx status-*
  // Tailwind utilities wired in tailwind.config.js.
  // The 800 shades are LIGHT-mode text colors (dark green/amber on a light page). In dark mode they
  // measured ~1:1 on the page (dark green on near-black), so dark mode must NOT inherit this inline
  // override — removing it lets the .dark rule in index.css (bright status tones) apply.
  if (isDark) {
    root.style.removeProperty('--status-success')
    root.style.removeProperty('--status-warning')
  } else {
    root.style.setProperty('--status-success', hexToHSL(scheme.semantic.success[800]))
    root.style.setProperty('--status-warning', hexToHSL(scheme.semantic.warning[800]))
  }

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
  const state = useThemeStore.getState()
  const currentTheme = selectCurrentTheme(state)
  return {
    scheme: state.colorScheme,
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
