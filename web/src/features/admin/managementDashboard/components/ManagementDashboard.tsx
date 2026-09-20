import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, FileCheck2, Plane, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';
import { Card, ErrorState, ForbiddenState, LoadingState, OfflineState, Select, StatTile } from '../../../../design-system';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { MANAGEMENT_DASHBOARD_ERROR_KEYS } from '../../../../../../shared/adminManagementDashboard/errorMessages';
import type { TrendGranularity } from '../../../../lib/admin-management-dashboard-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import { TrendChart } from '../../reports/components/ReportCharts';
import { stageLabel, type TFn } from '../../reports/components/ReportTables';
import { useManagementDashboard } from '../hooks/useManagementDashboard';
import { ManagementConversionPanel } from './ManagementConversionPanel';
import { ManagementOutcomePanel } from './ManagementOutcomePanel';
import { MobilizationMix } from '../../mpsDashboard/components/MobilizationMix';

const GRANULARITY_OPTIONS: { value: TrendGranularity; labelKey: TranslationKey }[] = [
  { value: 'daily', labelKey: 'reportsGranularityDaily' },
  { value: 'weekly', labelKey: 'reportsGranularityWeekly' },
  { value: 'monthly', labelKey: 'reportsGranularityMonthly' },
];

const KPI_TILE_CLASSNAME =
  'min-w-0 overflow-hidden border-border border-t-4 bg-surface-raised shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md';

export function ManagementDashboard() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [granularity, setGranularity] = useState<TrendGranularity>('monthly');
  const query = useManagementDashboard(granularity);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') signOut('expired');
    else if (query.error?.code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, signOut]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">{t('managementDashboardHeroEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('managementDashboardTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('managementDashboardSubtitle')}</p>
          </div>
          <Link to="/admin/reports" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand">
            {t('managementDashboardViewReports')}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <DashboardContent query={query} granularity={granularity} onGranularityChange={setGranularity} t={t} language={language} />
    </div>
  );
}

function DashboardContent({ query, granularity, onGranularityChange, t, language }: {
  query: ReturnType<typeof useManagementDashboard>;
  granularity: TrendGranularity;
  onGranularityChange: (value: TrendGranularity) => void;
  t: TFn;
  language: Language;
}) {
  if (query.isLoading) return <LoadingState message={t('loading')} />;

  if (query.isError && !query.data) {
    const error = query.error;
    if (error?.code === 'OFFLINE') return <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
    if (error?.code === 'FORBIDDEN') return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') return null;
    const messageKey = (error ? MANAGEMENT_DASHBOARD_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  if (!data) return null;
  const documentsUploaded = data.conversionFunnel.find((row) => row.code === 'documents_uploaded');
  const verified = data.conversionFunnel.find((row) => row.code === 'verified');
  const mobilized = data.conversionFunnel.find((row) => row.code === 'mobilized');
  const exceptionCount = Object.values(data.outcomeTracking).reduce((sum, count) => sum + count, 0);
  const percentage = (value: number | undefined) => `${formatNumber(value ?? 0, language, { maximumFractionDigits: 1 })}%`;

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="management-key-metrics">
        <div className="mb-3">
          <h2 id="management-key-metrics" className="text-base font-semibold text-text-primary">{t('managementDashboardKeyMetricsTitle')}</h2>
          <p className="text-xs text-text-secondary">{t('managementDashboardKeyMetricsSubtitle')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-5">
          <StatTile value={percentage(documentsUploaded?.percentage)} label={t('managementDashboardDocumentCompletion')} className={`${KPI_TILE_CLASSNAME} border-t-brand text-brand`} icon={<FileCheck2 />} />
          <StatTile value={percentage(verified?.percentage)} label={t('managementDashboardVerificationRate')} className={`${KPI_TILE_CLASSNAME} border-t-success text-success-emphasis`} icon={<BadgeCheck />} />
          <StatTile value={mobilized?.count ?? 0} label={stageLabel('mobilized', t)} className={`${KPI_TILE_CLASSNAME} border-t-info text-info-emphasis`} icon={<Plane />} />
          <StatTile value={exceptionCount} label={t('managementDashboardTotalExceptions')} className={`${KPI_TILE_CLASSNAME} border-t-danger text-danger-emphasis`} icon={<ShieldAlert />} />
        </div>
      </section>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
        <Card className="shadow-sm">
          <h2 className="text-base font-semibold text-text-primary">{t('managementDashboardConversionTitle')}</h2>
          <p className="mb-5 text-xs text-text-secondary">{t('managementDashboardConversionSubtitle')}</p>
          <ManagementConversionPanel rows={data.conversionFunnel} t={t} language={language} />
        </Card>
        <Card className="border-danger/10 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary">{t('managementDashboardOutcomeTrackingTitle')}</h2>
          <p className="mb-4 text-xs text-text-secondary">{t('managementDashboardOutcomeTrackingSubtitle')}</p>
          <ManagementOutcomePanel summary={data.outcomeTracking} t={t} language={language} />
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <MobilizationMix summary={data.mobilization} t={t} language={language} />
        <Card className="shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">{t('managementDashboardMobilizationTrendTitle')}</h2>
              <p className="text-xs text-text-secondary">{t('managementDashboardMobilizationTrendSubtitle')}</p>
            </div>
            <Select label={t('reportsSelectGranularityLabel')} value={granularity} onChange={(event) => onGranularityChange(event.target.value as TrendGranularity)} options={GRANULARITY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))} />
          </div>
          {data.mobilizationTrend.length > 0 ? (
            <TrendChart rows={data.mobilizationTrend} granularity={granularity} language={language} />
          ) : (
            <div className="flex min-h-56 items-center justify-center rounded-xl bg-surface-sunken text-sm text-text-secondary">{t('managementDashboardTrendEmpty')}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
