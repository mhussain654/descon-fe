import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Download, Filter, Hammer, Plane, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Button, Card, ErrorState, ForbiddenState, LoadingState, OfflineState, Select, ValidationMessage } from '../../../../design-system';
import { REPORT_ERROR_KEYS } from '../../../../../../shared/adminReports/errorMessages';
import { REPORT_TYPE_LABEL_KEYS } from '../../../../../../shared/adminReports/reportTypeLabels';
import type { ReportData, ReportExportFormat, ReportType, TrendGranularity } from '../../../../lib/admin-reports-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { useReportData } from '../hooks/useReportData';
import { useReportExport } from '../hooks/useReportExport';
import { useReportTypes } from '../hooks/useReportTypes';
import {
  ConversionTable,
  CraftSummaryTable,
  MobilizationTables,
  OutcomeTrackingTiles,
  StatusSummaryTable,
  TrendTable,
  type TFn,
} from './ReportTables';
import { TrendChart } from './ReportCharts';

const GRANULARITY_OPTIONS: { value: TrendGranularity; labelKey: TranslationKey }[] = [
  { value: 'daily', labelKey: 'reportsGranularityDaily' },
  { value: 'weekly', labelKey: 'reportsGranularityWeekly' },
  { value: 'monthly', labelKey: 'reportsGranularityMonthly' },
];

const EXPORT_FORMATS: { format: ReportExportFormat; labelKey: TranslationKey }[] = [
  { format: 'csv', labelKey: 'reportsExportCsv' },
  { format: 'xlsx', labelKey: 'reportsExportXlsx' },
  { format: 'pdf', labelKey: 'reportsExportPdf' },
];

const ALL_REPORT_TYPES = Object.keys(REPORT_TYPE_LABEL_KEYS) as ReportType[];

const REPORT_META: Record<ReportType, { descriptionKey: TranslationKey; icon: typeof BarChart3; accent: string; active: string }> = {
  status_summary: { descriptionKey: 'reportDescriptionStatusSummary', icon: Activity, accent: 'border-t-brand text-brand', active: 'border-brand bg-brand-subtle/45 ring-2 ring-brand/15' },
  mobilization: { descriptionKey: 'reportDescriptionMobilization', icon: Plane, accent: 'border-t-info text-info-emphasis', active: 'border-info bg-info-subtle/45 ring-2 ring-info/15' },
  craft_summary: { descriptionKey: 'reportDescriptionCraftSummary', icon: Hammer, accent: 'border-t-success text-success-emphasis', active: 'border-success bg-success-subtle/45 ring-2 ring-success/15' },
  outcome_tracking: { descriptionKey: 'reportDescriptionOutcomeTracking', icon: AlertTriangle, accent: 'border-t-danger text-danger-emphasis', active: 'border-danger bg-danger-subtle/45 ring-2 ring-danger/15' },
  conversion: { descriptionKey: 'reportDescriptionConversion', icon: Filter, accent: 'border-t-warning text-warning-emphasis', active: 'border-warning bg-warning-subtle/45 ring-2 ring-warning/15' },
  trend: { descriptionKey: 'reportDescriptionTrend', icon: TrendingUp, accent: 'border-t-brand text-brand', active: 'border-brand bg-brand-subtle/45 ring-2 ring-brand/15' },
};

/**
 * The MIS report browser/exporter (MPS-804/805/806): pick a report type
 * (and, for the trend report, a granularity), view its data inline, or
 * export it as CSV/XLSX/PDF. No RequireStaffAuth permission prop -- gating
 * happens via the query's own FORBIDDEN state, same as
 * PaymentTransactionList.tsx.
 */
