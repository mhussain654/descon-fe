import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { LoadingState } from '../../design-system';
import type { StaffRole } from '../../../../shared/auth/staffTypes';

export interface RequireStaffAuthProps {
  children: ReactNode;
  /**
   * When set, an authenticated staff member whose role isn't in this list is
   * redirected to /admin/forbidden instead of seeing `children` -- this is
   * what makes an unauthorized nav *action* impossible to reach, not merely
   * hidden from the menu. A UX gate only (AGENTS.md: "Frontend role checks
   * are for UX only; do not treat them as the security boundary") -- the
   * backend enforces the real boundary independently.
   */
  roles?: StaffRole[];
}

/**
 * Guards staff-only screens. `status` starts as `'restoring'` while
 * StaffAuthContext's session-recovery call is in flight (unlike candidate
 * web auth, staff sessions must survive a reload -- MPS-F202) -- protected
 * content must not render during that window either, so this shows a
 * loading state instead of flashing the sign-in screen or (worse) stale
 * protected content before authorization is confirmed.
 */
export function RequireStaffAuth({ children, roles }: RequireStaffAuthProps) {
  const { status, session } = useStaffAuth();
  const { t } = useLanguage();

  if (status === 'restoring') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState message={t('loading')} />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/admin/login" replace />;
  }

  if (roles && !roles.includes(session!.role)) {
    return <Navigate to="/admin/forbidden" replace />;
  }

  return <>{children}</>;
}
