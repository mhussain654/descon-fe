import { useEffect } from 'react';
import { Bot, Languages, Radio, ShieldCheck } from 'lucide-react';
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
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4 px-6 py-7 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="max-w-3xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminWorkflowStageCallScriptEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminWorkflowStageCallScriptTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('adminWorkflowStageCallScriptSubtitle')}</p>
          </div>
        </div>
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
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard icon={Radio} label={t('adminWorkflowStageCallScriptMetricTotal')} value={scripts.length} className="border-t-brand bg-brand-subtle/45 text-brand" />
        <SummaryCard icon={ShieldCheck} label={t('adminWorkflowStageCallScriptMetricActive')} value={scripts.filter((script) => script.active).length} className="border-t-success bg-success-subtle/55 text-success-emphasis" />
        <SummaryCard icon={Languages} label={t('adminWorkflowStageCallScriptMetricBilingual')} value={scripts.filter((script) => Boolean(script.announcementUr)).length} className="border-t-info bg-info-subtle/55 text-info-emphasis" />
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