export function ReportsWorkspace() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [reportType, setReportType] = useState<ReportType>('status_summary');
  const [granularity, setGranularity] = useState<TrendGranularity>('monthly');

  const typesQuery = useReportTypes();
  const dataQuery = useReportData(reportType, reportType === 'trend' ? { granularity } : undefined, true);
  const exportMutation = useReportExport();

  useEffect(() => {
    if (dataQuery.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (dataQuery.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [dataQuery.error, signOut]);

  const reportTypes = [...new Set([...(typesQuery.data ?? []), ...ALL_REPORT_TYPES])];
  const reportTypeOptions = reportTypes.map((type) => ({
    value: type,
    label: t(REPORT_TYPE_LABEL_KEYS[type] as TranslationKey),
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4 px-6 py-7 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="max-w-2xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('reportsEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('reportsTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('reportsSubtitle')}</p>
          </div>
        </div>
      </div>

      <section className="mb-5" aria-labelledby="report-library-title">
        <div className="mb-3">
          <h2 id="report-library-title" className="font-semibold text-text-primary">{t('reportsLibraryTitle')}</h2>
          <p className="text-xs text-text-secondary">{t('reportsLibrarySubtitle')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reportTypes.map((type) => {
            const meta = REPORT_META[type];
            const Icon = meta.icon;
            const selected = reportType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setReportType(type)}
                aria-pressed={selected}
                className={`rounded-xl border border-t-4 bg-surface-raised p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${meta.accent} ${selected ? meta.active : 'border-border'}`}
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-current/10">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="font-semibold text-text-primary">{t(REPORT_TYPE_LABEL_KEYS[type] as TranslationKey)}</div>
                <div className="mt-1 text-xs leading-5 text-text-secondary">{t(meta.descriptionKey)}</div>
              </button>
            );
          })}
        </div>
      </section>

      <Card className="mb-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <Select
              label={t('reportsSelectTypeLabel')}
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType)}
              options={reportTypeOptions}
            />
            {reportType === 'trend' ? (
              <Select
                label={t('reportsSelectGranularityLabel')}
                value={granularity}
                onChange={(event) => setGranularity(event.target.value as TrendGranularity)}
                options={GRANULARITY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
              />
            ) : null}
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t('reportsExportTitle')}
            </div>
            <div className="flex flex-wrap gap-2">
              {EXPORT_FORMATS.map((option) => (
                <Button
                  key={option.format}
                  variant="outline"
                  size="sm"
                  loading={exportMutation.isPending && exportMutation.variables?.format === option.format}
                  onClick={() => exportMutation.mutate({ reportType, format: option.format, params: reportType === 'trend' ? { granularity } : undefined })}
                >
                  {t(option.labelKey)}
                </Button>
              ))}
            </div>
          </div>
        </div>
        {exportMutation.isError ? (
          <div className="mt-3">
            <ValidationMessage tone="error">
              {exportMutation.error.message ?? t(REPORT_ERROR_KEYS[exportMutation.error.code] as TranslationKey)}
            </ValidationMessage>
          </div>
        ) : null}
      </Card>

      <ReportContent query={dataQuery} t={t} language={language} granularity={granularity} />
    </div>
  );
}

function ReportContent({
  query,
  t,
  language,
  granularity,
}: {
  query: ReturnType<typeof useReportData>;
  t: TFn;
  language: Language;
  granularity: TrendGranularity;
}) {
  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (query.isError && !query.data) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return (
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
      );
    }
    if (error?.code === 'FORBIDDEN') {
      return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    }
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') {
      // signOut() (triggered above) hands off to RequireStaffAuth's own redirect -- nothing further to render here.
      return null;
    }
    const messageKey = (error ? REPORT_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  if (!query.data) return null;

  return <ReportTable data={query.data} t={t} language={language} granularity={granularity} />;
}

function ReportTable({
  data,
  t,
  language,
  granularity,
}: {
  data: ReportData;
  t: TFn;
  language: Language;
  granularity: TrendGranularity;
}) {
  switch (data.type) {
    case 'status_summary':
      return <StatusSummaryTable rows={data.rows} t={t} />;
    case 'craft_summary':
      return <CraftSummaryTable rows={data.rows} t={t} language={language} />;
    case 'conversion':
      return <ConversionTable rows={data.rows} t={t} />;
    case 'trend':
      return (
        <div className="flex flex-col gap-4">
          {data.rows.length > 0 ? (
            <Card>
              <TrendChart rows={data.rows} granularity={granularity} language={language} />
            </Card>
          ) : null}
          <TrendTable rows={data.rows} t={t} />
        </div>
      );
    case 'mobilization':
      return <MobilizationTables summary={data.summary} t={t} />;
    case 'outcome_tracking':
      return <OutcomeTrackingTiles summary={data.summary} t={t} />;
  }
}
