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
  const { status, session } = useAuth();

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  // MPS-204: every candidate screen except the consent screen itself is
  // gated on having accepted the current policy version -- mirrors the
  // backend's ProtectedController#ensure_consent_given!, enforced here so
  // the candidate never even sees a protected screen flash before a 403
  // would otherwise come back.
  if (!session?.consent?.accepted) {
    return <Navigate to="/consent" replace />;
  }

  return <>{children}</>;
}
