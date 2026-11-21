import { useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, Clock3, PlaneTakeoff, SlidersHorizontal, Users } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  ForbiddenState,
  Input,
  LoadingState,
  OfflineState,
  Pagination,
  RetryBanner,
  Select,
  type DataTableColumn,
} from '../../../../design-system';
import { ADMIN_CANDIDATE_ERROR_KEYS } from '../../../../../../shared/adminCandidates/errorMessages';
import { flightDateToday } from '../../../../../../shared/adminCandidates/flightDate';
import type {
  MobilizationBoardingPassFilter,
  MobilizationFilters,
  MobilizationRow,
  MobilizationSort,
  MobilizationStatus,
  MobilizationSummary,
} from '../../../../../../shared/adminCandidates/mobilizations';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { useDebouncedUrlFilter } from '../../documentReviews/hooks/useDebouncedUrlFilter';
import { useMobilizationList } from '../hooks/useMobilizationList';
import { CountryFilterSelect } from '../../shared/CountryFilterSelect';
import { RegisteredDateRangeInputs } from '../../shared/RegisteredDateRangeInputs';
import { readMobilizationStateFromSearchParams, writeMobilizationStateToSearchParams } from '../mobilizationUrlState';

// Departures are shown, and filtered, in Pakistan time.
const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

function localeFor(language: Language): string {
  return language === 'ur' ? 'ur-PK' : 'en-GB';
}

function formatDeparture(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    timeZone: PAKISTAN_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** The Pakistan calendar day (YYYY-MM-DD) of a moment in time. */
function pakistanDay(isoDateTime: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PAKISTAN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoDateTime));
}

function formatDay(isoDateOrTime: string, language: Language): string {
  // A bare YYYY-MM-DD is a calendar day already; anything else is a moment in time.
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(isoDateOrTime);
  return new Intl.DateTimeFormat(localeFor(language), {
    timeZone: isDay ? 'UTC' : PAKISTAN_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isDay ? `${isoDateOrTime}T00:00:00Z` : isoDateOrTime));
}

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  pressed?: boolean;
  onPress?: () => void;
}

function SummaryCard({ label, value, icon, pressed, onPress }: SummaryCardProps) {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold tabular-nums text-text-primary">{value}</span>
        <span className="block text-xs font-medium text-text-secondary">{label}</span>
      </span>
    </>
  );
  const className = `flex items-center gap-3 rounded-2xl border p-4 text-start ${pressed ? 'border-brand bg-brand-subtle' : 'border-border bg-surface'}`;
  if (!onPress) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={`${className} transition hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand`}
    >
      {content}
    </button>
  );
}

/**
 * The admin Mobilization page (client request, Nov 2026): every candidate
 * whose flight is booked, through to mobilization, with each one's flight,
 * ticket, boarding pass and status. Filters (flight date, boarding pass,
 * status, search), sort and page all live in the URL.
 */
