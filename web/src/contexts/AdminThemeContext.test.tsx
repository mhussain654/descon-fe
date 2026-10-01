import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminThemeProvider, useAdminTheme } from './AdminThemeContext';

function Probe() {
  const { theme, toggleTheme } = useAdminTheme();
  return (
    <div>
      <span>{theme}</span>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
    </div>
  );
}

describe('AdminThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('defaults to light when nothing is persisted and the system has no dark preference', () => {
    render(
      <AdminThemeProvider>
        <Probe />
      </AdminThemeProvider>
    );

    expect(screen.getByText('light')).toBeInTheDocument();
  });

  it('defaults to dark when the system prefers dark and nothing is persisted', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);

    render(
      <AdminThemeProvider>
        <Probe />
      </AdminThemeProvider>
    );

    expect(screen.getByText('dark')).toBeInTheDocument();
  });

  it('toggles between light and dark and persists the choice', () => {
    render(
      <AdminThemeProvider>
        <Probe />
      </AdminThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByText('dark')).toBeInTheDocument();
    expect(window.localStorage.getItem('descon.admin-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByText('light')).toBeInTheDocument();
    expect(window.localStorage.getItem('descon.admin-theme')).toBe('light');
  });

  it('reads a previously persisted theme on mount, ignoring system preference', () => {
    window.localStorage.setItem('descon.admin-theme', 'dark');
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);

    render(
      <AdminThemeProvider>
        <Probe />
      </AdminThemeProvider>
    );

    expect(screen.getByText('dark')).toBeInTheDocument();
  });

  it('throws when useAdminTheme is used outside AdminThemeProvider', () => {
    // Suppress React's expected console.error for the thrown-during-render case.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAdminTheme must be used within AdminThemeProvider');
    consoleSpy.mockRestore();
  });
});
