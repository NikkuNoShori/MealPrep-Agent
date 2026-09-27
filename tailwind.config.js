/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          50: 'var(--secondary-50)',
          100: 'var(--secondary-100)',
          200: 'var(--secondary-200)',
          300: 'var(--secondary-300)',
          400: 'var(--secondary-400)',
          500: 'var(--secondary-500)',
          600: 'var(--secondary-600)',
          700: 'var(--secondary-700)',
          800: 'var(--secondary-800)',
          900: 'var(--secondary-900)',
        },
        // Semantic colors for consistent theming
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        // Status roles (MOP-0029 Phase 3) — wires the previously-dead
        // --success-*/--warning-*/--error-* vars to Tailwind utilities so
        // they are no longer set-but-unconsumed. `error` aliases `destructive`
        // since ColorScheme.semantic.error is the single source of truth for
        // both (COLOR_SCHEMA.md §5).
        status: {
          success: 'hsl(var(--status-success))',
          warning: 'hsl(var(--status-warning))',
          error: 'hsl(var(--destructive))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Dynamic gray scale
        gray: {
          50: 'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          300: 'var(--gray-300)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          600: 'var(--gray-600)',
          700: 'var(--gray-700)',
          800: 'var(--gray-800)',
          900: 'var(--gray-900)',
        },
        // MOP-0029 Phase 4 — surface ramp (page background / card surface /
        // borders). Maps to --surface-* CSS vars, which applyColorSchemeToCSS()
        // in themeStore.ts sets per-preset and per light/dark mode.
        //
        // Uses the `rgb(var(--x-rgb) / <alpha-value>)` function form (each
        // "-rgb" var holds a space-separated R G B channel triplet, e.g.
        // "231 229 228"), NOT a plain `var(--surface-200)` hex reference.
        // Reason: `.card` in index.css does `@apply border-stone-200/80` —
        // Tailwind's @apply pipeline cannot compute an opacity-modified
        // utility from a CSS var holding a hex string (its color parser
        // can't split an alpha channel out of an opaque var() reference) and
        // throws a build error. The rgb()-function form is Tailwind's
        // documented pattern for var-driven colors that must support `/NN`
        // opacity modifiers, and 13 existing stone-*/NN usages need exactly
        // that support.
        surface: {
          50: 'rgb(var(--surface-50-rgb) / <alpha-value>)',
          100: 'rgb(var(--surface-100-rgb) / <alpha-value>)',
          200: 'rgb(var(--surface-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--surface-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--surface-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--surface-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--surface-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--surface-700-rgb) / <alpha-value>)',
          800: 'rgb(var(--surface-800-rgb) / <alpha-value>)',
          900: 'rgb(var(--surface-900-rgb) / <alpha-value>)',
        },
        // Deprecated alias (MOP-0029 Phase 4) — `stone` now resolves to the
        // SAME --surface-*-rgb vars as the `surface` key above, so all
        // existing stone-* usages (878 occurrences / 44 files, including the
        // 13 that use an opacity modifier via `.card`'s `@apply`) keep
        // working unchanged, while new code is expected to use `surface-*`
        // (COLOR_SCHEMA.md G2). Do NOT hardcode hex here again — that would
        // break preset switching for every un-migrated stone-* usage
        // (ADR-0006 alias strategy).
        stone: {
          50: 'rgb(var(--surface-50-rgb) / <alpha-value>)',
          100: 'rgb(var(--surface-100-rgb) / <alpha-value>)',
          200: 'rgb(var(--surface-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--surface-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--surface-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--surface-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--surface-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--surface-700-rgb) / <alpha-value>)',
          800: 'rgb(var(--surface-800-rgb) / <alpha-value>)',
          900: 'rgb(var(--surface-900-rgb) / <alpha-value>)',
        },
        // MOP-0029 Phase 4 — accent-category ramp (COLOR_SCHEMA.md §6).
        // Numeric slots 1-6, matching ColorScheme.accentCategory.
        'accent-cat': {
          1: 'var(--accent-cat-1)',
          2: 'var(--accent-cat-2)',
          3: 'var(--accent-cat-3)',
          4: 'var(--accent-cat-4)',
          5: 'var(--accent-cat-5)',
          6: 'var(--accent-cat-6)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
        'bounce-in': 'bounceIn 0.6s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
    },
  },
  plugins: [],
}
