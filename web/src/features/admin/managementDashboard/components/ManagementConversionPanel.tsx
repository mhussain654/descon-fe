import { ArrowRight, FileCheck2, BadgeCheck, Plane } from 'lucide-react';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { ConversionRow } from '../../../../lib/admin-management-dashboard-client';
import { stageLabel, type TFn } from '../../reports/components/ReportTables';

const STAGE_TONES = [
  { code: 'documents_uploaded', icon: FileCheck2, bar: 'bg-brand', badge: 'bg-brand-subtle text-brand' },
  { code: 'verified', icon: BadgeCheck, bar: 'bg-success', badge: 'bg-success-subtle text-success-emphasis' },
  { code: 'mobilized', icon: Plane, bar: 'bg-info', badge: 'bg-info-subtle text-info-emphasis' },
] as const;

export function ManagementConversionPanel({ rows, t, language }: { rows: ConversionRow[]; t: TFn; language: Language }) {
  const maximumCount = Math.max(...rows.map((row) => row.count), 0);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {rows.map((row, index) => {
        const tone = STAGE_TONES.find((stage) => stage.code === row.code) ?? STAGE_TONES[0];
        const Icon = tone.icon;
        const width = maximumCount > 0 ? (row.count / maximumCount) * 100 : 0;
        return (
          <div key={row.code} className="relative min-w-0 rounded-xl border border-border bg-surface-sunken/40 p-4">
            {index < rows.length - 1 ? (
              <span className="absolute -right-5 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface-raised text-text-tertiary lg:flex rtl:-left-5 rtl:right-auto rtl:rotate-180">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : null}
            <span className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${tone.badge}`} aria-hidden="true"><Icon className="h-5 w-5" /></span>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-text-secondary">{stageLabel(row.code, t)}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-text-primary">{formatNumber(row.count, language)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${tone.badge}`}>
                {formatNumber(row.percentage, language, { maximumFractionDigits: 1 })}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
              <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
