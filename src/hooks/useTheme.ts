import { useThemeStore, selectCurrentTheme, selectIsDark, selectIsLight } from '@/stores/themeStore';

export const useTheme = () => {
  const {
    theme,
    colorScheme,
    availableColorSchemes,
    setTheme,
    setColorScheme,
    addColorScheme,
    removeColorScheme,
  } = useThemeStore();
  const currentTheme = useThemeStore(selectCurrentTheme);
  const isDark = useThemeStore(selectIsDark);
  const isLight = useThemeStore(selectIsLight);

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
