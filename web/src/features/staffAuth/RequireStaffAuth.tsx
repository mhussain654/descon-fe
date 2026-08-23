import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { LoadingState } from '../../design-system';
import type { StaffPermission } from '../../../../shared/auth/staffTypes';

export interface RequireStaffAuthProps {
  children: ReactNode;
  /** When set, an authenticated staff member lacking this permission is redirected to /admin/forbidden instead of seeing `children` -- this is what makes an unauthorized nav *action* impossible to reach, not merely hidden from the menu. */
  permission?: StaffPermission;
}

/**
 * Guards staff-only screens. `status` starts as `'restoring'` while
 * StaffAuthContext's session-recovery call is in flight (unlike candidate
 * web auth, staff sessions must survive a reload -- MPS-F202) -- protected
 * content must not render during that window either, so this shows a
 * loading state instead of flashing the sign-in screen or (worse) stale
 * protected content before authorization is confirmed.
 */
export function RequireStaffAuth({ children, permission }: RequireStaffAuthProps) {
  const { status, hasPermission } = useStaffAuth();
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

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/admin/forbidden" replace />;
  }

  return <>{children}</>;
}
