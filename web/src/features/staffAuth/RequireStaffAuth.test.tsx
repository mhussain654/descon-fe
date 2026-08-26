import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { RequireStaffAuth } from './RequireStaffAuth';

vi.mock('../../contexts/StaffAuthContext', () => ({
  useStaffAuth: vi.fn(),
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

function ProtectedStub() {
  return <p>Protected content</p>;
}

function renderGuarded(initialPath: string, permission?: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/login" element={<p>Sign-in screen</p>} />
        <Route path="/admin/forbidden" element={<p>Forbidden screen</p>} />
        <Route
          path="/admin/users"
          element={
            <RequireStaffAuth permission={permission}>
              <ProtectedStub />
            </RequireStaffAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireStaffAuth', () => {
  it('shows a loading state instead of protected content while the session is restoring', () => {
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'restoring', hasPermission: vi.fn() } as never);
    renderGuarded('/admin/users');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('redirects to /admin/login instead of rendering protected content when unauthenticated', () => {
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'unauthenticated', hasPermission: vi.fn() } as never);
    renderGuarded('/admin/users');
    expect(screen.getByText('Sign-in screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders protected content once authenticated, when no permission is required', () => {
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'authenticated', hasPermission: vi.fn(() => false) } as never);
    renderGuarded('/admin/users');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to /admin/forbidden -- not just hides the content -- when authenticated but lacking the required permission', () => {
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'authenticated', hasPermission: vi.fn(() => false) } as never);
    renderGuarded('/admin/users', 'manage_staff_users');
    expect(screen.getByText('Forbidden screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders protected content when authenticated and holding the required permission', () => {
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'authenticated', hasPermission: vi.fn(() => true) } as never);
    renderGuarded('/admin/users', 'manage_staff_users');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('shows a retry affordance instead of redirecting to sign-in when restoration could not confirm a session either way (offline)', () => {
    const retryRestore = vi.fn();
    vi.mocked(useStaffAuth).mockReturnValue({
      status: 'restore-error',
      hasPermission: vi.fn(),
      retryRestore,
    } as never);
    renderGuarded('/admin/users');

    expect(screen.queryByText('Sign-in screen')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'retry' });
    fireEvent.click(retryButton);
    expect(retryRestore).toHaveBeenCalledTimes(1);
  });
});
