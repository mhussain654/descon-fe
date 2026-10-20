import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Card, DataTable, EmptyState, StatTile, type DataTableColumn } from '../../../../design-system';
import type { BulkCallBatchItem } from '../../../../lib/admin-bulk-calls-client';
import {
  bulkCallItemStatusLabel,
  bulkCallItemStatusTone,
  bulkCallOutcomeText,
  bulkCallOutcomeTone,
  bulkCallSkipReasonLabel,
} from '../../../../../../shared/adminBulkCalls/labels';
import { workflowStageLabelKey } from '../../../../../../shared/adminCandidates/workflowStageLabels';
import { formatDate, formatNumber } from '../../../../../../shared/i18n/locale';
import { useBulkCallBatch } from '../hooks/useBulkCallBatch';
import { QueryStateView } from './QueryStateView';

/** One bulk call: how many candidates are waiting, called, skipped or failed, and each candidate's result and call outcome. */
export function BulkCallBatchDetail({ batchId }: { batchId: string }) {
  const { t, language } = useLanguage();
  const query = useBulkCallBatch(batchId);
  const batch = query.data;
  const number = (value: number) => formatNumber(value, language);

  const columns: DataTableColumn<BulkCallBatchItem>[] = [
    { key: 'name', header: t('adminBulkCallColumnName'), render: (item) => <span className="font-medium text-text-primary">{item.candidate.fullName}</span> },
    { key: 'phone', header: t('adminBulkCallColumnPhone'), render: (item) => <span dir="ltr">{item.candidate.mobileNumberMasked}</span> },
    {
      key: 'result',
      header: t('adminBulkCallItemColumnResult'),
      render: (item) => (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={bulkCallItemStatusTone(item.status)}>{bulkCallItemStatusLabel(item.status, t)}</Badge>
          {item.skipReason ? <span className="text-xs text-text-secondary">{bulkCallSkipReasonLabel(item.skipReason, t)}</span> : null}
        </div>
      ),
    },
    {
      key: 'outcome',
      header: t('adminBulkCallItemColumnOutcome'),
      render: (item) => {
        const text = bulkCallOutcomeText(item.call?.outcome, item.call?.outcomeReason, t);
        return text ? <Badge tone={bulkCallOutcomeTone(item.call?.outcome)}>{text}</Badge> : t('notAvailable');
      },
    },
  ];

  const stageKey = batch ? workflowStageLabelKey(batch.workflowStageCode) : undefined;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">
      <Link to="/admin/bulk-calls" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t('adminBulkCallDetailBack')}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{t('adminBulkCallDetailTitle')}</h1>

      <QueryStateView query={query}>
        {batch ? (
          <>
            <p className="mb-5 mt-1 text-sm text-text-secondary">
              {batch.voice.name} · {stageKey ? t(stageKey) : batch.workflowStageCode} · {formatDate(batch.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile value={number(batch.counts.queued)} label={t('adminBulkCallItemQueued')} className="bg-info-subtle/55 text-info-emphasis" />
              <StatTile value={number(batch.counts.placed)} label={t('adminBulkCallItemPlaced')} className="bg-success-subtle/55 text-success-emphasis" />
              <StatTile value={number(batch.counts.skipped)} label={t('adminBulkCallItemSkipped')} className="bg-warning-subtle/55 text-warning-emphasis" />
              <StatTile value={number(batch.counts.failed)} label={t('adminBulkCallItemFailed')} className="bg-danger-subtle/55 text-danger-emphasis" />
            </div>
            <p className="mb-3 text-xs text-text-secondary">{t('adminBulkCallDetailHint')}</p>
            {(batch.items ?? []).length === 0 ? (
              <EmptyState title={t('adminBulkCallEmptyTitle')} description={t('adminBulkCallEmptyOther')} />
            ) : (
              <Card noPadding className="min-w-0 overflow-hidden">
                <DataTable columns={columns} rows={batch.items ?? []} getRowId={(item) => item.id} />
              </Card>
            )}
          </>
        ) : null}
      </QueryStateView>
    </div>
  );
}
