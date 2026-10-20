import { Link } from 'react-router';
import { History } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Card, DataTable, EmptyState, type DataTableColumn } from '../../../../design-system';
import type { BulkCallBatch } from '../../../../lib/admin-bulk-calls-client';
import { workflowStageLabelKey } from '../../../../../../shared/adminCandidates/workflowStageLabels';
import { formatDate, formatNumber } from '../../../../../../shared/i18n/locale';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import { STAFF_ROLE_LABEL_KEYS } from '../../../../../../shared/auth/staffTypes';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useBulkCallBatches } from '../hooks/useBulkCallBatches';
import { QueryStateView } from './QueryStateView';

/** The most recent bulk calls with how far each has got; each links to its per-candidate results. */
export function BulkCallBatchList() {
  const { t, language } = useLanguage();
  const query = useBulkCallBatches();
  const number = (value: number) => formatNumber(value, language);

  const columns: DataTableColumn<BulkCallBatch>[] = [
    { key: 'when', header: t('adminBulkCallBatchColumnWhen'), render: (batch) => formatDate(batch.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' }) },
    {
      key: 'stage',
      header: t('adminBulkCallBatchColumnStage'),
      render: (batch) => {
        const key = workflowStageLabelKey(batch.workflowStageCode);
        return key ? t(key) : batch.workflowStageCode;
      },
    },
    { key: 'type', header: t('adminBulkCallBatchColumnType'), render: (batch) => batch.voice.name },
    {
      key: 'progress',
      header: t('adminBulkCallBatchColumnProgress'),
      render: (batch) =>
        interpolate(t('adminBulkCallBatchProgress'), {
          placed: number(batch.counts.placed),
          queued: number(batch.counts.queued),
          skipped: number(batch.counts.skipped),
          failed: number(batch.counts.failed),
        }),
    },
    {
      key: 'by',
      header: t('adminBulkCallBatchColumnBy'),
      render: (batch) => {
        const key = STAFF_ROLE_LABEL_KEYS[batch.createdBy.role as keyof typeof STAFF_ROLE_LABEL_KEYS] as TranslationKey | undefined;
        return key ? t(key) : batch.createdBy.role;
      },
    },
    {
      key: 'open',
      header: '',
      render: (batch) => (
        <Link to={`/admin/bulk-calls/${encodeURIComponent(batch.id)}`} className="text-sm font-semibold text-brand hover:underline">
          {t('adminBulkCallViewResults')}
        </Link>
      ),
    },
  ];

  return (
    <Card className="mt-5 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
          <History className="h-4 w-4" aria-hidden="true" />
        </div>
        <h2 className="font-semibold text-text-primary">{t('adminBulkCallBatchesTitle')}</h2>
      </div>
      <QueryStateView query={query}>
        {(query.data ?? []).length === 0 ? (
          <EmptyState title={t('adminBulkCallBatchesTitle')} description={t('adminBulkCallBatchesEmpty')} />
        ) : (
          <DataTable columns={columns} rows={query.data ?? []} getRowId={(batch) => batch.id} />
        )}
      </QueryStateView>
    </Card>
  );
}