export function MobilizationWorkspace() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, sort, page } = readMobilizationStateFromSearchParams(searchParams);
  const query = useMobilizationList(filters, sort, page);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') signOut('expired');
    else if (query.error?.code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, signOut]);

  const updateFilters = useCallback(
    (patch: Partial<MobilizationFilters>, nextSort: MobilizationSort | undefined = sort) => {
      setSearchParams(writeMobilizationStateToSearchParams({ ...filters, ...patch }, nextSort, { ...page, number: 1 }));
    },
    [filters, sort, page, setSearchParams]
  );

  const [searchDraft, setSearchDraft] = useDebouncedUrlFilter(filters.search ?? '', (value) => updateFilters({ search: value || undefined }));
  const clearFilters = () => {
    setSearchDraft('');
    setSearchParams(new URLSearchParams());
  };
  const hasActiveFilters = Boolean(
    filters.search || filters.flightDate || filters.boardingPass || filters.status || filters.countryCode || filters.registeredFrom || filters.registeredTo || sort
  );
  const summary = query.data?.summary;
  const toggleBoardingPass = (state: MobilizationBoardingPassFilter) =>
    updateFilters({ boardingPass: filters.boardingPass === state ? undefined : state });

  const columns: DataTableColumn<MobilizationRow>[] = [
    {
      key: 'candidate',
      header: t('adminCandidateListColumnCandidate'),
      render: (row) => (
        <div className="min-w-[180px]">
          <Link to={`/admin/candidates/${row.candidate.id}`} className="block truncate font-semibold text-brand hover:underline">
            {row.candidate.fullName}
          </Link>
          <div className="mt-0.5 text-xs text-text-tertiary" dir="ltr">
            {row.candidate.referenceNumber}
          </div>
          {row.candidate.countryName ? (
            <div className="mt-0.5 text-xs text-text-tertiary">
              {[row.candidate.countryName, row.candidate.craftName].filter(Boolean).join(' · ')}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'flight',
      header: t('adminMobilizationColumnFlight'),
      render: (row) => (
        <div className="min-w-[140px]">
          <div className="font-medium text-text-primary">{row.airline}</div>
          <div className="mt-0.5 text-xs text-text-tertiary" dir="ltr">
            {[row.flightNumber, row.sector].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
    },
    {
      key: 'departure',
      header: t('adminMobilizationColumnDeparture'),
      render: (row) => <span className="whitespace-nowrap tabular-nums">{formatDeparture(row.flightDepartureAt, language)}</span>,
    },
    {
      key: 'ticket',
      header: t('adminMobilizationColumnTicket'),
      render: (row) => (
        <Badge tone={row.ticketAttached ? 'success' : 'neutral'}>
          {t(row.ticketAttached ? 'adminMobilizationTicketAttached' : 'adminMobilizationTicketMissing')}
        </Badge>
      ),
    },
    {
      key: 'boardingPass',
      header: t('adminMobilizationColumnBoardingPass'),
      render: (row) =>
        row.boardingPassUploadedAt ? (
          <Badge tone="success">
            {interpolate(t('adminMobilizationBoardingPassUploadedOn'), { date: formatDay(row.boardingPassUploadedAt, language) })}
          </Badge>
        ) : (
          <Badge tone="warning">{t('adminMobilizationBoardingPassMissing')}</Badge>
        ),
    },
    {
      key: 'status',
      header: t('adminMobilizationColumnStatus'),
      // Like an airport board: Awaiting departure or Departed. The Departure column
      // already has the date, so it is only repeated when the candidate left on a
      // different day (a delayed or rebooked flight).
      render: (row) =>
        row.status === 'mobilized' && row.mobilizedOn ? (
          <div className="flex flex-col items-start gap-1">
            <Badge tone="success">{t('adminMobilizationStatusDeparted')}</Badge>
            {row.mobilizedOn !== pakistanDay(row.flightDepartureAt) ? (
              <span className="text-xs text-text-tertiary">
                {interpolate(t('adminMobilizationStatusDepartedOn'), { date: formatDay(row.mobilizedOn, language) })}
              </span>
            ) : null}
          </div>
        ) : (
          <Badge tone="info">{t('adminMobilizationStatusAwaiting')}</Badge>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6" dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div className="relative px-6 py-5 lg:px-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminMobilizationEyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminMobilizationTitle')}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/80">{t('adminMobilizationSubtitle')}</p>
        </div>
      </div>

      {summary ? (
        <SummaryCards summary={summary} boardingPass={filters.boardingPass} status={filters.status} onBoardingPass={toggleBoardingPass}
          onMobilized={() => updateFilters({ status: filters.status === 'mobilized' ? undefined : 'mobilized' })} t={t} />
      ) : null}

      <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="font-semibold text-text-primary">{t('adminCandidateListFilterTitle')}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label={t('adminCandidateListSearchLabel')}
            placeholder={t('adminMobilizationSearchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <Input
            type="date"
            label={t('adminMobilizationFilterFlightDate')}
            value={filters.flightDate ?? ''}
            onChange={(event) => updateFilters({ flightDate: event.target.value || undefined })}
          />
          {/* Country and registered dates pick out one import batch. */}
          <CountryFilterSelect value={filters.countryCode} onChange={(countryCode) => updateFilters({ countryCode })} t={t} />
          <RegisteredDateRangeInputs value={filters} onChange={updateFilters} t={t} />
          <Select
            label={t('adminCandidateListFilterBoardingPassLabel')}
            value={filters.boardingPass ?? ''}
            onChange={(event) => updateFilters({ boardingPass: (event.target.value || undefined) as MobilizationBoardingPassFilter | undefined })}
            options={[
              { value: '', label: t('adminCandidateListFilterBoardingPassAll') },
              { value: 'uploaded', label: interpolate(t('adminCandidateListFilterBoardingPassUploaded'), { count: summary?.boardingPass.uploaded ?? 0 }) },
              { value: 'missing', label: interpolate(t('adminCandidateListFilterBoardingPassMissing'), { count: summary?.boardingPass.missing ?? 0 }) },
            ]}
          />
          <Select
            label={t('adminMobilizationFilterStatusLabel')}
            value={filters.status ?? ''}
            onChange={(event) => updateFilters({ status: (event.target.value || undefined) as MobilizationStatus | undefined })}
            options={[
              { value: '', label: t('adminMobilizationFilterStatusAll') },
              { value: 'awaiting_departure', label: interpolate(t('adminMobilizationFilterStatusAwaiting'), { count: summary?.status.awaitingDeparture ?? 0 }) },
              { value: 'mobilized', label: interpolate(t('adminMobilizationFilterStatusMobilized'), { count: summary?.status.mobilized ?? 0 }) },
            ]}
          />
          <Select
            label={t('adminCandidateListSortLabel')}
            value={sort ?? ''}
            onChange={(event) => updateFilters({}, (event.target.value || undefined) as MobilizationSort | undefined)}
            options={[
              { value: '', label: t('adminMobilizationSortLatest') },
              { value: 'departure_at', label: t('adminMobilizationSortEarliest') },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={() => updateFilters({ flightDate: flightDateToday() }, 'departure_at')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <PlaneTakeoff className="h-4 w-4" aria-hidden="true" />
            {t('adminMobilizationFilterToday')}
          </button>
          {hasActiveFilters ? (
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand hover:underline">
              {t('adminCandidateListClearFilters')}
            </button>
          ) : null}
        </div>
      </Card>

      <ListContent
        query={query}
        columns={columns}
        page={page}
        onPageChange={(number) => setSearchParams(writeMobilizationStateToSearchParams(filters, sort, { ...page, number }))}
        hasActiveFilters={hasActiveFilters}
        t={t}
      />
    </div>
  );
}

interface SummaryCardsProps {
  summary: MobilizationSummary;
  boardingPass?: MobilizationBoardingPassFilter;
  status?: MobilizationStatus;
  onBoardingPass: (state: MobilizationBoardingPassFilter) => void;
  onMobilized: () => void;
  t: (key: TranslationKey) => string;
}

/** Totals for the current filters; the boarding pass and mobilized cards double as quick filters. */
function SummaryCards({ summary, boardingPass, status, onBoardingPass, onMobilized, t }: SummaryCardsProps) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label={t('adminMobilizationSummaryTotal')} value={summary.total} icon={<Users className="h-4 w-4" aria-hidden="true" />} />
      <SummaryCard
        label={t('adminMobilizationSummaryUploaded')}
        value={summary.boardingPass.uploaded}
        icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        pressed={boardingPass === 'uploaded'}
        onPress={() => onBoardingPass('uploaded')}
      />
      <SummaryCard
        label={t('adminMobilizationSummaryMissing')}
        value={summary.boardingPass.missing}
        icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
        pressed={boardingPass === 'missing'}
        onPress={() => onBoardingPass('missing')}
      />
      <SummaryCard
        label={t('adminMobilizationSummaryMobilized')}
        value={summary.status.mobilized}
        icon={<PlaneTakeoff className="h-4 w-4" aria-hidden="true" />}
        pressed={status === 'mobilized'}
        onPress={onMobilized}
      />
    </div>
  );
}

interface ListContentProps {
  query: ReturnType<typeof useMobilizationList>;
  columns: DataTableColumn<MobilizationRow>[];
  page: { number?: number; size?: number };
  onPageChange: (page: number) => void;
  hasActiveFilters: boolean;
  t: (key: TranslationKey) => string;
}

function ListContent({ query, columns, page, onPageChange, hasActiveFilters, t }: ListContentProps) {
  if (query.isLoading) return <LoadingState message={t('loading')} />;

  if (query.isError && !query.data) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
    }
    if (error?.code === 'FORBIDDEN') return <ForbiddenState title={t('dsForbiddenTitle')} description={t('staffAuthForbiddenError')} />;
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') return null;
    const messageKey = (error ? ADMIN_CANDIDATE_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const items = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  if (items.length === 0) {
    return hasActiveFilters ? (
      <EmptyState title={t('adminCandidateListEmptyFilteredTitle')} description={t('adminCandidateListEmptyFilteredDescription')} />
    ) : (
      <EmptyState title={t('adminMobilizationEmptyTitle')} description={t('adminMobilizationEmptyDescription')} />
    );
  }

  return (
    <div>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('adminCandidateListLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}
      <div className="mb-3 flex items-center gap-2 px-1 text-sm text-text-secondary">
        <Users className="h-4 w-4 text-brand" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-text-primary">{pagination?.totalCount ?? items.length}</strong> {t('adminCandidateListResultsLabel')}
        </span>
      </div>
      <Card noPadding className="min-w-0 overflow-hidden [&_tbody_tr:nth-child(even)]:bg-surface-sunken/45 [&_tbody_tr:hover]:bg-brand-subtle/40">
        <DataTable columns={columns} rows={items} getRowId={(row) => row.id} />
      </Card>
      {pagination ? (
        <div className="mt-4">
          <Pagination
            page={pagination.page || page.number || 1}
            pageCount={pagination.totalPages}
            onPageChange={onPageChange}
            previousLabel={t('dsPreviousPage')}
            nextLabel={t('dsNextPage')}
          />
        </div>
      ) : null}
    </div>
  );
}
