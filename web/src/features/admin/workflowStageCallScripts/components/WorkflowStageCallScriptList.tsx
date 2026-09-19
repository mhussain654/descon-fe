import { useEffect } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Card, EmptyState, ErrorState, ForbiddenState, LoadingState, OfflineState } from '../../../../design-system';
import { useWorkflowStageCallScriptList } from '../hooks/useWorkflowStageCallScriptList';
import { WorkflowStageCallScriptRow } from './WorkflowStageCallScriptRow';

/** The workflow-stage AI call script list (MPS-708/MPS-F706): a fixed, small set of canonical-stage rows, each editable in place. No RequireStaffAuth permission prop on this route -- gating happens here via the query's own FORBIDDEN state, same as AuditEventList/CommunicationList. */
export function WorkflowStageCallScriptList() {
  const { t } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useWorkflowStageCallScriptList();

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminWorkflowStageCallScriptTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('adminWorkflowStageCallScriptSubtitle')}</p>
      </div>

      <Content query={query} />
    </div>
  );
}

function Content({ query }: { query: ReturnType<typeof useWorkflowStageCallScriptList> }) {
  const { t } = useLanguage();

  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (query.isError) {
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
    return <ErrorState message={error?.message || t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const scripts = query.data ?? [];

  if (scripts.length === 0) {
    return <EmptyState title={t('adminWorkflowStageCallScriptEmptyTitle')} description={t('adminWorkflowStageCallScriptEmptyDescription')} />;
  }

  return (
    <Card>
      {scripts.map((script) => (
        <WorkflowStageCallScriptRow key={script.workflowStageCode} script={script} />
      ))}
    </Card>
  );
}
