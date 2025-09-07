# Theme System Documentation

## Overview
This document defines the centralized color system for the MealPrep Agent application. The theme system is built using Zustand for state management and provides dynamic color schemes with proper light/dark mode support. All UI components should use these predefined color tokens to maintain consistency and proper theming support.

## Architecture

### State Management
- **Zustand Store**: `src/stores/themeStore.ts` - Central theme state management
- **Theme Provider**: `src/providers/ThemeProvider.tsx` - React context provider
- **CSS Variables**: Dynamic color application through CSS custom properties
- **Persistence**: Theme preferences are automatically saved to localStorage

### Key Features
- ✅ Dynamic color schemes (Ocean, Forest, Sunset)
- ✅ Light/Dark/System theme modes
- ✅ Real-time theme switching
- ✅ Persistent theme preferences
- ✅ System theme detection
- ✅ CSS variable-based color application

## Color Palette

### Primary Colors (Blue)
- **Primary-50**: `#f0f9ff` - Very light blue (backgrounds, hover states)
- **Primary-100**: `#e0f2fe` - Light blue (subtle backgrounds)
- **Primary-200**: `#bae6fd` - Soft blue (borders, dividers)
- **Primary-300**: `#7dd3fc` - Medium light blue (icons, accents)
- **Primary-400**: `#38bdf8` - Medium blue (secondary actions)
- **Primary-500**: `#0ea5e9` - Standard blue (main brand color)
- **Primary-600**: `#0284c7` - Dark blue (buttons, links)
- **Primary-700**: `#0369a1` - Darker blue (hover states)
- **Primary-800**: `#075985` - Very dark blue (active states)
- **Primary-900**: `#0c4a6e` - Darkest blue (text on light backgrounds)

### Secondary Colors (Purple/Pink)
- **Secondary-50**: `#fdf4ff` - Very light purple (backgrounds)
- **Secondary-100**: `#fae8ff` - Light purple (subtle backgrounds)
- **Secondary-200**: `#f5d0fe` - Soft purple (borders)
- **Secondary-300**: `#f0abfc` - Medium light purple (icons)
- **Secondary-400**: `#e879f9` - Medium purple (accents)
- **Secondary-500**: `#d946ef` - Standard purple (secondary brand)
- **Secondary-600**: `#c026d3` - Dark purple (buttons)
- **Secondary-700**: `#a21caf` - Darker purple (hover states)
- **Secondary-800**: `#86198f` - Very dark purple (active states)
- **Secondary-900**: `#701a75` - Darkest purple (text on light backgrounds)

### Neutral Colors (Gray Scale)
- **Gray-50**: `#f9fafb` - Very light gray (page backgrounds)
- **Gray-100**: `#f3f4f6` - Light gray (card backgrounds, hover states)
- **Gray-200**: `#e5e7eb` - Soft gray (borders, dividers)
- **Gray-300**: `#d1d5db` - Medium light gray (disabled states)
- **Gray-400**: `#9ca3af` - Medium gray (placeholder text)
- **Gray-500**: `#6b7280` - Standard gray (secondary text)
- **Gray-600**: `#4b5563` - Dark gray (body text)
- **Gray-700**: `#374151` - Darker gray (headings)
- **Gray-800**: `#1f2937` - Very dark gray (dark mode backgrounds)
- **Gray-900**: `#111827` - Darkest gray (dark mode text)

### Semantic Colors

#### Success (Green)
- **Green-100**: `#dcfce7` - Light green (success backgrounds)
- **Green-800**: `#166534` - Dark green (success text)
- **Green-900**: `#14532d` - Darker green (dark mode success)

#### Error/Destructive (Red)
- **Red-500**: `#ef4444` - Standard red (error states)
- **Red-600**: `#dc2626` - Dark red (error text)

#### Warning (Yellow/Orange)
- **Yellow-100**: `#fef3c7` - Light yellow (warning backgrounds)
- **Yellow-800**: `#92400e` - Dark yellow (warning text)

## Theme Tokens

### Background Colors
- **Page Background**: `bg-gray-50 dark:bg-gray-900`
- **Card Background**: `bg-white dark:bg-gray-800`
- **Input Background**: `bg-background` (CSS variable)
- **Muted Background**: `bg-gray-100 dark:bg-gray-800`
- **Primary Background**: `bg-primary-600`
- **Secondary Background**: `bg-gray-200 dark:bg-gray-700`

### Text Colors
- **Primary Text**: `text-gray-900 dark:text-gray-100`
- **Secondary Text**: `text-gray-600 dark:text-gray-300`
- **Muted Text**: `text-gray-500 dark:text-gray-400`
- **Primary Brand Text**: `text-primary-600 dark:text-primary-400`
- **White Text**: `text-white`
- **Error Text**: `text-destructive` (CSS variable)

