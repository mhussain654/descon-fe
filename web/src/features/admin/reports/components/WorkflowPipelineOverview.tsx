import { BadgeCheck, ChevronDown, FileText, Plane, ShieldCheck, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { ProgressBar } from '../../../../design-system';
import type { AdminDashboardFilters } from '../../../../lib/admin-dashboard-client';
import type { StatusSummaryRow } from '../../../../lib/admin-reports-client';
import type { CanonicalWorkflowStageCode } from '../../../../../../shared/adminWorkflow/canonicalStages';
import { DEFAULT_PAGE_SIZE, writeCandidateListStateToSearchParams } from '../../candidates/candidateListUrlState';
import { PIPELINE_BUCKET_HEX, PIPELINE_BUCKET_LABEL_KEYS, PIPELINE_BUCKET_ORDER, STAGE_TO_PIPELINE_BUCKET, groupStagesByPipelineBucket } from '../workflowPipelineBuckets';
import { stageLabel, type TFn } from './ReportTables';

const PHASE_ICON = { registration: UserPlus, documents: FileText, verificationPayment: BadgeCheck, qvcVisaProtection: ShieldCheck, flightMobilization: Plane };

/** Phase totals expand into actual stage queues; candidate links retain dashboard filters. */
export function WorkflowPipelineOverview({ workflowStageQueue, t, filters = {} }: { workflowStageQueue: StatusSummaryRow[]; t: TFn; filters?: AdminDashboardFilters }) {
  const totals = groupStagesByPipelineBucket(workflowStageQueue);
  const largestBucketTotal = Math.max(...PIPELINE_BUCKET_ORDER.map((bucket) => totals[bucket]), 0);

  return (
    <div className="flex flex-col gap-3 [&_[role=progressbar]]:h-3">
      {PIPELINE_BUCKET_ORDER.map((bucket) => {
        const count = totals[bucket];
        // Bars compare phase sizes, not completion percentages.
        const percentage = largestBucketTotal > 0 ? (count / largestBucketTotal) * 100 : 0;
        const label = t(PIPELINE_BUCKET_LABEL_KEYS[bucket]);
        const Icon = PHASE_ICON[bucket];
        const stages = workflowStageQueue.filter((row) => STAGE_TO_PIPELINE_BUCKET[row.code as CanonicalWorkflowStageCode] === bucket);
        return (
          <details key={bucket} className="group rounded-xl border border-border bg-surface-sunken/40 p-3">
            <summary className="cursor-pointer list-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium text-text-primary"><Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />{label}</span>
                <span className="flex items-center gap-2 font-semibold text-text-primary">{count}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></span>
              </div>
              <ProgressBar value={percentage} label={label} fillColor={PIPELINE_BUCKET_HEX[bucket]} />
            </summary>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {stages.map((row) => <li key={row.code}><Link to={`/admin?${writeCandidateListStateToSearchParams({ ...filters, status: row.code }, undefined, { number: 1, size: DEFAULT_PAGE_SIZE })}`} className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2 text-sm text-brand hover:bg-brand-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><span>{stageLabel(row.code, t)}</span><span className="font-semibold">{row.count}</span></Link></li>)}
            </ul>
          </details>
        );
      })}
      <Link to="/admin/reports" className="self-start text-sm font-medium text-brand hover:underline">{t('adminDashboardPipelineViewAllStages')}</Link>
    </div>
  );
}
