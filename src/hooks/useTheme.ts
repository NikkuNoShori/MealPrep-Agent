import { useThemeStore } from '@/stores/themeStore';

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
  } = useThemeStore();

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
  };
};
