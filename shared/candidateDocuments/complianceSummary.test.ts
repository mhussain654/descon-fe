import { buildComplianceSummary } from './complianceSummary';
import type { ApplicationProgressDocuments } from '../applicationProgress/types';
import type { CandidateDocumentChecklistItem } from './types';

function documents(overrides: Partial<ApplicationProgressDocuments> = {}): ApplicationProgressDocuments {
  return {
    requiredTotal: 4,
    missing: 0,
    uploaded: 0,
    pendingReview: 0,
    verified: 0,
    rejected: 0,
    submittedTotal: 0,
    completionPercentage: 0,
    canSubmit: false,
    submissionState: 'incomplete',
    blockingRequirements: [],
    ...overrides,
  };
}

function item(overrides: Partial<CandidateDocumentChecklistItem> = {}): CandidateDocumentChecklistItem {
  return {
    requirementCode: 'passport',
    name: 'Passport',
    required: true,
    status: 'verified',
    replacementAllowed: false,
    document: null,
    ...overrides,
  };
}

describe('buildComplianceSummary', () => {
  it('passes every backend-computed aggregate field through unchanged', () => {
    const docs = documents({ requiredTotal: 4, verified: 2, missing: 1, rejected: 1, completionPercentage: 75 });
    const result = buildComplianceSummary(docs, []);
    expect(result.requiredTotal).toBe(4);
    expect(result.verified).toBe(2);
    expect(result.missing).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.completionPercentage).toBe(75);
  });

  it('counts expired and near-expiry PCC documents separately from each other and from rejected', () => {
    const checklist = [
      item({
        requirementCode: 'police_character',
        document: { id: 'd1', fileName: 'pcc.pdf', contentType: 'application/pdf', fileSize: 1, uploadedAt: '2026-01-01', complianceStatus: 'expired' },
      }),
      item({
        requirementCode: 'cnic',
        status: 'rejected',
      }),
    ];
    const result = buildComplianceSummary(documents({ requiredTotal: 2, rejected: 1 }), checklist);
    expect(result.expired).toBe(1);
    expect(result.nearExpiry).toBe(0);
    expect(result.rejected).toBe(1);
  });

  it('never counts an optional document toward expired/near-expiry', () => {
    const checklist = [
      item({
        required: false,
        document: { id: 'd1', fileName: 'pcc.pdf', contentType: 'application/pdf', fileSize: 1, uploadedAt: '2026-01-01', complianceStatus: 'expired' },
      }),
    ];
    expect(buildComplianceSummary(documents(), checklist).expired).toBe(0);
  });

  it('computes verification percentage as verified/requiredTotal, distinct from submission completion percentage', () => {
    const docs = documents({ requiredTotal: 4, verified: 1, submittedTotal: 3, completionPercentage: 75 });
    const result = buildComplianceSummary(docs, []);
    expect(result.verificationPercentage).toBe(25);
    expect(result.completionPercentage).toBe(75);
  });

  it('never divides by zero when there are no required documents', () => {
    const result = buildComplianceSummary(documents({ requiredTotal: 0, verified: 0 }), []);
    expect(result.verificationPercentage).toBe(0);
    expect(Number.isFinite(result.verificationPercentage)).toBe(true);
  });
});
