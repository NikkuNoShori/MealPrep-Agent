import React from 'react'
import { Button } from './button'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../../providers/ThemeProvider'
import type { Theme } from '../../stores/themeStore'

interface ThemeToggleProps {
  variant?: 'button' | 'select'
  className?: string
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  variant = 'button', 
  className 
}) => {
  const { theme, setTheme, isDark } = useTheme()

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  const getThemeIcon = () => {
    return isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
  }

  const getThemeLabel = () => {
    return isDark ? 'Light' : 'Dark'
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={className}
      aria-label={`Switch to ${getThemeLabel()} mode`}
    >
      {getThemeIcon()}
    </Button>
  )
}

// Color scheme selector component
export const ColorSchemeSelector: React.FC<{ className?: string }> = ({ className }) => {
  const { colorScheme, availableColorSchemes, setColorScheme } = useTheme()

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {Object.entries(availableColorSchemes).map(([name, scheme]) => (
        <Button
          key={name}
          variant="outline"
          size="sm"
          onClick={() => setColorScheme(name)}
          className={`${
            colorScheme.name === name 
              ? 'bg-primary text-primary-foreground border-primary' 
              : ''
          }`}
        >
          <div 
            className="w-4 h-4 rounded-full mr-2 border border-gray-300"
            style={{ backgroundColor: scheme.primary[500] }}
          />
          {name}
        </Button>
      ))}
    </div>
  )
}
