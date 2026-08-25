import { render, screen } from '@testing-library/react';
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

function renderGuarded(initialPath: string, roles?: Array<'admin' | 'hr' | 'mps' | 'finance' | 'management'>) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/login" element={<p>Sign-in screen</p>} />
        <Route path="/admin/forbidden" element={<p>Forbidden screen</p>} />
        <Route
          path="/admin/users"
          element={
            <RequireStaffAuth roles={roles}>
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
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'restoring', session: null } as never);
    renderGuarded('/admin/users');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('redirects to /admin/login instead of rendering protected content when unauthenticated', () => {
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'unauthenticated', session: null } as never);
    renderGuarded('/admin/users');
    expect(screen.getByText('Sign-in screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders protected content once authenticated, when no role restriction is required', () => {
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'authenticated', session: { role: 'hr' } } as never);
    renderGuarded('/admin/users');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to /admin/forbidden -- not just hides the content -- when authenticated but the role is not allowed', () => {
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'authenticated', session: { role: 'hr' } } as never);
    renderGuarded('/admin/users', ['admin']);
    expect(screen.getByText('Forbidden screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders protected content when authenticated and holding an allowed role', () => {
    vi.mocked(useStaffAuth).mockReturnValue({ status: 'authenticated', session: { role: 'admin' } } as never);
    renderGuarded('/admin/users', ['admin']);
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
