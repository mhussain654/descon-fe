import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, Plane, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Card, ErrorState, ForbiddenState, LoadingState, OfflineState, Select, StatTile } from '../../../../design-system';
import { MPS_DASHBOARD_ERROR_KEYS } from '../../../../../../shared/adminMpsDashboard/errorMessages';
import type { MpsDashboardFilters, TrendGranularity } from '../../../../lib/admin-mps-dashboard-client';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { stageLabel, type TFn } from '../../reports/components/ReportTables';
import { TrendChart } from '../../reports/components/ReportCharts';
import { DashboardFilterBar } from '../../reports/components/DashboardFilterBar';
import { readDashboardFiltersFromSearchParams, writeDashboardFiltersToSearchParams } from '../../reports/dashboardFiltersUrlState';
import { groupStagesByPipelineBucket } from '../../reports/workflowPipelineBuckets';
import { WorkflowPipelineOverview } from '../../reports/components/WorkflowPipelineOverview';
import { useMpsDashboard } from '../hooks/useMpsDashboard';
import { MpsOperationalInsightBanner } from './MpsOperationalInsightBanner';
import { MpsRequiresAttentionPanel } from './MpsRequiresAttentionPanel';
import { MobilizationMix } from './MobilizationMix';
import { LatestMobilizationCard } from './LatestMobilizationCard';
import { CraftPerformancePanel } from './CraftPerformancePanel';

const GRANULARITY_OPTIONS: { value: TrendGranularity; labelKey: TranslationKey }[] = [
  { value: 'daily', labelKey: 'reportsGranularityDaily' },
  { value: 'weekly', labelKey: 'reportsGranularityWeekly' },
  { value: 'monthly', labelKey: 'reportsGranularityMonthly' },
];

const KPI_TILE_CLASSNAME =
  'min-w-0 overflow-hidden border-border border-t-4 bg-surface-raised shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md';

/**
 * The MPS dashboard (MPS-802): pipeline/status queues, delayed/critical
 * case counts, craft-wise and mobilization summaries, and the mobilization
 * trend. No RequireStaffAuth permission prop -- gating happens via the
 * query's own FORBIDDEN state, same as PaymentTransactionList.tsx.
 * Structured the same way as AdminDashboard.tsx (hero banner, filter bar,
 * insight banner, KPI tile row, requires-attention panel, elevated cards) --
 * see that component's own comments for the reasoning behind each piece,
 * this one doesn't repeat it. The dashboard uses the five-phase pipeline
 * summary for fast scanning; the complete 15-stage breakdown stays in the
 * reports workspace.
 */
