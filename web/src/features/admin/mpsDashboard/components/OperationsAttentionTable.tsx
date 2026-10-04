import { Link } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import { Badge, Card, DataTable, EmptyState, type DataTableColumn } from '../../../../design-system';
import type { AttentionCandidate } from '../../../../../../shared/adminMpsDashboard/types';
import { stageLabel, type TFn } from '../../reports/components/ReportTables';
import { MpsRequiresAttentionPanel } from './MpsRequiresAttentionPanel';
import type { DelayedCases } from '../../../../lib/admin-mps-dashboard-client';

export function OperationsAttentionTable({ rows, delayedCases, t }: { rows?: AttentionCandidate[]; delayedCases: DelayedCases; t: TFn }) {
  const { language } = useLanguage();
  const columns: DataTableColumn<AttentionCandidate>[] = [
    { key: 'candidate', header: t('adminCandidateListColumnCandidate'), render: (row) => <div><Link to={`/admin/candidates/${row.candidatePublicId}`} className="font-semibold text-brand hover:underline">{row.candidateFullName}</Link><p className="text-xs text-text-secondary" dir="ltr">{row.referenceNumber}</p></div> },
    { key: 'stage', header: t('adminCandidateListColumnStage'), render: (row) => stageLabel(row.workflowStageCode, t) },
    { key: 'waiting', header: t('operationsDaysWaiting'), render: (row) => formatNumber(row.daysWaiting, language) },
    { key: 'priority', header: t('operationsPriority'), render: (row) => <Badge tone={row.severity === 'critical' ? 'danger' : 'warning'}>{t(row.severity === 'critical' ? 'mpsDashboardCritical' : 'mpsDashboardDelayed')}</Badge> },
    { key: 'action', header: t('operationsAction'), render: (row) => <Link to={`/admin/candidates/${row.candidatePublicId}`} className="whitespace-nowrap text-sm font-semibold text-brand hover:underline">{t('operationsOpenCandidate')}</Link> },
  ];
  return <Card className="min-w-0 border-danger/20 shadow-sm">
    <h2 className="text-base font-semibold text-text-primary"><span aria-hidden="true">🚨 </span>{t('adminDashboardRequiresAttentionTitle')}</h2>
    <p className="mb-4 mt-1 text-xs text-text-secondary">{t('operationsAttentionScope')}</p>
    <div className="mb-4"><MpsRequiresAttentionPanel delayedCases={delayedCases} t={t} /></div>
    {rows === undefined ? <p className="text-sm text-text-secondary">{t('operationsAttentionUnavailable')}</p> : rows.length ? <DataTable rows={rows} columns={columns} getRowId={(row) => row.candidatePublicId} /> : <EmptyState title={t('mpsDashboardRequiresAttentionEmpty')} />}
  </Card>;
}
