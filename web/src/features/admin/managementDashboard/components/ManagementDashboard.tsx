import { useEffect, useState } from 'react';
import { Card, ErrorState, ForbiddenState, LoadingState, OfflineState, Select } from '../../../../design-system';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { MANAGEMENT_DASHBOARD_ERROR_KEYS } from '../../../../../../shared/adminManagementDashboard/errorMessages';
import type { TrendGranularity } from '../../../../lib/admin-management-dashboard-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { ConversionTable, MobilizationTables, OutcomeTrackingTiles, TrendTable, type TFn } from '../../reports/components/ReportTables';
import { TrendChart } from '../../reports/components/ReportCharts';
import { useManagementDashboard } from '../hooks/useManagementDashboard';

const GRANULARITY_OPTIONS: { value: TrendGranularity; labelKey: TranslationKey }[] = [
  { value: 'daily', labelKey: 'reportsGranularityDaily' },
  { value: 'weekly', labelKey: 'reportsGranularityWeekly' },
  { value: 'monthly', labelKey: 'reportsGranularityMonthly' },
];

/**
 * The Management dashboard (MPS-803): conversion/bottleneck KPIs, outcome
 * tracking, and country/project-wise mobilization insights over time. No
 * RequireStaffAuth permission prop -- gating happens via the query's own
 * FORBIDDEN state, same as PaymentTransactionList.tsx.
 */
export function ManagementDashboard() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [granularity, setGranularity] = useState<TrendGranularity>('monthly');
  const query = useManagementDashboard(granularity);

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
        <h1 className="text-2xl font-semibold text-text-primary">{t('managementDashboardTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('managementDashboardSubtitle')}</p>
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
  query: ReturnType<typeof useManagementDashboard>;
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
    const messageKey = (error ? MANAGEMENT_DASHBOARD_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('managementDashboardOutcomeTrackingTitle')}</h2>
        <OutcomeTrackingTiles summary={data.outcomeTracking} t={t} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('managementDashboardConversionTitle')}</h2>
        <ConversionTable rows={data.conversionFunnel} t={t} />
      </div>

      <MobilizationTables summary={data.mobilization} t={t} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">{t('managementDashboardMobilizationTrendTitle')}</h2>
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
