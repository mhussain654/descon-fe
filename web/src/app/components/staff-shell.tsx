import { Link, useLocation } from 'react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3,
  ChevronDown,
  CreditCard,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { RequireStaffAuth } from '../../features/staffAuth/RequireStaffAuth';
import { Badge } from '../../design-system';
import { STAFF_ROLE_LABEL_KEYS } from '../../../../shared/auth/staffTypes';
import type { TranslationKey } from '../../../../shared/i18n/translations';

type IconType = typeof LayoutDashboard;

type NavLeaf = { href: string; labelKey: TranslationKey; visible: boolean };
type NavEntry =
  | { type: 'link'; href: string; labelKey: TranslationKey; visible: boolean; icon: IconType }
  | { type: 'group'; key: string; groupLabelKey: TranslationKey; children: NavLeaf[]; icon: IconType };

const NAV_ITEM_CLASSNAME =
  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors';
const NAV_ITEM_ACTIVE_CLASSNAME = 'bg-brand-subtle text-brand';
const NAV_ITEM_INACTIVE_CLASSNAME = 'text-text-secondary hover:bg-surface-sunken hover:text-text-primary';
const MENU_PANEL_CLASSNAME =
  'absolute top-full z-20 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-border bg-surface-raised py-1 shadow-lg';
const MENU_LINK_CLASSNAME =
  'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors text-text-secondary hover:bg-surface-sunken hover:text-text-primary';

