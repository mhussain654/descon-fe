import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Card, ErrorState, ForbiddenState, LoadingState, OfflineState, Select, StatTile } from '../../../../design-system';
import { MPS_DASHBOARD_ERROR_KEYS } from '../../../../../../shared/adminMpsDashboard/errorMessages';
import type { TrendGranularity } from '../../../../lib/admin-mps-dashboard-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { CraftSummaryTable, MobilizationTables, stageLabel, TrendTable, type TFn } from '../../reports/components/ReportTables';
import { CategoryBarChart, TrendChart } from '../../reports/components/ReportCharts';
import { useMpsDashboard } from '../hooks/useMpsDashboard';

const GRANULARITY_OPTIONS: { value: TrendGranularity; labelKey: TranslationKey }[] = [
  { value: 'daily', labelKey: 'reportsGranularityDaily' },
  { value: 'weekly', labelKey: 'reportsGranularityWeekly' },
  { value: 'monthly', labelKey: 'reportsGranularityMonthly' },
];

/**
 * The MPS dashboard (MPS-802): pipeline/status queues, delayed/critical
 * case counts, craft-wise and mobilization summaries, and the mobilization
 * trend. No RequireStaffAuth permission prop -- gating happens via the
 * query's own FORBIDDEN state, same as PaymentTransactionList.tsx.
 */
export function MpsDashboard() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [granularity, setGranularity] = useState<TrendGranularity>('monthly');
  const query = useMpsDashboard(granularity);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('mpsDashboardTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('mpsDashboardSubtitle')}</p>
      </div>

      <DashboardContent query={query} granularity={granularity} onGranularityChange={setGranularity} t={t} language={language} />
    </div>
  );
}

function DashboardContent({
  query,
  granularity,
  onGranularityChange,
  t,
  language,
}: {
  query: ReturnType<typeof useMpsDashboard>;
  granularity: TrendGranularity;
  onGranularityChange: (value: TrendGranularity) => void;
  t: TFn;
  language: Language;
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
    const messageKey = (error ? MPS_DASHBOARD_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  if (!data) return null;

  const workflowStageChartData = data.workflowStageQueue.map((row) => ({
    key: row.code,
    label: stageLabel(row.code, t),
    value: row.count,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('mpsDashboardDelayedCasesTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          <StatTile value={data.delayedCases.delayed} label={t('mpsDashboardDelayed')} className="bg-warning-subtle text-warning-emphasis" icon={<Clock />} />
          <StatTile value={data.delayedCases.critical} label={t('mpsDashboardCritical')} className="bg-danger-subtle text-danger-emphasis" icon={<AlertTriangle />} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-text-primary">{t('dashboardWorkflowStageQueueTitle')}</h2>
        <p className="mb-2 text-xs text-text-secondary">{t('dashboardWorkflowStageQueueSubtitle')}</p>
        <div className="mb-4">
          <CategoryBarChart data={workflowStageChartData} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {data.workflowStageQueue.map((row) => (
            <StatTile key={row.code} value={row.count} label={stageLabel(row.code, t)} className="bg-surface-sunken text-text-secondary" />
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('mpsDashboardCraftSummaryTitle')}</h2>
        <CraftSummaryTable rows={data.craftSummary} t={t} />
      </div>

      <MobilizationTables summary={data.mobilization} t={t} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">{t('mpsDashboardTrendTitle')}</h2>
          <Select
            value={granularity}
            onChange={(event) => onGranularityChange(event.target.value as TrendGranularity)}
            options={GRANULARITY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          />
        </div>
        {data.mobilizationTrend.length > 0 ? (
          <Card className="mb-4">
            <TrendChart rows={data.mobilizationTrend} granularity={granularity} language={language} />
          </Card>
        ) : null}
        <TrendTable rows={data.mobilizationTrend} t={t} />
      </div>
    </div>
  );
}
