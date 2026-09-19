import { Link } from 'react-router';
import { ProgressBar } from '../../../../design-system';
import type { StatusSummaryRow } from '../../../../lib/admin-reports-client';
import { PIPELINE_BUCKET_HEX, PIPELINE_BUCKET_LABEL_KEYS, PIPELINE_BUCKET_ORDER, groupStagesByPipelineBucket } from '../workflowPipelineBuckets';
import type { TFn } from '../../reports/components/ReportTables';

/**
 * The 15-stage workflow queue rolled up into 5 pipeline phases (frontend-
 * only taxonomy, see workflowPipelineBuckets.ts) and rendered as horizontal
 * progress bars -- clearer than a donut/legend for exactly 5 ranked
 * buckets. The full 15-stage breakdown (CategoryBarChart) stays reachable
 * via "View all stages", not deleted.
 */
export function WorkflowPipelineOverview({ workflowStageQueue, t }: { workflowStageQueue: StatusSummaryRow[]; t: TFn }) {
  const totals = groupStagesByPipelineBucket(workflowStageQueue);
  const grandTotal = workflowStageQueue.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="flex flex-col gap-4">
      {PIPELINE_BUCKET_ORDER.map((bucket) => {
        const count = totals[bucket];
        const percentage = grandTotal > 0 ? (count / grandTotal) * 100 : 0;
        const label = t(PIPELINE_BUCKET_LABEL_KEYS[bucket]);
        return (
          <div key={bucket}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-text-primary">{label}</span>
              <span className="text-text-secondary">{count}</span>
            </div>
            <ProgressBar value={percentage} label={label} fillColor={PIPELINE_BUCKET_HEX[bucket]} />
          </div>
        );
      })}
      <Link to="/admin/reports" className="self-start text-sm font-medium text-brand hover:underline">
        {t('adminDashboardPipelineViewAllStages')}
      </Link>
    </div>
  );
}
