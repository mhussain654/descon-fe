import {
  Card,
  DataTable,
  EmptyState,
  StatTile,
  type DataTableColumn,
} from '../../../../design-system';
import { WORKFLOW_STAGE_LABEL_KEYS, type CanonicalWorkflowStageCode } from '../../../../../../shared/adminWorkflow/canonicalStages';
import type {
  ConversionRow,
  CraftSummaryRow,
  MobilizationRow,
  MobilizationSummary,
  OutcomeTracking,
  StatusSummaryRow,
  TrendPoint,
} from '../../../../lib/admin-reports-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

export type TFn = (key: TranslationKey) => string;

/**
 * Shared report-row table/tile renderers -- the MIS reports catalogue
 * (MPS-804/805/806) and the MPS/Management dashboards (MPS-802/803) all
 * surface the exact same aggregated shapes (status/craft/conversion/trend
 * rows, the country/project mobilization split, the flat outcome-tracking
 * summary), so the rendering lives here once rather than three times over.
 */

export function stageLabel(code: string, t: TFn): string {
  const key = WORKFLOW_STAGE_LABEL_KEYS[code as CanonicalWorkflowStageCode] as TranslationKey | undefined;
  return key ? t(key) : code;
}

export function emptyState(t: TFn) {
  return <EmptyState title={t('dashboardEmptyTitle')} description={t('dashboardEmptyDescription')} />;
}

export function StatusSummaryTable({ rows, t }: { rows: StatusSummaryRow[]; t: TFn }) {
  const columns: DataTableColumn<StatusSummaryRow>[] = [
    { key: 'stage', header: t('reportColumnStage'), render: (row) => stageLabel(row.code, t) },
    { key: 'count', header: t('reportColumnCount'), render: (row) => row.count },
  ];
  return (
    <Card noPadding>
      <DataTable columns={columns} rows={rows} getRowId={(row) => row.code} emptyState={emptyState(t)} />
    </Card>
  );
}

export function CraftSummaryTable({ rows, t }: { rows: CraftSummaryRow[]; t: TFn }) {
  const columns: DataTableColumn<CraftSummaryRow>[] = [
    { key: 'name', header: t('reportColumnName'), render: (row) => row.name },
    { key: 'total', header: t('reportColumnTotal'), render: (row) => row.total },
    { key: 'mobilized', header: t('reportColumnMobilized'), render: (row) => row.mobilized },
  ];
  return (
    <Card noPadding>
      <DataTable columns={columns} rows={rows} getRowId={(row) => row.code} emptyState={emptyState(t)} />
    </Card>
  );
}

export function ConversionTable({ rows, t }: { rows: ConversionRow[]; t: TFn }) {
  const columns: DataTableColumn<ConversionRow>[] = [
    { key: 'stage', header: t('reportColumnStage'), render: (row) => stageLabel(row.code, t) },
    { key: 'count', header: t('reportColumnCount'), render: (row) => row.count },
    { key: 'percentage', header: t('reportColumnPercentage'), render: (row) => `${row.percentage}%` },
  ];
  return (
    <Card noPadding>
      <DataTable columns={columns} rows={rows} getRowId={(row) => row.code} emptyState={emptyState(t)} />
    </Card>
  );
}

export function TrendTable({ rows, t }: { rows: TrendPoint[]; t: TFn }) {
  const columns: DataTableColumn<TrendPoint>[] = [
    { key: 'period', header: t('reportColumnPeriod'), render: (row) => row.period },
    { key: 'count', header: t('reportColumnCount'), render: (row) => row.count },
  ];
  return (
    <Card noPadding>
      <DataTable columns={columns} rows={rows} getRowId={(row) => row.period} emptyState={emptyState(t)} />
    </Card>
  );
}

function MobilizationRowTable({ rows, t }: { rows: MobilizationRow[]; t: TFn }) {
  const columns: DataTableColumn<MobilizationRow>[] = [
    { key: 'name', header: t('reportColumnName'), render: (row) => row.name },
    { key: 'count', header: t('reportColumnCount'), render: (row) => row.count },
  ];
  return (
    <Card noPadding>
      <DataTable columns={columns} rows={rows} getRowId={(row) => row.code} emptyState={emptyState(t)} />
    </Card>
  );
}

export function MobilizationTables({ summary, t }: { summary: MobilizationSummary; t: TFn }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('mpsDashboardMobilizationByCountryTitle')}</h2>
        <MobilizationRowTable rows={summary.byCountry} t={t} />
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('mpsDashboardMobilizationByProjectTitle')}</h2>
        <MobilizationRowTable rows={summary.byProject} t={t} />
      </div>
    </div>
  );
}

export function OutcomeTrackingTiles({ summary, t }: { summary: OutcomeTracking; t: TFn }) {
  return (
    <Card>
      <div className="flex flex-wrap gap-2">
        <StatTile value={summary.rejectedDocuments} label={t('reportOutcomeRejectedDocuments')} className="bg-[#FEF2F2] text-[#EF4444]" />
        <StatTile value={summary.qvcReMedical} label={t('reportOutcomeQvcReMedical')} className="bg-[#FFF7E6] text-[#F59E0B]" />
        <StatTile value={summary.qvcRejected} label={t('reportOutcomeQvcRejected')} className="bg-[#FEF2F2] text-[#EF4444]" />
        <StatTile value={summary.qvcNoShow} label={t('reportOutcomeQvcNoShow')} className="bg-[#F6F6F6] text-[#6B7280]" />
        <StatTile value={summary.visaRejected} label={t('reportOutcomeVisaRejected')} className="bg-[#FEF2F2] text-[#EF4444]" />
      </div>
    </Card>
  );
}
