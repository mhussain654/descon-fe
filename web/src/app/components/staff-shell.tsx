import { Link, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { RequireStaffAuth } from '../../features/staffAuth/RequireStaffAuth';
import { Badge, Button } from '../../design-system';
import type { StaffRole } from '../../../../shared/auth/staffTypes';

const ROLE_LABEL_KEYS: Record<StaffRole, string> = {
  admin: 'staffAdminRoleAdmin',
  hr: 'staffAdminRoleHr',
  mps: 'staffAdminRoleMps',
  finance: 'staffAdminRoleFinance',
  management: 'staffAdminRoleManagement',
};

/**
 * Every staff screen renders through StaffShell, so guarding here protects
 * the whole staff portal in one place -- and, critically, the "Users" nav
 * link below is simply never rendered for a staff member lacking
 * `manage_staff_users` (MPS-F202: "unauthorized nav items/actions are not
 * rendered, not just disabled"), not merely disabled/hidden by CSS.
 */
export function StaffShell({ children }: { children: ReactNode }) {
  return (
    <RequireStaffAuth>
      <StaffShellContent>{children}</StaffShellContent>
    </RequireStaffAuth>
  );
}

function StaffShellContent({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { session, signOut, hasPermission } = useStaffAuth();
  const location = useLocation();

  if (!session) return null;

  const navItems = [
    { href: '/admin', labelKey: 'staffNavCandidates', visible: true },
    { href: '/admin/users', labelKey: 'staffNavUsers', visible: hasPermission('manage_staff_users') },
  ].filter((item) => item.visible);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-gray-300 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-6">
            <span className="text-base font-semibold text-gray-900">{t('staffPortalTitle')}</span>
            <nav className="flex items-center gap-4">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-end text-sm">
              <div className="font-medium text-gray-900">{session.email}</div>
              <Badge tone="neutral">{t(ROLE_LABEL_KEYS[session.role])}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              {t('staffAuthSignOut')}
            </Button>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
