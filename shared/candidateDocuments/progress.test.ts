import { calculateRequiredDocumentProgress } from './progress';
import type { CandidateDocumentChecklistItem } from './types';

function item(overrides: Partial<CandidateDocumentChecklistItem> = {}): CandidateDocumentChecklistItem {
  return {
    requirementCode: 'passport',
    name: 'Passport',
    required: true,
    status: 'missing',
    replacementAllowed: true,
    document: null,
    ...overrides,
  };
}

describe('calculateRequiredDocumentProgress', () => {
  it('avoids division by zero when there are no required documents', () => {
    const progress = calculateRequiredDocumentProgress([item({ required: false, status: 'missing' })]);
    expect(progress).toEqual({ requiredTotal: 0, requiredSubmitted: 0, percentage: 0, hasRequiredDocuments: false });
  });

  it('counts uploaded, pending_review and verified as submitted', () => {
    const items = [
      item({ requirementCode: 'a', status: 'uploaded' }),
      item({ requirementCode: 'b', status: 'pending_review' }),
      item({ requirementCode: 'c', status: 'verified' }),
      item({ requirementCode: 'd', status: 'missing' }),
    ];
    const progress = calculateRequiredDocumentProgress(items);
    expect(progress).toEqual({ requiredTotal: 4, requiredSubmitted: 3, percentage: 75, hasRequiredDocuments: true });
  });

  it('counts missing and rejected as incomplete', () => {
    const items = [item({ requirementCode: 'a', status: 'missing' }), item({ requirementCode: 'b', status: 'rejected' })];
    const progress = calculateRequiredDocumentProgress(items);
    expect(progress).toEqual({ requiredTotal: 2, requiredSubmitted: 0, percentage: 0, hasRequiredDocuments: true });
  });

  it('treats an unrecognized status as incomplete, never crashing or over-claiming completion', () => {
    const items = [item({ status: 'unknown' })];
    const progress = calculateRequiredDocumentProgress(items);
    expect(progress.requiredSubmitted).toBe(0);
  });

  it('excludes optional documents entirely -- they never reduce required-document completion', () => {
    const items = [
      item({ requirementCode: 'required-one', required: true, status: 'uploaded' }),
      item({ requirementCode: 'optional-one', required: false, status: 'missing' }),
    ];
    const progress = calculateRequiredDocumentProgress(items);
    expect(progress).toEqual({ requiredTotal: 1, requiredSubmitted: 1, percentage: 100, hasRequiredDocuments: true });
  });

  it('rounds the percentage', () => {
    const items = [
      item({ requirementCode: 'a', status: 'uploaded' }),
      item({ requirementCode: 'b', status: 'missing' }),
      item({ requirementCode: 'c', status: 'missing' }),
    ];
    const progress = calculateRequiredDocumentProgress(items);
    expect(progress.percentage).toBe(33);
  });
});
