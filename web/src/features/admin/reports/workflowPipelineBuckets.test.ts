import { describe, expect, it } from 'vitest';
import { CANONICAL_WORKFLOW_STAGE_CODES } from '../../../../../shared/adminWorkflow/canonicalStages';
import { groupStagesByPipelineBucket, PIPELINE_BUCKET_ORDER, STAGE_TO_PIPELINE_BUCKET } from './workflowPipelineBuckets';

describe('workflowPipelineBuckets', () => {
  it('maps every canonical workflow stage to exactly one of the 5 pipeline buckets', () => {
    for (const code of CANONICAL_WORKFLOW_STAGE_CODES) {
      expect(STAGE_TO_PIPELINE_BUCKET[code]).toBeDefined();
      expect(PIPELINE_BUCKET_ORDER).toContain(STAGE_TO_PIPELINE_BUCKET[code]);
    }
  });

  it('sums stage counts into their bucket totals', () => {
    const totals = groupStagesByPipelineBucket([
      { code: 'registered', count: 5 },
      { code: 'documents_pending', count: 2 },
      { code: 'documents_uploaded', count: 3 },
      { code: 'mobilized', count: 7 },
    ]);

    expect(totals.registration).toBe(5);
    expect(totals.documents).toBe(5);
    expect(totals.flightMobilization).toBe(7);
    expect(totals.verificationPayment).toBe(0);
    expect(totals.qvcVisaProtection).toBe(0);
  });

  it('ignores an unrecognized stage code rather than throwing', () => {
    expect(() => groupStagesByPipelineBucket([{ code: 'some_future_stage', count: 1 }])).not.toThrow();
  });
});
