import { useEffect, type ReactNode } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { ErrorState, ForbiddenState, LoadingState, OfflineState, RetryBanner } from '../../../../design-system';
import type { AdminBulkCallError } from '../../../../lib/admin-bulk-calls-client';
import { BULK_CALL_ERROR_KEYS } from '../../../../../../shared/adminBulkCalls/errorMessages';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

interface QueryLike {
  isLoading: boolean;
  isError: boolean;
  error: AdminBulkCallError | null;
  data: unknown;
  refetch: () => unknown;
}

/**
 * The loading / error / offline / forbidden states every bulk-call query shares
 * (AGENTS.md: every remote-data view defines them), then `children` once there
 * is data. A background refresh that fails while data is on screen keeps the
 * data and adds a retry banner. An expired or deactivated session signs out and
 * hands off to RequireStaffAuth's own redirect.
 */
export function QueryStateView({ query, children }: { query: QueryLike; children: ReactNode }) {
  const { t } = useLanguage();
  const { signOut } = useStaffAuth();
  const code = query.error?.code;

  useEffect(() => {
    if (code === 'SESSION_EXPIRED') signOut('expired');
    else if (code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [code, signOut]);

  if (query.isLoading) return <LoadingState message={t('loading')} />;

  if (query.isError && !query.data) {
    if (code === 'OFFLINE') {
      return <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
    }
    if (code === 'FORBIDDEN') return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    if (code === 'SESSION_EXPIRED' || code === 'INACTIVE_ACCOUNT') return null;
    const key = (code ? BULK_CALL_ERROR_KEYS[code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={query.error?.message || t(key)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  return (
    <>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}
      {children}
    </>
  );
}
