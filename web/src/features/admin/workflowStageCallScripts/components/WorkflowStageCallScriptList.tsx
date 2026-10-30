import { useEffect } from 'react';
import { Mic, Radio, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Card, EmptyState, ErrorState, ForbiddenState, LoadingState, OfflineState } from '../../../../design-system';
import { sortByWorkflowStageOrder } from '../../../../../../shared/adminCandidates/workflowStageLabels';
import { useWorkflowStageCallScriptList } from '../hooks/useWorkflowStageCallScriptList';
import { WorkflowStageCallScriptRow } from './WorkflowStageCallScriptRow';

/** The workflow-stage automatic call list (MPS-708/MPS-F706), shown as Settings' Automatic call settings tab: a fixed, small set of canonical-stage rows, each editable in place. Gating happens here via the query's own FORBIDDEN state, same as AuditEventList/CommunicationList. */
export function WorkflowStageCallScriptList() {
  const { signOut } = useStaffAuth();
  const query = useWorkflowStageCallScriptList();

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  return <Content query={query} />;
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

  const scripts = sortActiveFirst(sortByWorkflowStageOrder(query.data ?? [], (script) => script.workflowStageCode));

  if (scripts.length === 0) {
    return <EmptyState title={t('adminWorkflowStageCallScriptEmptyTitle')} description={t('adminWorkflowStageCallScriptEmptyDescription')} />;
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard icon={Radio} label={t('adminWorkflowStageCallScriptMetricTotal')} value={scripts.length} className="border-t-brand bg-brand-subtle/45 text-brand" />
        <SummaryCard icon={ShieldCheck} label={t('adminWorkflowStageCallScriptMetricActive')} value={scripts.filter((script) => script.active).length} className="border-t-success bg-success-subtle/55 text-success-emphasis" />
        <SummaryCard icon={Mic} label={t('adminWorkflowStageCallScriptMetricWithVoice')} value={scripts.filter((script) => Boolean(script.voiceId)).length} className="border-t-info bg-info-subtle/55 text-info-emphasis" />
      </div>
      <div className="mb-3">
        <h2 className="font-semibold text-text-primary">{t('adminWorkflowStageCallScriptLibraryTitle')}</h2>
        <p className="text-xs text-text-secondary">{t('adminWorkflowStageCallScriptLibraryDescription')}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {scripts.map((script) => <WorkflowStageCallScriptRow key={script.workflowStageCode} script={script} />)}
      </div>
    </>
  );
}

/** Stages that are calling now come first, then stages with a voice set but switched off, then stages with no voice yet. Array#sort is stable, so each group keeps the workflow-stage order it came in with. */
function sortActiveFirst<T extends { active: boolean; voiceId?: string | null }>(scripts: T[]): T[] {
  const rank = (script: T) => (script.active ? 0 : script.voiceId ? 1 : 2);
  return [...scripts].sort((a, b) => rank(a) - rank(b));
}

function SummaryCard({ icon: Icon, label, value, className }: { icon: typeof Radio; label: string; value: number; className: string }) {
  return (
    <div className={`rounded-xl border border-border border-t-4 p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</span>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="text-2xl font-semibold tracking-tight text-text-primary">{value}</div>
    </div>
  );
}
