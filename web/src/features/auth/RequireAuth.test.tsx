import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { RequireAuth } from './RequireAuth';

function LoginStub() {
  const { login } = useAuth();
  return (
    <div>
      <p>Login screen</p>
      <button
        type="button"
        onClick={() =>
          login({
            accessToken: 'token',
            candidateId: 'candidate_1',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          })
        }
      >
        login
      </button>
      <Link to="/dashboard">Go to dashboard</Link>
    </div>
  );
}

function ProtectedStub() {
  return <p>Protected content</p>;
}

function renderGuarded() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginStub />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <ProtectedStub />
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('RequireAuth', () => {
  it('redirects to /login instead of rendering protected content when unauthenticated', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<LoginStub />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <ProtectedStub />
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders protected content once authenticated, without redirecting back to login', () => {
    renderGuarded();
    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    fireEvent.click(screen.getByRole('link', { name: 'Go to dashboard' }));
    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  });
});