function avatarInitial(email: string): string {
  return email.trim().charAt(0).toUpperCase() || '?';
}

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
  // One shared key space for every desktop dropdown -- each nav group's own
  // key, plus 'user' for the account menu -- so only one can ever be open at
  // a time and they all share the same close-on-outside-click/Escape/route-
  // change behavior below instead of three near-duplicate implementations.
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Route changes (a nav click, browser back/forward, a redirect elsewhere in
  // the app) should always close a still-open mobile drawer or desktop
  // dropdown -- otherwise it's left open over the newly-navigated page.
  useEffect(() => {
    setIsMobileNavOpen(false);
    setOpenMenuKey(null);
  }, [location.pathname]);

  // A dropdown closes on an outside click or Escape, same as any standard
  // menu -- but not on a click on a *different* menu's own toggle button,
  // since that button's own onClick already switches which menu is open.
  useEffect(() => {
    if (!openMenuKey) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const container = menuRefs.current[openMenuKey as string];
      if (container && !container.contains(event.target as Node)) {
        setOpenMenuKey(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenuKey(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuKey]);

  if (!session) return null;

  // Related items are grouped into a handful of top-level dropdowns instead
  // of one long flat row (MPS-F902: "rearrange top navigation per standard
  // admin portal conventions"): the overview dashboards under "Dashboards"
  // (Reports stays a direct link -- it's its own destination, not a variant
  // of a dashboard), every channel a candidate hears from or is contacted
  // through -- the communications log and the AI voice call scripts/settings
  // that drive it -- under "Communications", and system-setup/administrative
  // actions under "Administration". The highest-frequency day-to-day
  // workflows (Candidates, Document Reviews, Finance payments, Reports) stay
  // as direct top-level links so the most common actions are never an extra
  // click behind a dropdown.
  const navEntries: NavEntry[] = [
    {
      type: 'group',
      key: 'dashboards',
      groupLabelKey: 'staffNavGroupDashboards',
      icon: LayoutDashboard,
      children: [
        { href: '/admin/dashboard', labelKey: 'staffNavAdminDashboard', visible: hasPermission('view_admin_dashboard') },
        { href: '/admin/mps-dashboard', labelKey: 'staffNavMpsDashboard', visible: hasPermission('view_mps_dashboard') },
        {
          href: '/admin/management-dashboard',
          labelKey: 'staffNavManagementDashboard',
          visible: hasPermission('view_management_dashboard'),
        },
      ],
    },
    { type: 'link', href: '/admin', labelKey: 'staffNavCandidates', visible: true, icon: Users },
    {
      type: 'link',
      href: '/admin/document-reviews',
      labelKey: 'staffNavDocumentReviews',
      visible: hasPermission('manage_candidate_documents'),
      icon: FileCheck2,
    },
    {
      type: 'link',
      href: '/admin/finance/payments',
      labelKey: 'staffNavFinancePayments',
      visible: hasPermission('view_payments') || hasPermission('manage_payments'),
      icon: CreditCard,
    },
    {
      type: 'link',
      href: '/admin/reports',
      labelKey: 'staffNavReports',
      visible: hasPermission('view_reports'),
      icon: BarChart3,
    },
    {
      type: 'group',
      key: 'communications',
      groupLabelKey: 'staffNavGroupCommunications',
      icon: MessageSquare,
      children: [
        {
          href: '/admin/communications',
          labelKey: 'staffNavCommunications',
          visible: hasPermission('view_communications') || hasPermission('manage_communications'),
        },
        {
          href: '/admin/ai-call-scripts',
          labelKey: 'staffNavAiCallScripts',
          visible: hasPermission('manage_ai_call_scripts'),
        },
        {
          href: '/admin/ai-call-settings',
          labelKey: 'staffNavAiCallSettings',
          visible: hasPermission('manage_ai_call_settings'),
        },
      ],
    },
    {
      type: 'group',
      key: 'administration',
      groupLabelKey: 'staffNavGroupAdministration',
      icon: Settings,
      children: [
        { href: '/admin/users', labelKey: 'staffNavUsers', visible: hasPermission('manage_staff_users') },
        { href: '/admin/audit-log', labelKey: 'staffNavAuditLog', visible: hasPermission('view_audit_events') },
        { href: '/admin/backups', labelKey: 'staffNavBackups', visible: hasPermission('manage_backups') },
        {
          href: '/admin/training-settings',
          labelKey: 'staffNavTraining',
          visible: hasPermission('manage_training_settings'),
        },
        {
          href: '/admin/candidates/import',
          labelKey: 'staffNavCandidateImport',
          visible: hasPermission('manage_candidates'),
        }
      ],
    },
  ];

  const resolvedEntries = navEntries
    .map((entry) =>
      entry.type === 'group' ? { ...entry, children: entry.children.filter((child) => child.visible) } : entry
    )
    .filter((entry) => (entry.type === 'group' ? entry.children.length > 0 : entry.visible));

  // Same longest-match-wins rule this file has always used (a naive
  // per-item startsWith check would highlight "Candidates" alongside
  // whichever other item matches, since its bare `/admin` href is a prefix
  // of every other admin route) -- now computed over every leaf href across
  // both direct links and every group's children.
  const allHrefs = resolvedEntries.flatMap((entry) =>
    entry.type === 'group' ? entry.children.map((child) => child.href) : [entry.href]
  );
  // /admin/profile is deliberately not one of the primary nav destinations
  // above (it's reached only via the account menu, not the top bar) -- so it
  // must never fall back to lighting up "Candidates" via that bare `/admin`
  // prefix match the way an unrelated admin route otherwise would.
  const isOnProfilePage = location.pathname === '/admin/profile' || location.pathname.startsWith('/admin/profile/');
  const activeHref = isOnProfilePage
    ? null
    : allHrefs.reduce<string | null>((best, href) => {
        const matches = location.pathname === href || location.pathname.startsWith(`${href}/`);
        if (!matches) return best;
        return !best || href.length > best.length ? href : best;
      }, null);
  const isActive = (href: string) => href === activeHref;
  const isGroupActive = (entry: Extract<NavEntry, { type: 'group' }>) =>
    entry.children.some((child) => child.href === activeHref);

  const navLabel = t('staffPortalTitle');
  const roleLabel = t(STAFF_ROLE_LABEL_KEYS[session.role]);

  return (
    <div className="min-h-screen bg-surface-background">
      <header className="border-b border-border bg-surface-raised shadow-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="2xl:hidden">
              <button
                type="button"
                aria-label={t('staffNavToggleMenu')}
                aria-expanded={isMobileNavOpen}
                aria-controls="staff-mobile-nav"
                onClick={() => setIsMobileNavOpen((open) => !open)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
              >
                {isMobileNavOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-on"
              aria-hidden="true"
            >
              D
            </span>
            <span className="truncate text-base font-semibold tracking-tight text-text-primary">{navLabel}</span>
          </div>

          <nav className="hidden items-center gap-1 2xl:flex" aria-label={navLabel}>
            {resolvedEntries.map((entry) => {
              const Icon = entry.icon;
              return entry.type === 'link' ? (
                <Link
                  key={entry.href}
                  to={entry.href}
                  className={`${NAV_ITEM_CLASSNAME} ${isActive(entry.href) ? NAV_ITEM_ACTIVE_CLASSNAME : NAV_ITEM_INACTIVE_CLASSNAME}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(entry.labelKey)}
                </Link>
              ) : (
                <div
                  key={entry.key}
                  ref={(el) => {
                    menuRefs.current[entry.key] = el;
                  }}
                  className="relative"
                >
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={openMenuKey === entry.key}
                    onClick={() => setOpenMenuKey((current) => (current === entry.key ? null : entry.key))}
                    className={`${NAV_ITEM_CLASSNAME} ${
                      isGroupActive(entry) || openMenuKey === entry.key ? NAV_ITEM_ACTIVE_CLASSNAME : NAV_ITEM_INACTIVE_CLASSNAME
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(entry.groupLabelKey)}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${openMenuKey === entry.key ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {openMenuKey === entry.key && (
                    <div className={`${MENU_PANEL_CLASSNAME} start-0`}>
                      {entry.children.map((child) => (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setOpenMenuKey(null)}
                          className={`px-3 py-2 text-sm font-medium ${MENU_LINK_CLASSNAME} ${
                            isActive(child.href) ? NAV_ITEM_ACTIVE_CLASSNAME : ''
                          }`}
                        >
                          {t(child.labelKey)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div
            className="relative hidden 2xl:block"
            ref={(el) => {
              menuRefs.current.user = el;
            }}
          >
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={openMenuKey === 'user'}
              onClick={() => setOpenMenuKey((current) => (current === 'user' ? null : 'user'))}
              className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-surface-sunken"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-on"
                aria-hidden="true"
              >
                {avatarInitial(session.email)}
              </span>
              <span className="max-w-[180px] truncate text-sm font-medium text-text-primary">{session.email}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-text-secondary transition-transform ${
                  openMenuKey === 'user' ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {openMenuKey === 'user' && (
              <div className={`${MENU_PANEL_CLASSNAME} end-0`}>
                <div className="border-b border-border px-3 py-2.5">
                  <div className="truncate text-sm font-medium text-text-primary">{session.email}</div>
                  <Badge tone="neutral">{roleLabel}</Badge>
                </div>
                <Link to="/admin/profile" onClick={() => setOpenMenuKey(null)} className={MENU_LINK_CLASSNAME}>
                  <User className="h-4 w-4" aria-hidden="true" />
                  {t('staffUserMenuProfile')}
                </Link>
                <button type="button" onClick={() => signOut()} className={`w-full text-start ${MENU_LINK_CLASSNAME}`}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t('staffAuthSignOut')}
                </button>
              </div>
            )}
          </div>
        </div>

        {isMobileNavOpen && (
          <div id="staff-mobile-nav" className="border-t border-border 2xl:hidden">
            <nav className="flex flex-col gap-1 px-4 py-3" aria-label={navLabel}>
              {resolvedEntries.map((entry) => {
                const Icon = entry.icon;
                return entry.type === 'link' ? (
                  <Link
                    key={entry.href}
                    to={entry.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive(entry.href) ? NAV_ITEM_ACTIVE_CLASSNAME : NAV_ITEM_INACTIVE_CLASSNAME
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(entry.labelKey)}
                  </Link>
                ) : (
                  <div key={entry.key} className="flex flex-col gap-1 pt-2 first:pt-0">
                    <div className="flex items-center gap-1.5 px-3 text-xs font-semibold tracking-wide text-text-tertiary uppercase">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {t(entry.groupLabelKey)}
                    </div>
                    {entry.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${
                          isActive(child.href) ? NAV_ITEM_ACTIVE_CLASSNAME : NAV_ITEM_INACTIVE_CLASSNAME
                        }`}
                      >
                        {t(child.labelKey)}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </nav>
            <div className="border-t border-border px-4 py-3">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-on"
                  aria-hidden="true"
                >
                  {avatarInitial(session.email)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text-primary">{session.email}</div>
                  <Badge tone="neutral">{roleLabel}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/admin/profile"
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-sm font-medium text-text-primary transition-colors hover:bg-surface-sunken"
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  {t('staffUserMenuProfile')}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-sm font-medium text-text-primary transition-colors hover:bg-surface-sunken"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t('staffAuthSignOut')}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {children}
    </div>
  );
}
