import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

export const THEME_STORAGE_KEY = 'my-holdings-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'auto';

// default auto
export const readStoredTheme = (): Theme => {
  try {
    return isTheme(localStorage.getItem(THEME_STORAGE_KEY))
      ? (localStorage.getItem(THEME_STORAGE_KEY) as Theme)
      : 'auto';
  } catch {
    return 'auto';
  }
};

const prefersDark = (): boolean => window.matchMedia(DARK_QUERY).matches;

export const resolveIsDark = (theme: Theme): boolean =>
  theme === 'dark' || (theme === 'auto' && prefersDark());

// Reflects the effective theme onto <html>: Tailwind reads the `dark` class,
// and `color-scheme` makes native UI (form controls, scrollbars, caret) match.
export const applyTheme = (theme: Theme): void => {
  const isDark = resolveIsDark(theme);
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
};

// Owns the theme preference: applies it to the document, persists changes, and
// keeps "auto" in sync with the OS as it changes.
export const useTheme = (): { theme: Theme; setTheme: (next: Theme) => void } => {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'auto') return;
    const query = window.matchMedia(DARK_QUERY);
    const handleChange = () => applyTheme('auto');
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures (e.g. private mode); the in-memory state still
      // updates so the UI stays responsive for the session.
    }
    setThemeState(next);
  }, []);

  return { theme, setTheme };
};
