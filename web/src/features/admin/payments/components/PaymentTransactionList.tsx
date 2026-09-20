import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, CircleDollarSign, CreditCard, SlidersHorizontal, WalletCards } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
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
import { formatCurrency, formatDate } from '../../../../../../shared/i18n/locale';
import { ADMIN_PAYMENT_ERROR_KEYS } from '../../../../../../shared/adminPayments/errorMessages';
import {
  ADMIN_PAYMENT_STATUS_KEYS,
  ADMIN_PAYMENT_STATUS_TONES,
  RECONCILIATION_STATE_KEYS,
  RECONCILIATION_STATE_TONES,
} from '../../../../../../shared/adminPayments/paymentLabels';
import type { AdminPaymentStatus, PaymentListFilters, PaymentListSort, PaymentSummary } from '../../../../lib/admin-payments-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useDebouncedUrlFilter } from '../../documentReviews/hooks/useDebouncedUrlFilter';
import { usePaymentList } from '../hooks/usePaymentList';
import { DEFAULT_PAGE_SIZE, readPaymentListStateFromSearchParams, writePaymentListStateToSearchParams } from '../paymentListUrlState';

const STATUSES: AdminPaymentStatus[] = ['checkout_pending', 'paid', 'failed', 'cancelled'];

const SORT_OPTIONS: { value: PaymentListSort; labelKey: TranslationKey }[] = [
  { value: '-created_at', labelKey: 'adminFinancePaymentSortCreatedDesc' },
  { value: 'created_at', labelKey: 'adminFinancePaymentSortCreatedAsc' },
  { value: '-amount', labelKey: 'adminFinancePaymentSortAmountDesc' },
  { value: 'amount', labelKey: 'adminFinancePaymentSortAmountAsc' },
  { value: '-paid_at', labelKey: 'adminFinancePaymentSortPaidDesc' },
  { value: 'paid_at', labelKey: 'adminFinancePaymentSortPaidAsc' },
  { value: 'status_code', labelKey: 'adminFinancePaymentSortStatusAsc' },
  { value: '-status_code', labelKey: 'adminFinancePaymentSortStatusDesc' },
];