export function MpsDashboard() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [granularity, setGranularity] = useState<TrendGranularity>('monthly');
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readDashboardFiltersFromSearchParams(searchParams);
  const query = useMpsDashboard(granularity, filters);

  const updateFilters = useCallback(
    (patch: Partial<MpsDashboardFilters>) => {
      setSearchParams(writeDashboardFiltersToSearchParams({ ...filters, ...patch }));
    },
    [filters, setSearchParams]
  );

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative px-6 py-7 lg:px-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">{t('mpsDashboardHeroEyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('mpsDashboardTitle')}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/80">{t('mpsDashboardSubtitle')}</p>
        </div>
      </div>

      <DashboardFilterBar filters={filters} onChange={updateFilters} t={t} />

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

  const mobilizedCount = data.workflowStageQueue.find((row) => row.code === 'mobilized')?.count ?? 0;
  const totalInPipeline = data.workflowStageQueue.reduce((sum, row) => sum + row.count, 0);
  const qvcVisaStageCount = groupStagesByPipelineBucket(data.workflowStageQueue).qvcVisaProtection;
  const mobilizationRate = totalInPipeline > 0 ? (mobilizedCount / totalInPipeline) * 100 : 0;
  const mobilizationRateDisplay = formatNumber(mobilizationRate, language, { maximumFractionDigits: 1 });
  const documentsUploadedConversion = data.conversionFunnel.find((row) => row.code === 'documents_uploaded');
  const verifiedConversion = data.conversionFunnel.find((row) => row.code === 'verified');

  return (
    <div className="flex flex-col gap-5">
      <MpsOperationalInsightBanner data={data} t={t} language={language} />

      <section aria-labelledby="mps-dashboard-key-metrics">
        <div className="mb-3">
          <h2 id="mps-dashboard-key-metrics" className="text-base font-semibold text-text-primary">
            {t('mpsDashboardKeyMetricsTitle')}
          </h2>
          <p className="text-xs text-text-secondary">{t('mpsDashboardKeyMetricsSubtitle')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-5">
          <StatTile
            value={data.delayedCases.delayed}
            label={t('mpsDashboardDelayed')}
            className={`${KPI_TILE_CLASSNAME} border-t-warning text-warning-emphasis`}
            icon={<Clock />}
          />
          <StatTile
            value={data.delayedCases.critical}
            label={t('mpsDashboardCritical')}
            className={`${KPI_TILE_CLASSNAME} border-t-danger text-danger-emphasis`}
            icon={<AlertTriangle />}
          />
          <StatTile
            value={qvcVisaStageCount}
            label={t('mpsDashboardQvcVisaStage')}
            className={`${KPI_TILE_CLASSNAME} border-t-brand text-brand`}
            icon={<ShieldCheck />}
          />
          <StatTile
            value={mobilizedCount}
            label={stageLabel('mobilized', t)}
            className={`${KPI_TILE_CLASSNAME} border-t-success text-success-emphasis`}
            icon={<Plane />}
            trend={
              <p className="text-[11px] text-text-secondary">
                {mobilizationRateDisplay}% {t('mpsDashboardMobilizationRateLabel').toLowerCase()}
              </p>
            }
          />
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.65fr)]">
        <Card className="shadow-sm">
          <h2 className="text-base font-semibold text-text-primary">{t('dashboardWorkflowStageQueueTitle')}</h2>
          <p className="mb-4 text-xs text-text-secondary">{t('dashboardWorkflowStageQueueSubtitle')}</p>
          <WorkflowPipelineOverview workflowStageQueue={data.workflowStageQueue} t={t} />
          {documentsUploadedConversion || verifiedConversion ? (
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-surface-sunken px-4 py-3 text-sm">
              {documentsUploadedConversion ? (
                <span className="text-text-secondary">
                  {t('adminDashboardDocumentCompletion')}:{' '}
                  <span className="font-semibold text-text-primary">
                    {formatNumber(documentsUploadedConversion.percentage, language, { maximumFractionDigits: 1 })}%
                  </span>
                </span>
              ) : null}
              {verifiedConversion ? (
                <span className="text-text-secondary">
                  {t('adminDashboardVerificationConversion')}:{' '}
                  <span className="font-semibold text-text-primary">
                    {formatNumber(verifiedConversion.percentage, language, { maximumFractionDigits: 1 })}%
                  </span>
                </span>
              ) : null}
              <span className="text-text-secondary">
                {t('mpsDashboardMobilizationRateLabel')}: <span className="font-semibold text-text-primary">{mobilizationRateDisplay}%</span>
              </span>
            </div>
          ) : null}
        </Card>

        <Card className="border-danger/10 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary">{t('adminDashboardRequiresAttentionTitle')}</h2>
          <p className="mb-3 text-xs text-text-secondary">{t('mpsDashboardRequiresAttentionSubtitle')}</p>
          <MpsRequiresAttentionPanel delayedCases={data.delayedCases} t={t} />
        </Card>
      </div>

      <Card className="shadow-sm">
        <h2 className="text-base font-semibold text-text-primary">{t('mpsDashboardCraftSummaryTitle')}</h2>
        <p className="mb-4 text-xs text-text-secondary">{t('mpsDashboardCraftSummarySubtitle')}</p>
        <CraftPerformancePanel rows={data.craftSummary} t={t} language={language} />
      </Card>

      <MobilizationMix summary={data.mobilization} t={t} language={language} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
        <Card className="shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">{t('mpsDashboardTrendTitle')}</h2>
            <Select
              label={t('reportsSelectGranularityLabel')}
              value={granularity}
              onChange={(event) => onGranularityChange(event.target.value as TrendGranularity)}
              options={GRANULARITY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
            />
          </div>
          {data.mobilizationTrend.length > 0 ? (
            <div className="mb-4">
              <TrendChart rows={data.mobilizationTrend} granularity={granularity} language={language} />
            </div>
          ) : null}
        </Card>

        <LatestMobilizationCard latestMobilization={data.latestMobilization} t={t} language={language} />
      </div>
    </div>
  );
}
