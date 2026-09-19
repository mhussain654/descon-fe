import { Link } from 'react-router';
import { DataTable, EmptyState, type DataTableColumn } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { RecentlyUpdatedCandidateRow } from '../../../../../../shared/adminDashboard/types';
import { stageLabel, type TFn } from '../../reports/components/ReportTables';

/** Candidate assignments ordered by their most recent workflow-stage transition, most recent first. */
export function RecentlyUpdatedCandidatesTable({
  rows,
  t,
  language,
}: {
  rows: RecentlyUpdatedCandidateRow[];
  t: TFn;
  language: Language;
}) {
  const columns: DataTableColumn<RecentlyUpdatedCandidateRow>[] = [
    {
      key: 'candidate',
      header: t('adminDashboardColumnCandidate'),
      render: (row) => (
        <Link to={`/admin/candidates/${row.candidatePublicId}`} className="font-medium text-brand hover:underline">
          {row.candidateFullName}
        </Link>
      ),
    },
    { key: 'reference', header: t('adminDashboardColumnReference'), render: (row) => row.referenceNumber },
    { key: 'stage', header: t('adminDashboardColumnStage'), render: (row) => stageLabel(row.workflowStageCode, t) },
    { key: 'updated', header: t('adminDashboardColumnLastUpdated'), render: (row) => formatDate(row.lastUpdatedAt, language) },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.candidateAssignmentPublicId}
      emptyState={<EmptyState title={t('adminDashboardRecentlyUpdatedEmpty')} />}
    />
  );
}
