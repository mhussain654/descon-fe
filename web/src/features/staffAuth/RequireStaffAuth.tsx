import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { ErrorState, LoadingState } from '../../design-system';

export interface RequireStaffAuthProps {
  children: ReactNode;
  /**
   * When set, an authenticated staff member lacking this permission is
   * redirected to /admin/forbidden instead of seeing `children` -- this is
   * what makes an unauthorized nav *action* impossible to reach, not merely
   * hidden from the menu. A UX gate only (AGENTS.md: "Frontend role checks
   * are for UX only; do not treat them as the security boundary") -- the
   * backend enforces the real boundary independently.
   */
  permission?: string;
}

/**
 * Guards staff-only screens. `status` starts as `'restoring'` while
 * StaffAuthContext's session-recovery call is in flight (unlike candidate
 * web auth, staff sessions must survive a reload -- MPS-F202) -- protected
 * content must not render during that window either, so this shows a
 * loading state instead of flashing the sign-in screen or (worse) stale
 * protected content before authorization is confirmed.
 *
 * `restore-error` means restoration couldn't confirm a session either way
 * (network/offline) -- a real, possibly-still-valid session must not be
 * discarded by redirecting to sign-in, so this shows a retry affordance
 * instead (ticket: "A temporary connection failure must not permanently
 * destroy a valid session").
 */
export function RequireStaffAuth({ children, permission }: RequireStaffAuthProps) {
  const { status, hasPermission, retryRestore } = useStaffAuth();
  const { t } = useLanguage();

  if (status === 'restoring') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState message={t('loading')} />
      </div>
    );
  }

  if (status === 'restore-error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <ErrorState message={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={retryRestore} />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/admin/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/admin/forbidden" replace />;
  }

  return <>{children}</>;
}
