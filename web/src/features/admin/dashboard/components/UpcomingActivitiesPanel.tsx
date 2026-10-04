import { Calendar, Plane } from 'lucide-react';
import { EmptyState } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import type { UpcomingActivityRow, UpcomingActivityType } from '../../../../../../shared/adminDashboard/types';
import type { TFn } from '../../reports/components/ReportTables';

const ACTIVITY_ICON: Record<UpcomingActivityType, typeof Calendar> = {
  qvc_appointment: Calendar,
  flight_departure: Plane,
};

const ACTIVITY_LABEL_KEYS: Record<UpcomingActivityType, TranslationKey> = {
  qvc_appointment: 'adminDashboardActivityTypeQvcAppointment',
  flight_departure: 'adminDashboardActivityTypeFlightDeparture',
};

/** QVC appointments and flight departures in the next 7 days -- protection appearances aren't included yet (no forward-scheduled date column exists today, see the plan's Phase 3). No candidate-detail link: only the assignment's public id is available here, not the candidate's. */
export function UpcomingActivitiesPanel({ rows, t, language }: { rows: UpcomingActivityRow[]; t: TFn; language: Language }) {
  if (rows.length === 0) {
    return <EmptyState title={t('adminDashboardUpcomingActivitiesEmpty')} />;
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, index) => {
        const Icon = ACTIVITY_ICON[row.type];
        return (
          <li key={`${row.candidateAssignmentPublicId}-${row.type}-${index}`} className="relative flex min-w-0 items-start gap-3 rounded-xl border border-info/15 bg-info-subtle/40 p-4 text-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info-subtle text-info-emphasis" aria-hidden="true"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><span className="block font-semibold text-text-primary">{t(ACTIVITY_LABEL_KEYS[row.type])}</span>
            <span className="mt-1 block break-all text-xs text-text-secondary" dir="ltr">{row.referenceNumber}</span>
            <span className="mt-2 inline-block rounded-lg bg-surface-raised px-2 py-1 text-xs font-medium text-info-emphasis">{formatDate(row.occursOn, language)}</span></div>
          </li>
        );
      })}
    </ul>
  );
}
