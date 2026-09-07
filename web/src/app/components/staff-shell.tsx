import { Link, useLocation } from 'react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { RequireStaffAuth } from '../../features/staffAuth/RequireStaffAuth';
import { Badge, Button, IconButton } from '../../design-system';
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Route changes (a nav click, browser back/forward, a redirect elsewhere in
  // the app) should always close a still-open mobile drawer -- otherwise it's
  // left open over the newly-navigated page.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  if (!session) return null;

  // Ordered as: overview dashboards first, day-to-day operational workflows
  // next, then system-administration items (Users/Audit log/Backups) last --
  // the grouping convention most admin portals (and this app's own previous
  // ad hoc order didn't) follow, put here for MPS-F902's "rearrange top
  // navigation per standard admin portal conventions" ask.
  const navItems = [
    { href: '/admin/dashboard', labelKey: 'staffNavAdminDashboard', visible: hasPermission('view_admin_dashboard') },
    { href: '/admin/mps-dashboard', labelKey: 'staffNavMpsDashboard', visible: hasPermission('view_mps_dashboard') },
    {
      href: '/admin/management-dashboard',
      labelKey: 'staffNavManagementDashboard',
      visible: hasPermission('view_management_dashboard'),
    },
    { href: '/admin/reports', labelKey: 'staffNavReports', visible: hasPermission('view_reports') },
    { href: '/admin', labelKey: 'staffNavCandidates', visible: true },
    {
      href: '/admin/candidates/import',
      labelKey: 'staffNavCandidateImport',
      visible: hasPermission('manage_candidates'),
    },
    {
      href: '/admin/document-reviews',
      labelKey: 'staffNavDocumentReviews',
      visible: hasPermission('manage_candidate_documents'),
    },
    {
      href: '/admin/finance/payments',
      labelKey: 'staffNavFinancePayments',
      visible: hasPermission('view_payments') || hasPermission('manage_payments'),
    },
    { href: '/admin/users', labelKey: 'staffNavUsers', visible: hasPermission('manage_staff_users') },
    { href: '/admin/audit-log', labelKey: 'staffNavAuditLog', visible: hasPermission('view_audit_events') },
    { href: '/admin/backups', labelKey: 'staffNavBackups', visible: hasPermission('manage_backups') },
  ].filter((item) => item.visible);

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-gray-300 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="2xl:hidden">
              <IconButton
                icon={isMobileNavOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
                label={t('staffNavToggleMenu')}
                variant="ghost"
                size="sm"
                aria-expanded={isMobileNavOpen}
                aria-controls="staff-mobile-nav"
                onClick={() => setIsMobileNavOpen((open) => !open)}
              />
            </div>
            <span className="truncate text-base font-semibold text-gray-900">{t('staffPortalTitle')}</span>
          </div>

          <nav className="hidden items-center gap-4 2xl:flex" aria-label={t('staffPortalTitle')}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`text-sm font-medium whitespace-nowrap ${
                  isActive(item.href) ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 2xl:flex">
            <div className="text-end text-sm">
              <div className="font-medium text-gray-900">{session.email}</div>
              <Badge tone="neutral">{t(ROLE_LABEL_KEYS[session.role])}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              {t('staffAuthSignOut')}
            </Button>
          </div>
        </div>

        {isMobileNavOpen && (
          <div id="staff-mobile-nav" className="border-t border-gray-200 2xl:hidden">
            <nav className="flex flex-col gap-1 px-4 py-3" aria-label={t('staffPortalTitle')}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    isActive(item.href) ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
            <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
              <div className="text-sm">
                <div className="font-medium text-gray-900">{session.email}</div>
                <Badge tone="neutral">{t(ROLE_LABEL_KEYS[session.role])}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                {t('staffAuthSignOut')}
              </Button>
            </div>
          </div>
        )}
      </header>

      {children}
    </div>
  );
}
