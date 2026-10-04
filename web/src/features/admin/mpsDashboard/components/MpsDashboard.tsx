import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Clock, Plane, ShieldCheck, LayoutDashboard, BarChart3 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
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
import { useMpsDashboard } from '../hooks/useMpsDashboard';
import { MpsOperationalInsightBanner } from './MpsOperationalInsightBanner';
import { OperationsAttentionTable } from './OperationsAttentionTable';
import { OperationsPipeline } from './OperationsPipeline';
import { MobilizationMix } from './MobilizationMix';
import { LatestMobilizationCard } from './LatestMobilizationCard';
import { CraftPerformancePanel } from './CraftPerformancePanel';

const GRANULARITY_OPTIONS: { value: TrendGranularity; labelKey: TranslationKey }[] = [
  { value: 'daily', labelKey: 'reportsGranularityDaily' },
  { value: 'weekly', labelKey: 'reportsGranularityWeekly' },
  { value: 'monthly', labelKey: 'reportsGranularityMonthly' },
];

const KPI_TILE_CLASSNAME =
  'min-w-0 overflow-hidden border-border border-t-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md';

const SECTIONS = [
  ['overview', 'operationsOverview', LayoutDashboard, '✨'],
  ['pipeline', 'operationsPipeline', BarChart3, '📊'],
  ['mobilization', 'operationsMobilization', Plane, '✈️'],
] as const;
type Section = (typeof SECTIONS)[number][0];

export function MpsDashboard() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [section, setSection] = useState<Section>('overview');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
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
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-blue-700 shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">{t('mpsDashboardHeroEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"><span aria-hidden="true">🚀 </span>{t('mpsDashboardTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('mpsDashboardSubtitle')}</p>
          </div>
          <Link
            to="/admin/reports"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
          >
            {t('mpsDashboardViewReports')}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <DashboardFilterBar filters={filters} onChange={updateFilters} t={t} />

      <div role="tablist" aria-label={t('operationsTabsLabel')} dir={language === 'ur' ? 'rtl' : 'ltr'} className="mb-5 grid gap-2 rounded-2xl border border-border bg-surface p-2 sm:grid-cols-3">
        {SECTIONS.map(([id, label, Icon, emoji], index) => <button key={id} ref={(element) => { tabs.current[index] = element; }} type="button" role="tab" id={`operations-tab-${id}`} aria-controls={`operations-panel-${id}`} aria-selected={section === id} tabIndex={section === id ? 0 : -1}
          onClick={() => setSection(id)} onKeyDown={(event) => {
            let target: number | undefined;
            if (event.key === 'Home') target = 0;
            if (event.key === 'End') target = 2;
            if (event.key === 'ArrowRight') target = (index + (language === 'ur' ? -1 : 1) + 3) % 3;
            if (event.key === 'ArrowLeft') target = (index + (language === 'ur' ? 1 : -1) + 3) % 3;
            if (target !== undefined) { event.preventDefault(); setSection(SECTIONS[target][0]); tabs.current[target]?.focus(); }
          }} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-ring ${section === id ? 'bg-brand text-white shadow-md' : 'text-text-secondary hover:bg-brand-subtle hover:text-brand'}`}>
          <Icon className="h-5 w-5" aria-hidden="true" /><span>{t(label)}</span><span aria-hidden="true">{emoji}</span>
        </button>)}
      </div>
      <section role="tabpanel" id={`operations-panel-${section}`} aria-labelledby={`operations-tab-${section}`} tabIndex={0} dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <DashboardContent section={section} filters={filters} query={query} granularity={granularity} onGranularityChange={setGranularity} t={t} language={language} />
      </section>
    </div>
  );
}

function DashboardContent({
  section,
  filters,
  query,
  granularity,
  onGranularityChange,
  t,
  language,
}: {
  section: Section;
  filters: MpsDashboardFilters;
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
      {section === 'overview' ? <>
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
            labelClassName="text-current"
            value={data.delayedCases.critical}
            label={t('mpsDashboardCritical')}
            className={`${KPI_TILE_CLASSNAME} border-t-danger bg-danger-subtle text-danger-emphasis`}
            icon={<AlertTriangle />}
          />
          <StatTile
            labelClassName="text-current"
            value={data.delayedCases.delayed}
            label={t('mpsDashboardDelayed')}
            className={`${KPI_TILE_CLASSNAME} border-t-warning bg-warning-subtle text-warning-emphasis`}
            icon={<Clock />}
          />
          <StatTile
            labelClassName="text-current"
            value={qvcVisaStageCount}
            label={t('mpsDashboardQvcVisaStage')}
            className={`${KPI_TILE_CLASSNAME} border-t-brand bg-brand-subtle text-brand`}
            icon={<ShieldCheck />}
          />
          <StatTile
            labelClassName="text-current"
            value={mobilizedCount}
            label={stageLabel('mobilized', t)}
            className={`${KPI_TILE_CLASSNAME} border-t-success bg-success-subtle text-success-emphasis`}
            icon={<Plane />}
            trend={
              <p className="text-[11px] text-current">
                {mobilizationRateDisplay}% {t('mpsDashboardMobilizationRateLabel').toLowerCase()}
              </p>
            }
          />
        </div>
      </section>

      <OperationsAttentionTable rows={data.attentionCandidates} delayedCases={data.delayedCases} t={t} />
      <OperationsPipeline rows={data.workflowStageQueue} filters={filters} t={t} />
      <LatestMobilizationCard latestMobilization={data.latestMobilization} t={t} language={language} />
      </> : null}
      {section === 'pipeline' ? <>
        <OperationsPipeline rows={data.workflowStageQueue} filters={filters} graphical t={t} />
        <Card className="shadow-sm">
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
      </> : null}
      {section === 'mobilization' ? <>
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
          ) : (
            <div className="flex min-h-56 items-center justify-center rounded-xl bg-surface-sunken text-sm text-text-secondary">
              {t('mpsDashboardTrendEmpty')}
            </div>
          )}
        </Card>

        <LatestMobilizationCard latestMobilization={data.latestMobilization} t={t} language={language} />
      </div>
      </> : null}
    </div>
  );
}
