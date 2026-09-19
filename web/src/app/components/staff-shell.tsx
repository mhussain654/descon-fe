import { Link, useLocation, useNavigate } from 'react-router';
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import {
  Activity,
  BarChart3,
  ChevronsUpDown,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileUp,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  ScrollText,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  User,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { AdminThemeProvider, useAdminTheme, type AdminTheme } from '../../contexts/AdminThemeContext';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';
import { RequireStaffAuth } from '../../features/staffAuth/RequireStaffAuth';
import { Badge, SearchField } from '../../design-system';
import { STAFF_ROLE_LABEL_KEYS } from '../../../../shared/auth/staffTypes';
import type { TranslationKey } from '../../../../shared/i18n/translations';

type IconType = typeof LayoutDashboard;

type NavLeaf = { href: string; labelKey: TranslationKey; visible: boolean; icon: IconType };
type NavEntry =
  | { type: 'link'; href: string; labelKey: TranslationKey; visible: boolean; icon: IconType }
  | { type: 'group'; key: string; children: NavLeaf[] };

const SIDEBAR_WIDTH_CLASSNAME = 'lg:w-64';
// The sidebar itself is a deliberate exception to this app's usual light
// surface tokens (bg-surface-raised, border-border, ...): every reference
// admin dashboard reviewed for this redesign (Admindek, Tailboard, Magnus)
// uses a dark sidebar against a light content area for a stronger, more
// "premium SaaS" visual identity, so it's built on Tailwind's own slate
// scale directly rather than the app's semantic (light-mode-only) tokens --
// the rest of the app, including every floating menu/dialog spawned from
// the sidebar, stays on the existing light tokens unchanged.
const SIDEBAR_SURFACE_CLASSNAME = 'bg-slate-900 border-slate-800';
// text-[0.9375rem] (15px) + tracking-wide, instead of the default text-sm
// (14px) with normal tracking, per direct feedback that the plain default
// looked "not perfect" -- slightly larger, more evenly spaced labels read
// closer to the reference admin dashboards (Admindek/Magnus/Tailboard) than
// the browser-default nav-link sizing did.
const NAV_LINK_CLASSNAME =
  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium tracking-wide transition-colors';
const NAV_LINK_ACTIVE_CLASSNAME = 'bg-brand text-brand-on font-semibold shadow-sm';
const NAV_LINK_INACTIVE_CLASSNAME = 'text-slate-400 hover:bg-slate-800 hover:text-white';
// A new nav section (after the first) gets a divider instead of a text
// heading -- the icon on every link already carries enough identity that a
// repeated "DASHBOARDS"/"COMMUNICATIONS"/"ADMINISTRATION" label per section
// just added visual noise without adding information.
const NAV_GROUP_DIVIDER_CLASSNAME = 'mt-3 border-t border-slate-800 pt-3';
const ACCOUNT_MENU_LINK_CLASSNAME =
  'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors text-text-secondary hover:bg-surface-sunken hover:text-text-primary';
// The sidebar's own account-menu popup is anchored to SIDEBAR_SURFACE_CLASSNAME's
// permanently-dark surface, which does not follow the light/dark theme
// toggle (see that constant's comment). Building this popup on the
// theme-tied tokens above would make it flip to a light card in light mode
// (the default), floating oddly on the sidebar's always-dark background --
// reported as a color mismatch, fixed by matching it to the sidebar's own
// slate palette instead, regardless of theme.
const SIDEBAR_ACCOUNT_MENU_PANEL_CLASSNAME =
  'absolute bottom-full start-3 end-3 z-fixed mb-1.5 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-lg';
const SIDEBAR_ACCOUNT_MENU_LINK_CLASSNAME =
  'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors text-slate-300 hover:bg-slate-700 hover:text-white';

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
      <AdminThemeProvider>
        <StaffShellContent>{children}</StaffShellContent>
      </AdminThemeProvider>
    </RequireStaffAuth>
  );
}

