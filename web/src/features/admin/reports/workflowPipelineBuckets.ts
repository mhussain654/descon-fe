// Frontend-only rollup of the 15 canonical workflow stages into 5 display
// buckets for the admin dashboard's pipeline overview -- no backend change,
// pure UI taxonomy over data the dashboard endpoint already returns (see the
// "Admin Dashboard -- Full Data-Backed Redesign" plan's frontend section for
// the exact bucket-to-stage mapping this mirrors).
import { CANONICAL_WORKFLOW_STAGE_CODES, type CanonicalWorkflowStageCode } from '../../../../../shared/adminWorkflow/canonicalStages';
import type { TranslationKey } from '../../../../../shared/i18n/translations';

export type PipelineBucketKey = 'registration' | 'documents' | 'verificationPayment' | 'qvcVisaProtection' | 'flightMobilization';

export const PIPELINE_BUCKET_ORDER: PipelineBucketKey[] = [
  'registration',
  'documents',
  'verificationPayment',
  'qvcVisaProtection',
  'flightMobilization',
];

export const PIPELINE_BUCKET_LABEL_KEYS: Record<PipelineBucketKey, TranslationKey> = {
  registration: 'adminDashboardPipelineRegistration',
  documents: 'adminDashboardPipelineDocuments',
  verificationPayment: 'adminDashboardPipelineVerificationPayment',
  qvcVisaProtection: 'adminDashboardPipelineQvcVisaProtection',
  flightMobilization: 'adminDashboardPipelineFlightMobilization',
};

/** Fixed, purely decorative per-bucket color so the 5 pipeline bars are distinguishable at a glance -- these buckets are an ordered/neutral breakdown (not good/bad categories), so this is a dedicated palette rather than reusing ReportCharts.tsx's semantic CHART_TONE_HEX (danger/warning/etc. would misleadingly imply a problem). */
export const PIPELINE_BUCKET_HEX: Record<PipelineBucketKey, string> = {
  registration: '#3B82F6',
  documents: '#10B981',
  verificationPayment: '#8B5CF6',
  qvcVisaProtection: '#F59E0B',
  flightMobilization: '#06B6D4',
};

/** Nearest design-system Badge tone per bucket, for the "Stage" column on RecentlyUpdatedCandidatesTable -- a coarser 5-value approximation of the pipeline-bar palette above, not required to match it exactly. */
export const PIPELINE_BUCKET_BADGE_TONE: Record<PipelineBucketKey, 'neutral' | 'brand' | 'info' | 'warning' | 'success'> = {
  registration: 'neutral',
  documents: 'brand',
  verificationPayment: 'info',
  qvcVisaProtection: 'warning',
  flightMobilization: 'success',
};

/** Every one of the 15 canonical stage codes must appear here exactly once -- see workflowPipelineBuckets.test.ts's exhaustiveness check, which catches a future 16th stage being silently dropped. */
export const STAGE_TO_PIPELINE_BUCKET: Record<CanonicalWorkflowStageCode, PipelineBucketKey> = {
  registered: 'registration',
  documents_pending: 'documents',
  documents_uploaded: 'documents',
  under_verification: 'verificationPayment',
  verified: 'verificationPayment',
  fee_pending: 'verificationPayment',
  fee_paid: 'verificationPayment',
  documents_shared_with_qatar_bu: 'qvcVisaProtection',
  qvc_appointment_booked: 'qvcVisaProtection',
  qvc_completed_outcome_received: 'qvcVisaProtection',
  visa_issued_or_rejected: 'qvcVisaProtection',
  appeared_for_protection: 'qvcVisaProtection',
  protected_ready_to_fly: 'flightMobilization',
  flight_details_uploaded: 'flightMobilization',
  mobilized: 'flightMobilization',
};

export function groupStagesByPipelineBucket(rows: { code: string; count: number }[]): Record<PipelineBucketKey, number> {
  const totals: Record<PipelineBucketKey, number> = {
    registration: 0,
    documents: 0,
    verificationPayment: 0,
    qvcVisaProtection: 0,
    flightMobilization: 0,
  };

  for (const row of rows) {
    const bucket = STAGE_TO_PIPELINE_BUCKET[row.code as CanonicalWorkflowStageCode];
    if (bucket) totals[bucket] += row.count;
  }

  return totals;
}

export function allCanonicalStagesAreBucketed(): boolean {
  return CANONICAL_WORKFLOW_STAGE_CODES.every((code) => code in STAGE_TO_PIPELINE_BUCKET);
}
