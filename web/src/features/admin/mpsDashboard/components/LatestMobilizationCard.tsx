import { Plane } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Card, EmptyState } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { LatestMobilization } from '../../../../lib/admin-mps-dashboard-client';
import type { TFn } from '../../reports/components/ReportTables';

/** The single most recently mobilized candidate in scope -- null when nothing has been mobilized yet, shown as a real empty state rather than a fabricated placeholder row. */
export function LatestMobilizationCard({
  latestMobilization,
  t,
  language,
}: {
  latestMobilization: LatestMobilization | null;
  t: TFn;
  language: Language;
}) {
  return (
    <Card className="shadow-sm">
      <h2 className="text-base font-semibold text-text-primary">{t('mpsDashboardLatestMobilizationTitle')}</h2>
      <p className="mb-4 text-xs text-text-secondary">{t('mpsDashboardLatestMobilizationSubtitle')}</p>
      {latestMobilization ? (
        <div className="flex items-start gap-3 rounded-xl bg-surface-sunken/60 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-subtle text-success-emphasis" aria-hidden="true">
            <Plane className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/admin/candidates/${latestMobilization.candidatePublicId}`}
                className="font-medium text-brand hover:underline"
              >
                {latestMobilization.candidateFullName}
              </Link>
              <Badge tone="success">{t('mpsDashboardLatestMobilizationCompleted')}</Badge>
            </div>
            <p className="text-xs text-text-secondary">
              {latestMobilization.referenceNumber} · {latestMobilization.projectName} · {latestMobilization.countryName} ·{' '}
              {latestMobilization.craftName}
            </p>
            <p className="mt-1 text-xs text-text-secondary">{formatDate(latestMobilization.mobilizedAt, language)}</p>
          </div>
        </div>
      ) : (
        <EmptyState title={t('mpsDashboardLatestMobilizationEmpty')} />
      )}
    </Card>
  );
}