function StaffShellContent({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { session, signOut, hasPermission } = useStaffAuth();
  const { theme } = useAdminTheme();
  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isHeaderAccountMenuOpen, setIsHeaderAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const headerAccountMenuRef = useRef<HTMLDivElement | null>(null);

  // Route changes (a nav click, browser back/forward, a redirect elsewhere in
  // the app) should always close a still-open mobile drawer or account menu --
  // otherwise it's left open over the newly-navigated page.
  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsAccountMenuOpen(false);
    setIsHeaderAccountMenuOpen(false);
  }, [location.pathname]);

  // Each account menu (sidebar footer, header) closes on an outside click or
  // Escape, same as any standard menu -- shared listener wiring, see
  // useDismissableMenu.
  useDismissableMenu(accountMenuRef, isAccountMenuOpen, () => setIsAccountMenuOpen(false));
  useDismissableMenu(headerAccountMenuRef, isHeaderAccountMenuOpen, () => setIsHeaderAccountMenuOpen(false));

  if (!session) return null;

  // Related items are grouped into a handful of sections instead of one long
  // flat list (MPS-F902's original grouping goal, now carried by a left
  // sidebar instead of a horizontal dropdown bar -- see the admin-portal
  // redesign plan): the overview dashboards (Reports stays a direct link --
  // it's its own destination, not a variant of a dashboard), every channel a
  // candidate hears from or is contacted through, and system-setup/
  // administrative actions. Sections are visually separated by a divider, not
  // a text heading -- see NAV_GROUP_DIVIDER_CLASSNAME. The highest-frequency
  // day-to-day workflows (Candidates, Document Reviews, Finance payments,
  // Reports) stay as direct links so the most common actions are never
  // nested under a section.
  const navEntries: NavEntry[] = [
    {
      type: 'group',
      key: 'dashboards',
      children: [
        {
          href: '/admin/dashboard',
          labelKey: 'staffNavAdminDashboard',
          visible: hasPermission('view_admin_dashboard'),
          icon: LayoutDashboard,
        },
        {
          href: '/admin/mps-dashboard',
          labelKey: 'staffNavMpsDashboard',
          visible: hasPermission('view_mps_dashboard'),
          icon: Activity,
        },
        {
          href: '/admin/management-dashboard',
          labelKey: 'staffNavManagementDashboard',
          visible: hasPermission('view_management_dashboard'),
          icon: TrendingUp,
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
      children: [
        {
          href: '/admin/communications',
          labelKey: 'staffNavCommunications',
          visible: hasPermission('view_communications') || hasPermission('manage_communications'),
          icon: MessageSquare,
        },
        {
          href: '/admin/ai-call-scripts',
          labelKey: 'staffNavAiCallScripts',
          visible: hasPermission('manage_ai_call_scripts'),
          icon: ScrollText,
        },
        {
          href: '/admin/ai-call-settings',
          labelKey: 'staffNavAiCallSettings',
          visible: hasPermission('manage_ai_call_settings'),
          icon: SlidersHorizontal,
        },
      ],
    },
    {
      type: 'group',
      key: 'administration',
      children: [
        {
          href: '/admin/users',
          labelKey: 'staffNavUsers',
          visible: hasPermission('manage_staff_users'),
          icon: UserCog,
        },
        {
          href: '/admin/audit-log',
          labelKey: 'staffNavAuditLog',
          visible: hasPermission('view_audit_events'),
          icon: History,
        },
        {
          href: '/admin/backups',
          labelKey: 'staffNavBackups',
          visible: hasPermission('manage_backups'),
          icon: DatabaseBackup,
        },
        {
          href: '/admin/training-settings',
          labelKey: 'staffNavTraining',
          visible: hasPermission('manage_training_settings'),
          icon: GraduationCap,
        },
        {
          href: '/admin/candidates/import',
          labelKey: 'staffNavCandidateImport',
          visible: hasPermission('manage_candidates'),
          icon: FileUp,
        },
      ],
    },
  ];

  const resolvedEntries = navEntries
    .map((entry) =>
      entry.type === 'group' ? { ...entry, children: entry.children.filter((child) => child.visible) } : entry
    )
    .filter((entry) => (entry.type === 'group' ? entry.children.length > 0 : entry.visible));

  // Longest-match-wins: a naive per-item startsWith check would highlight
  // "Candidates" alongside whichever other item matches, since its bare
  // `/admin` href is a prefix of every other admin route.
  const allHrefs = resolvedEntries.flatMap((entry) =>
    entry.type === 'group' ? entry.children.map((child) => child.href) : [entry.href]
  );
  // /admin/profile is deliberately not one of the primary nav destinations
  // above (it's reached only via the account menu, not the sidebar) -- so it
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

  const navLabel = t('staffPortalTitle');
  const roleLabel = t(STAFF_ROLE_LABEL_KEYS[session.role]);

  return (
    <div className={`min-h-screen bg-surface-background ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Mobile-only top bar: the sidebar itself is hidden below `lg`, so this is
          the only way to reach it on small screens. Dark, matching the sidebar/
          drawer it opens, so the mobile and desktop nav chrome feel like the
          same surface rather than two different designs. */}
      <div className={`sticky top-0 z-sticky flex items-center gap-2.5 border-b px-4 py-4 shadow-sm lg:hidden ${SIDEBAR_SURFACE_CLASSNAME}`}>
        <button
          type="button"
          aria-label={t('staffNavToggleMenu')}
          aria-expanded={isMobileNavOpen}
          aria-controls="staff-mobile-nav"
          onClick={() => setIsMobileNavOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          {isMobileNavOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
        <BrandMark navLabel={navLabel} />
      </div>

      {isMobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-overlay bg-surface-overlay lg:hidden"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div
            id="staff-mobile-nav"
            className={`fixed inset-y-0 start-0 z-fixed flex w-72 max-w-[85vw] flex-col border-e shadow-lg lg:hidden ${SIDEBAR_SURFACE_CLASSNAME}`}
          >
            <SidebarContent
              navLabel={navLabel}
              roleLabel={roleLabel}
              session={session}
              resolvedEntries={resolvedEntries}
              isActive={isActive}
              signOut={signOut}
              isAccountMenuOpen={isAccountMenuOpen}
              setIsAccountMenuOpen={setIsAccountMenuOpen}
              accountMenuRef={null}
              onNavigate={() => setIsMobileNavOpen(false)}
              t={t}
            />
          </div>
        </>
      )}

      <div className={`fixed inset-y-0 start-0 z-fixed hidden flex-col border-e lg:flex ${SIDEBAR_WIDTH_CLASSNAME} ${SIDEBAR_SURFACE_CLASSNAME}`}>
        <SidebarContent
          navLabel={navLabel}
          roleLabel={roleLabel}
          session={session}
          resolvedEntries={resolvedEntries}
          isActive={isActive}
          signOut={signOut}
          isAccountMenuOpen={isAccountMenuOpen}
          setIsAccountMenuOpen={setIsAccountMenuOpen}
          accountMenuRef={accountMenuRef}
          onNavigate={undefined}
          t={t}
        />
      </div>

      {/* Desktop-only top header, to the right of the persistent sidebar --
          every reference admin dashboard reviewed for this redesign
          (Magnus, Apex) pairs a left sidebar with a top header carrying
          search, a theme toggle and the signed-in user. Not shown on mobile:
          the mobile top bar above already carries the equivalent nav-open
          affordance, and there's no room for a second bar at phone widths. */}
      <StaffHeader
        session={session}
        roleLabel={roleLabel}
        signOut={signOut}
        theme={theme}
        isHeaderAccountMenuOpen={isHeaderAccountMenuOpen}
        setIsHeaderAccountMenuOpen={setIsHeaderAccountMenuOpen}
        headerAccountMenuRef={headerAccountMenuRef}
        t={t}
      />

      <main className="lg:ms-64">{children}</main>
    </div>
  );
}

interface StaffHeaderProps {
  session: { email: string };
  roleLabel: string;
  signOut: () => void;
  theme: AdminTheme;
  isHeaderAccountMenuOpen: boolean;
  setIsHeaderAccountMenuOpen: (updater: boolean | ((open: boolean) => boolean)) => void;
  headerAccountMenuRef: RefObject<HTMLDivElement | null>;
  t: (key: TranslationKey) => string;
}

/**
 * Desktop-only sticky header to the right of the persistent sidebar. A
 * second, compact account-menu instance lives here alongside the sidebar
 * footer's -- deliberately, not a duplication to clean up: every reference
 * dashboard reviewed for this redesign (Magnus, Apex) keeps the same pairing
 * (identity block anchored in the sidebar footer, a compact avatar/menu in
 * the header), and removing either one would mean dropping tested,
 * currently-working sign-out/profile access from either the mobile drawer
 * (sidebar-footer-only) or the desktop header.
 */
function StaffHeader({
  session,
  roleLabel,
  signOut,
  theme,
  isHeaderAccountMenuOpen,
  setIsHeaderAccountMenuOpen,
  headerAccountMenuRef,
  t,
}: StaffHeaderProps) {
  const navigate = useNavigate();
  const { toggleTheme } = useAdminTheme();
  const [searchValue, setSearchValue] = useState('');

  // Submits to the candidates list's own `search` URL param (see
  // candidateListUrlState.ts) rather than introducing a separate/parallel
  // search mechanism -- the candidates list is the only screen with a real,
  // backed search today.
  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = searchValue.trim();
    navigate(trimmed ? `/admin?search=${encodeURIComponent(trimmed)}` : '/admin');
  }

  return (
    <header className="sticky top-0 z-sticky hidden items-center gap-4 border-b border-border bg-surface-raised px-6 py-3 shadow-sm lg:flex lg:ms-64">
      <form onSubmit={handleSearchSubmit} role="search" className="w-full max-w-sm">
        <SearchField
          value={searchValue}
          onValueChange={setSearchValue}
          label={t('staffHeaderSearchLabel')}
          placeholder={t('staffHeaderSearchPlaceholder')}
          clearLabel={t('staffHeaderSearchClearLabel')}
        />
      </form>

      <div className="ms-auto flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t('staffHeaderThemeToggleToLight') : t('staffHeaderThemeToggleToDark')}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
        </button>

        <div className="relative" ref={headerAccountMenuRef}>
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={isHeaderAccountMenuOpen}
            aria-label={t('staffHeaderAccountMenuLabel')}
            onClick={() => setIsHeaderAccountMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-on transition-opacity hover:opacity-90"
          >
            {avatarInitial(session.email)}
          </button>

          {isHeaderAccountMenuOpen && (
            <div className="absolute top-full end-0 z-fixed mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-surface-raised py-1 shadow-lg">
              <div className="border-b border-border px-3 py-2.5">
                <div className="truncate text-sm font-medium text-text-primary">{session.email}</div>
                <Badge tone="neutral">{roleLabel}</Badge>
              </div>
              <Link to="/admin/profile" className={ACCOUNT_MENU_LINK_CLASSNAME}>
                <User className="h-4 w-4" aria-hidden="true" />
                {t('staffUserMenuProfile')}
              </Link>
              <button type="button" onClick={() => signOut()} className={`w-full text-start ${ACCOUNT_MENU_LINK_CLASSNAME}`}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t('staffAuthSignOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function BrandMark({ navLabel }: { navLabel: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {/* The logo's own white background doubles as its tile -- a colored
          (bg-brand) wrapper behind it would show as a mismatched double
          border against the dark sidebar, so this renders the image alone,
          just rounded, rather than reusing the old letter-badge treatment. */}
      <img
        src="/descon-logo.png"
        alt=""
        aria-hidden="true"
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
      />
      <span className="truncate text-base font-bold tracking-tight text-white">{navLabel}</span>
    </div>
  );
}

interface SidebarContentProps {
  navLabel: string;
  roleLabel: string;
  session: { email: string };
  resolvedEntries: NavEntry[];
  isActive: (href: string) => boolean;
  signOut: () => void;
  isAccountMenuOpen: boolean;
  setIsAccountMenuOpen: (updater: boolean | ((open: boolean) => boolean)) => void;
  accountMenuRef: RefObject<HTMLDivElement | null> | null;
  /** Present only for the mobile drawer -- closes the drawer after a link click. */
  onNavigate: (() => void) | undefined;
  t: (key: TranslationKey) => string;
}

/** Shared between the persistent desktop sidebar and the mobile overlay drawer -- same content, same behavior. */
function SidebarContent({
  navLabel,
  roleLabel,
  session,
  resolvedEntries,
  isActive,
  signOut,
  isAccountMenuOpen,
  setIsAccountMenuOpen,
  accountMenuRef,
  onNavigate,
  t,
}: SidebarContentProps) {
  return (
    <>
      <div className="border-b border-slate-800 px-4 py-4">
        <BrandMark navLabel={navLabel} />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3" aria-label={navLabel}>
        {resolvedEntries.map((entry, index) => {
          if (entry.type === 'link') {
            const Icon = entry.icon;
            return (
              <Link
                key={entry.href}
                to={entry.href}
                onClick={onNavigate}
                className={`${NAV_LINK_CLASSNAME} ${isActive(entry.href) ? NAV_LINK_ACTIVE_CLASSNAME : NAV_LINK_INACTIVE_CLASSNAME}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t(entry.labelKey)}
              </Link>
            );
          }

          return (
            <div key={entry.key} className={index > 0 ? NAV_GROUP_DIVIDER_CLASSNAME : undefined}>
              {entry.children.map((child) => {
                const Icon = child.icon;
                return (
                  <Link
                    key={child.href}
                    to={child.href}
                    onClick={onNavigate}
                    className={`${NAV_LINK_CLASSNAME} ${isActive(child.href) ? NAV_LINK_ACTIVE_CLASSNAME : NAV_LINK_INACTIVE_CLASSNAME}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t(child.labelKey)}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="relative border-t border-slate-800 p-3" ref={accountMenuRef}>
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={isAccountMenuOpen}
          onClick={() => setIsAccountMenuOpen((open) => !open)}
          className="flex w-full items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-slate-800"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-on"
            aria-hidden="true"
          >
            {avatarInitial(session.email)}
          </span>
          <span className="min-w-0 flex-1 truncate text-start text-sm font-medium text-white">{session.email}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        </button>

        {isAccountMenuOpen && (
          <div className={SIDEBAR_ACCOUNT_MENU_PANEL_CLASSNAME}>
            <div className="border-b border-slate-700 px-3 py-2.5">
              <div className="truncate text-sm font-medium text-white">{session.email}</div>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {roleLabel}
              </span>
            </div>
            <Link to="/admin/profile" onClick={onNavigate} className={SIDEBAR_ACCOUNT_MENU_LINK_CLASSNAME}>
              <User className="h-4 w-4" aria-hidden="true" />
              {t('staffUserMenuProfile')}
            </Link>
            <button type="button" onClick={() => signOut()} className={`w-full text-start ${SIDEBAR_ACCOUNT_MENU_LINK_CLASSNAME}`}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {t('staffAuthSignOut')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
