import { Mail, Shield } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { Badge, Card } from '../../design-system';
import { STAFF_ROLE_LABEL_KEYS } from '../../../../shared/auth/staffTypes';

function avatarInitial(email: string): string {
  return email.trim().charAt(0).toUpperCase() || '?';
}

/**
 * Read-only summary of the signed-in staff member's own account -- the
 * "Profile" destination from StaffShell's account menu. There's no
 * self-service editing here (no display name field exists on StaffSession to
 * begin with -- see staffTypes.ts) -- this only surfaces what's already
 * known, matching the account menu's own identity block one level deeper.
 */
export function StaffProfile() {
  const { t } = useLanguage();
  const { session } = useStaffAuth();

  if (!session) return null;

  const roleLabel = t(STAFF_ROLE_LABEL_KEYS[session.role]);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('staffProfileTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('staffProfileSubtitle')}</p>
      </div>

      <Card>
        <div className="mb-6 flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-semibold text-brand-on"
            aria-hidden="true"
          >
            {avatarInitial(session.email)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-text-primary">{session.email}</div>
            <Badge tone="neutral">{roleLabel}</Badge>
          </div>
        </div>

        <dl className="divide-y divide-border border-t border-border">
          <div className="flex items-center gap-3 py-3">
            <Mail className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <dt className="w-24 shrink-0 text-sm text-text-secondary">{t('staffProfileEmailLabel')}</dt>
            <dd className="truncate text-sm font-medium text-text-primary">{session.email}</dd>
          </div>
          <div className="flex items-center gap-3 py-3">
            <Shield className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <dt className="w-24 shrink-0 text-sm text-text-secondary">{t('staffProfileRoleLabel')}</dt>
            <dd className="text-sm font-medium text-text-primary">{roleLabel}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
