import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  getTheme,
  THEME_CHANGE_EVENT,
  toggleTheme as toggleThemePref,
  type Theme,
} from '../lib/theme';

/** Live theme preference. Dark is default; persists via localStorage. */
export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
} {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next === 'dark' || next === 'light') setThemeState(next);
    };
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    // Re-sync in case FOUC script and first paint disagreed.
    setThemeState(getTheme());
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = toggleThemePref();
    setThemeState(next);
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' };
}
