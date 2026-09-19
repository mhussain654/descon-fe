import { FileX, RefreshCw, UserX, XCircle } from 'lucide-react';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { OutcomeTracking } from '../../../../lib/admin-management-dashboard-client';
import type { TFn } from '../../reports/components/ReportTables';

export function ManagementOutcomePanel({ summary, t, language }: { summary: OutcomeTracking; t: TFn; language: Language }) {
  const rows = [
    { key: 'rejectedDocuments', label: t('reportOutcomeRejectedDocuments'), value: summary.rejectedDocuments, icon: FileX, tone: 'bg-danger-subtle text-danger-emphasis' },
    { key: 'qvcReMedical', label: t('reportOutcomeQvcReMedical'), value: summary.qvcReMedical, icon: RefreshCw, tone: 'bg-warning-subtle text-warning-emphasis' },
    { key: 'qvcRejected', label: t('reportOutcomeQvcRejected'), value: summary.qvcRejected, icon: XCircle, tone: 'bg-danger-subtle text-danger-emphasis' },
    { key: 'qvcNoShow', label: t('reportOutcomeQvcNoShow'), value: summary.qvcNoShow, icon: UserX, tone: 'bg-surface-sunken text-text-secondary' },
    { key: 'visaRejected', label: t('reportOutcomeVisaRejected'), value: summary.visaRejected, icon: XCircle, tone: 'bg-danger-subtle text-danger-emphasis' },
  ].sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ key, label, value, icon: Icon, tone }) => {
        const share = total > 0 ? (value / total) * 100 : 0;
        return (
          <div key={key} className="flex items-center gap-3 rounded-xl bg-surface-sunken/55 px-3 py-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium text-text-primary">{label}</span>
                <span className="font-semibold tabular-nums text-text-primary">{formatNumber(value, language)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
                <div className="h-full rounded-full bg-danger" style={{ width: `${share}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
