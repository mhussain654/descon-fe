import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

const STORAGE_KEY = 'descon.admin-theme';

export type AdminTheme = 'light' | 'dark';

interface AdminThemeContextValue {
  theme: AdminTheme;
  toggleTheme: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | undefined>(undefined);

function readPersistedTheme(): AdminTheme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Scoped to the staff admin portal only -- StaffShell applies `theme` as a
 * `.dark` class on its own root element (never on <html>/<body>), so this
 * never affects the candidate-facing app, which hasn't been visually
 * verified against the dark-theme CSS variables in global.css.
 */
export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AdminTheme>(readPersistedTheme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return <AdminThemeContext.Provider value={{ theme, toggleTheme }}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme(): AdminThemeContextValue {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error('useAdminTheme must be used within AdminThemeProvider');
  }
  return context;
}
