import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Guards candidate-only screens. Web's session state is always known
 * synchronously (see AuthContext's in-memory-only design), so there is no
 * "restoring" phase to gate here the way mobile has -- an unauthenticated
 * status redirects immediately, before any protected content ever renders.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
