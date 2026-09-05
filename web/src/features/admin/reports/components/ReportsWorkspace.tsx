import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Button, Card, ErrorState, ForbiddenState, LoadingState, OfflineState, Select, ValidationMessage } from '../../../../design-system';
import { REPORT_ERROR_KEYS } from '../../../../../../shared/adminReports/errorMessages';
import { REPORT_TYPE_LABEL_KEYS } from '../../../../../../shared/adminReports/reportTypeLabels';
import type { ReportData, ReportExportFormat, ReportType, TrendGranularity } from '../../../../lib/admin-reports-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
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

/**
 * The MIS report browser/exporter (MPS-804/805/806): pick a report type
 * (and, for the trend report, a granularity), view its data inline, or
 * export it as CSV/XLSX/PDF. No RequireStaffAuth permission prop -- gating
 * happens via the query's own FORBIDDEN state, same as
 * PaymentTransactionList.tsx.
 */
export function ReportsWorkspace() {
  const { t } = useLanguage();
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

  const reportTypeOptions = (typesQuery.data ?? ALL_REPORT_TYPES).map((type) => ({
    value: type,
    label: t(REPORT_TYPE_LABEL_KEYS[type] as TranslationKey),
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('reportsTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('reportsSubtitle')}</p>
      </div>

      <Card className="mb-4">
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
          <div className="flex flex-wrap gap-2">
            {EXPORT_FORMATS.map((option) => (
              <Button
                key={option.format}
                variant="outline"
                size="sm"
                loading={exportMutation.isPending && exportMutation.variables?.format === option.format}
                onClick={() =>
                  exportMutation.mutate({
                    reportType,
                    format: option.format,
                    params: reportType === 'trend' ? { granularity } : undefined,
                  })
                }
              >
                {t(option.labelKey)}
              </Button>
            ))}
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

      <ReportContent query={dataQuery} t={t} />
    </div>
  );
}

function ReportContent({ query, t }: { query: ReturnType<typeof useReportData>; t: TFn }) {
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

  return <ReportTable data={query.data} t={t} />;
}

function ReportTable({ data, t }: { data: ReportData; t: TFn }) {
  switch (data.type) {
    case 'status_summary':
      return <StatusSummaryTable rows={data.rows} t={t} />;
    case 'craft_summary':
      return <CraftSummaryTable rows={data.rows} t={t} />;
    case 'conversion':
      return <ConversionTable rows={data.rows} t={t} />;
    case 'trend':
      return <TrendTable rows={data.rows} t={t} />;
    case 'mobilization':
      return <MobilizationTables summary={data.summary} t={t} />;
    case 'outcome_tracking':
      return <OutcomeTrackingTiles summary={data.summary} t={t} />;
  }
}
