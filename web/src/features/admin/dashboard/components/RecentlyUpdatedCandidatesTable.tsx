import { Link } from 'react-router';
import { Badge, DataTable, EmptyState, type DataTableColumn } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import { WORKFLOW_STAGE_NEXT_ACTION_KEYS, type CanonicalWorkflowStageCode } from '../../../../../../shared/adminWorkflow/canonicalStages';
import type { RecentlyUpdatedCandidateRow } from '../../../../../../shared/adminDashboard/types';
import { stageLabel, type TFn } from '../../reports/components/ReportTables';
import { PIPELINE_BUCKET_BADGE_TONE, STAGE_TO_PIPELINE_BUCKET } from '../workflowPipelineBuckets';

function stageBadgeTone(code: string) {
  const bucket = STAGE_TO_PIPELINE_BUCKET[code as CanonicalWorkflowStageCode];
  return bucket ? PIPELINE_BUCKET_BADGE_TONE[bucket] : 'neutral';
}

/** Not a recommendation engine -- a fixed, one-per-stage lookup (WORKFLOW_STAGE_NEXT_ACTION_KEYS), falling back to the raw code for a future stage this build doesn't recognize yet, same convention as stageLabel. */
function nextActionLabel(code: string, t: TFn): string {
  const key = WORKFLOW_STAGE_NEXT_ACTION_KEYS[code as CanonicalWorkflowStageCode];
  return key ? t(key) : code;
}

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
    {
      key: 'stage',
      header: t('adminDashboardColumnStage'),
      render: (row) => (
        <Badge tone={stageBadgeTone(row.workflowStageCode)} icon={null}>
          {stageLabel(row.workflowStageCode, t)}
        </Badge>
      ),
    },
    { key: 'updated', header: t('adminDashboardColumnLastUpdated'), render: (row) => formatDate(row.lastUpdatedAt, language) },
    { key: 'nextAction', header: t('adminDashboardColumnNextAction'), render: (row) => nextActionLabel(row.workflowStageCode, t) },
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