/** The finance workspace's transaction list: search, filters, sort and pagination, all backed by the URL -- mirrors CandidateListWorkspace.tsx's identical structure. No RequireStaffAuth permission prop on this route (view_payments OR manage_payments) -- gating happens here via the query's own FORBIDDEN state, same as AdminCandidateListPage. */
export function PaymentTransactionList() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const { filters, sort, page } = readPaymentListStateFromSearchParams(searchParams);

  const query = usePaymentList(filters, sort, page);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  const updateFilters = useCallback(
    (patch: Partial<PaymentListFilters>, nextSort: PaymentListSort | undefined = sort) => {
      const nextFilters = { ...filters, ...patch };
      setSearchParams(writePaymentListStateToSearchParams(nextFilters, nextSort, { ...page, number: 1 }));
    },
    [filters, sort, page, setSearchParams]
  );

  const [searchDraft, setSearchDraft] = useDebouncedUrlFilter(filters.search ?? '', (value) => updateFilters({ search: value || undefined }));

  const clearFilters = () => {
    setSearchDraft('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.providerCode ||
      filters.paymentTypeCode ||
      filters.currencyCode ||
      filters.createdFrom ||
      filters.createdTo ||
      filters.reconciliationState ||
      sort
  );

  const columns: DataTableColumn<PaymentSummary>[] = [
    {
      key: 'candidate',
      header: t('adminFinancePaymentColumnCandidate'),
      render: (row) => (
        <div className="flex min-w-[220px] items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-sm font-semibold text-brand">
            {row.candidate.fullName.trim().charAt(0).toUpperCase() || 'C'}
          </div>
          <div className="min-w-0">
            <Link to={`/admin/finance/payments/${row.id}`} className="block truncate font-semibold text-brand hover:underline">
              {row.candidate.fullName}
            </Link>
            <div className="mt-0.5 text-xs text-text-tertiary">{row.candidate.referenceNumber}</div>
          </div>
        </div>
      ),
    },
    { key: 'amount', header: t('adminFinancePaymentColumnAmount'), render: (row) => formatCurrency(Number(row.amount), language, row.currencyCode) },
    {
      key: 'status',
      header: t('adminFinancePaymentColumnStatus'),
      render: (row) => <Badge tone={ADMIN_PAYMENT_STATUS_TONES[row.status]}>{t(ADMIN_PAYMENT_STATUS_KEYS[row.status])}</Badge>,
    },
    {
      key: 'provider',
      header: t('adminFinancePaymentColumnProvider'),
      render: (row) => <span className="capitalize text-text-secondary">{row.provider.replaceAll('_', ' ')}</span>,
    },
    {
      key: 'reconciliation',
      header: t('adminFinancePaymentColumnReconciliation'),
      render: (row) => (
        <Badge tone={RECONCILIATION_STATE_TONES[row.reconciliationState]}>{t(RECONCILIATION_STATE_KEYS[row.reconciliationState])}</Badge>
      ),
    },
    {
      key: 'submitted',
      header: t('adminFinancePaymentColumnSubmitted'),
      render: (row) => formatDate(row.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4 px-6 py-7 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="max-w-2xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminFinancePaymentEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminFinancePaymentTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('adminFinancePaymentSubtitle')}</p>
          </div>
        </div>
      </div>

      <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">{t('adminFinancePaymentFilterTitle')}</h2>
            <p className="text-xs text-text-secondary">{t('adminFinancePaymentFilterSubtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label={t('adminFinancePaymentSearchLabel')}
            placeholder={t('adminFinancePaymentSearchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <Select
            label={t('adminFinancePaymentFilterStatusLabel')}
            value={filters.status ?? ''}
            onChange={(event) => updateFilters({ status: (event.target.value || undefined) as AdminPaymentStatus | undefined })}
            options={[
              { value: '', label: t('adminFinancePaymentFilterAllStatuses') },
              ...STATUSES.map((status) => ({ value: status, label: t(ADMIN_PAYMENT_STATUS_KEYS[status]) })),
            ]}
          />
          <Select
            label={t('adminFinancePaymentFilterReconciliationLabel')}
            value={filters.reconciliationState ?? ''}
            onChange={(event) =>
              updateFilters({ reconciliationState: (event.target.value || undefined) as PaymentListFilters['reconciliationState'] })
            }
            options={[
              { value: '', label: t('adminFinancePaymentFilterAllReconciliationStates') },
              { value: 'open', label: t(RECONCILIATION_STATE_KEYS.open) },
              { value: 'resolved', label: t(RECONCILIATION_STATE_KEYS.resolved) },
              { value: 'clean', label: t(RECONCILIATION_STATE_KEYS.clean) },
            ]}
          />
          <Select
            label={t('adminFinancePaymentSortLabel')}
            value={sort ?? ''}
            onChange={(event) => updateFilters({}, (event.target.value || undefined) as PaymentListSort | undefined)}
            options={[
              { value: '', label: t('adminFinancePaymentSortCreatedDesc') },
              ...SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAdvancedFilters((value) => !value)}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
          aria-expanded={showAdvancedFilters}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t('adminFinancePaymentAdvancedFilters')}
          <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {showAdvancedFilters ? <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label={t('adminFinancePaymentFilterProviderLabel')}
            value={filters.providerCode ?? ''}
            onChange={(event) => updateFilters({ providerCode: event.target.value || undefined })}
          />
          <Input
            label={t('adminFinancePaymentFilterPaymentTypeLabel')}
            value={filters.paymentTypeCode ?? ''}
            onChange={(event) => updateFilters({ paymentTypeCode: event.target.value || undefined })}
          />
          <Input
            label={t('adminFinancePaymentFilterCurrencyLabel')}
            value={filters.currencyCode ?? ''}
            onChange={(event) => updateFilters({ currencyCode: event.target.value || undefined })}
          />
          <Input
            type="date"
            label={t('adminFinancePaymentFilterCreatedFromLabel')}
            value={filters.createdFrom ?? ''}
            onChange={(event) => updateFilters({ createdFrom: event.target.value || undefined })}
          />
          <Input
            type="date"
            label={t('adminFinancePaymentFilterCreatedToLabel')}
            value={filters.createdTo ?? ''}
            onChange={(event) => updateFilters({ createdTo: event.target.value || undefined })}
          />
        </div> : null}
        {hasActiveFilters ? (
          <div className="mt-4">
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand hover:underline">
              {t('adminFinancePaymentClearFilters')}
            </button>
          </div>
        ) : null}
      </Card>

      <ListContent
        query={query}
        columns={columns}
        page={page}
        onPageChange={(number) => setSearchParams(writePaymentListStateToSearchParams(filters, sort, { ...page, number }))}
        hasActiveFilters={hasActiveFilters}
        t={t}
        language={language}
      />
    </div>
  );
}

interface ListContentProps {
  query: ReturnType<typeof usePaymentList>;
  columns: DataTableColumn<PaymentSummary>[];
  page: { number?: number; size?: number };
  onPageChange: (page: number) => void;
  hasActiveFilters: boolean;
  t: (key: TranslationKey) => string;
  language: Parameters<typeof formatCurrency>[1];
}

function ListContent({ query, columns, page, onPageChange, hasActiveFilters, t, language }: ListContentProps) {
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
    const messageKey = (error ? ADMIN_PAYMENT_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const result = query.data;
  const items = result?.items ?? [];
  const pagination = result?.pagination;

  if (items.length === 0) {
    return hasActiveFilters ? (
      <EmptyState title={t('adminFinancePaymentEmptyFilteredTitle')} description={t('adminFinancePaymentEmptyFilteredDescription')} />
    ) : (
      <EmptyState title={t('adminFinancePaymentEmptyTitle')} description={t('adminFinancePaymentEmptyDescription')} />
    );
  }

  return (
    <div>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('adminFinancePaymentLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border border-t-4 border-t-brand bg-brand-subtle/55 px-4 py-4 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised/75 text-brand"><WalletCards className="h-4 w-4" aria-hidden="true" /></div>
          <div className="text-2xl font-bold text-brand">{pagination?.totalCount ?? items.length}</div>
          <div className="text-xs font-semibold text-text-secondary">{t('adminFinancePaymentTransactionsLabel')}</div>
        </div>
        <div className="rounded-xl border border-border border-t-4 border-t-success bg-success-subtle/65 px-4 py-4 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised/75 text-success-emphasis"><CircleDollarSign className="h-4 w-4" aria-hidden="true" /></div>
          <div className="text-2xl font-bold text-success-emphasis">
            {formatCurrency(items.filter((item) => item.status === 'paid').reduce((total, item) => total + Number(item.amount), 0), language, items[0]?.currencyCode ?? 'PKR')}
          </div>
          <div className="text-xs font-semibold text-text-secondary">{t('adminFinancePaymentVisiblePaidLabel')}</div>
        </div>
        <div className="rounded-xl border border-border border-t-4 border-t-danger bg-danger-subtle/65 px-4 py-4 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised/75 text-danger-emphasis"><AlertTriangle className="h-4 w-4" aria-hidden="true" /></div>
          <div className="text-2xl font-bold text-danger-emphasis">
            {items.filter((item) => item.status === 'failed' || item.reconciliationState === 'open').length}
          </div>
          <div className="text-xs font-semibold text-text-secondary">{t('adminFinancePaymentVisibleAttentionLabel')}</div>
        </div>
      </div>
      <Card noPadding className="min-w-0 overflow-hidden [&_tbody_tr:nth-child(even)]:bg-surface-sunken/45 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-brand-subtle/40">
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
