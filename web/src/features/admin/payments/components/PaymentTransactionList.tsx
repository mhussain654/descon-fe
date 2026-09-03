import { useCallback, useEffect } from 'react';
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
        <Link to={`/admin/finance/payments/${row.id}`} className="font-medium text-brand hover:underline">
          <div>{row.candidate.fullName}</div>
          <div className="text-xs font-normal text-text-tertiary">{row.candidate.referenceNumber}</div>
        </Link>
      ),
    },
    { key: 'amount', header: t('adminFinancePaymentColumnAmount'), render: (row) => formatCurrency(Number(row.amount), language, row.currencyCode) },
    {
      key: 'status',
      header: t('adminFinancePaymentColumnStatus'),
      render: (row) => <Badge tone={ADMIN_PAYMENT_STATUS_TONES[row.status]}>{t(ADMIN_PAYMENT_STATUS_KEYS[row.status])}</Badge>,
    },
    { key: 'provider', header: t('adminFinancePaymentColumnProvider'), render: (row) => row.provider },
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
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminFinancePaymentTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('adminFinancePaymentSubtitle')}</p>
      </div>

      <Card className="mb-4">
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
        </div>
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
}

function ListContent({ query, columns, page, onPageChange, hasActiveFilters, t }: ListContentProps) {
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
      <Card noPadding>
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
