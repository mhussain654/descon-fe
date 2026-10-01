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
    <ul className="flex flex-col divide-y divide-border-default">
      {rows.map((row, index) => {
        const Icon = ACTIVITY_ICON[row.type];
        return (
          <li key={`${row.candidateAssignmentPublicId}-${row.type}-${index}`} className="flex items-center gap-3 py-2.5 text-sm">
            <Icon className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <span className="flex-1 text-text-primary">{t(ACTIVITY_LABEL_KEYS[row.type])}</span>
            <span className="text-text-secondary">{row.referenceNumber}</span>
            <span className="shrink-0 font-medium text-text-primary">{formatDate(row.occursOn, language)}</span>
          </li>
        );
      })}
    </ul>
  );
}
