import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { ErrorState, ForbiddenState, LoadingState, OfflineState } from '../../../../design-system';
import type { ReferenceDataError } from '../../../../lib/admin-reference-data-client';

/** Loading, offline, forbidden and error states for a reference data query; renders children once loaded. */
export function ReferenceDataQueryState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T, ReferenceDataError>;
  children: (data: T) => ReactNode;
}) {
  const { t } = useLanguage();
  if (query.isPending) return <LoadingState message={t('loading')} />;
  if (query.isError) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
    }
    if (error?.code === 'FORBIDDEN') return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    return <ErrorState message={error?.message || t('adminRefDataLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}

/** The message to show for a failed change: the server's localized one, else a generic one. */
export function referenceDataErrorMessage(error: ReferenceDataError | null | undefined, fallback: string): string | undefined {
  if (!error) return undefined;
  return error.message || fallback;
}