### Border Colors
- **Standard Border**: `border-gray-200 dark:border-gray-700`
- **Input Border**: `border-input` (CSS variable)
- **Primary Border**: `border-primary-500`

### Interactive States
- **Hover Background**: `hover:bg-gray-200 dark:hover:bg-gray-600`
- **Focus Ring**: `focus-visible:ring-2 focus-visible:ring-ring`
- **Disabled**: `disabled:opacity-50`

## Component-Specific Colors

### Buttons
- **Primary Button**: `bg-primary-600 hover:bg-primary-700 text-white`
- **Secondary Button**: `bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100`
- **Outline Button**: `border border-input hover:bg-accent hover:text-accent-foreground`
- **Ghost Button**: `hover:bg-accent hover:text-accent-foreground`
- **Destructive Button**: `bg-destructive text-destructive-foreground hover:bg-destructive/90`

### Form Elements
- **Input Field**: `bg-background border-input text-gray-900 dark:text-gray-100`
- **Textarea**: `bg-background border-input text-gray-900 dark:text-gray-100`
- **Select**: `bg-background border-input text-gray-900 dark:text-gray-100`
- **Placeholder**: `placeholder:text-muted-foreground`

### Cards
- **Card Container**: `bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`
- **Card Header**: Inherits from card container
- **Card Content**: Inherits from card container

### Navigation
- **Header Background**: `bg-white dark:bg-gray-800`
- **Active Link**: `text-primary-600 dark:text-primary-400`
- **Inactive Link**: `text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white`

### Chat Interface
- **User Message**: `bg-primary text-white`
- **AI Message**: `bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100`
- **Message Timestamp**: `text-gray-600 dark:text-gray-400`
- **Loading State**: `bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100`

### Recipe Components
- **Difficulty Badge - Easy**: `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`
- **Difficulty Badge - Medium**: `bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`
- **Difficulty Badge - Hard**: `bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`
- **Difficulty Badge - Default**: `bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`

## CSS Variables (Shadcn/ui Style)
These should be defined in the CSS for proper theming:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 84% 4.9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 84% 4.9%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 94.1%;
}
```

## Usage Guidelines

### Using the Theme System

#### In Components
```tsx
import { useTheme } from '../providers/ThemeProvider'

const MyComponent = () => {
  const { theme, currentTheme, isDark, colorScheme, setTheme, setColorScheme } = useTheme()
  
  return (
    <div className="bg-white dark:bg-gray-800">
      <p className="text-gray-900 dark:text-gray-100">
        Current theme: {currentTheme}
      </p>
      <button onClick={() => setTheme('dark')}>
        Switch to Dark
      </button>
      <button onClick={() => setColorScheme('Forest')}>
        Switch to Forest Theme
      </button>
    </div>
  )
}
```

#### Theme Toggle Component
```tsx
import { ThemeToggle, ColorSchemeSelector } from '../components/ui/ThemeToggle'

// Simple toggle button
<ThemeToggle />

// Full theme selector
<ThemeToggle variant="select" />

// Color scheme selector
<ColorSchemeSelector />
```

### Do's
- ✅ Use semantic color tokens (e.g., `text-primary-600` instead of `text-blue-600`)
- ✅ Always include dark mode variants for text and backgrounds
- ✅ Use the predefined color scale (50-900) for consistent spacing
- ✅ Use CSS variables for shadcn/ui components
- ✅ Test colors in both light and dark modes
- ✅ Use the `useTheme` hook for theme-aware components
- ✅ Use the theme store for programmatic theme changes

### Don'ts
- ❌ Don't use arbitrary color values (e.g., `text-[#ff0000]`)
- ❌ Don't use colors outside the defined palette
- ❌ Don't forget dark mode variants
- ❌ Don't use hardcoded colors in components
- ❌ Don't directly manipulate CSS variables - use the theme store
- ❌ Don't create custom theme contexts - use the provided Zustand store

### Migration Checklist
- [ ] Replace all hardcoded colors with theme tokens
- [ ] Add dark mode variants where missing
- [ ] Update CSS variables in index.css
- [ ] Test all components in both themes
- [ ] Update Tailwind config with missing colors
- [ ] Document any new color requirements

## Color Accessibility
All color combinations should meet WCAG 2.1 AA contrast requirements:
- Normal text: 4.5:1 minimum contrast ratio
- Large text: 3:1 minimum contrast ratio
- UI components: 3:1 minimum contrast ratio

Test colors using tools like:
- WebAIM Contrast Checker
- Stark Contrast Checker
- Browser DevTools Accessibility panel
