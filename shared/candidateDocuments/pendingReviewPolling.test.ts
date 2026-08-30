import { hasPendingRequiredDocument, PENDING_REVIEW_POLL_INTERVAL_MS } from './pendingReviewPolling';
import type { CandidateDocumentChecklistItem } from './types';

function item(overrides: Partial<CandidateDocumentChecklistItem> = {}): CandidateDocumentChecklistItem {
  return {
    requirementCode: 'passport',
    name: 'Passport',
    required: true,
    status: 'missing',
    replacementAllowed: false,
    document: null,
    ...overrides,
  };
}

describe('hasPendingRequiredDocument', () => {
  it('returns false for undefined or empty items', () => {
    expect(hasPendingRequiredDocument(undefined)).toBe(false);
    expect(hasPendingRequiredDocument([])).toBe(false);
  });

  it('returns true when a required document is pending_review', () => {
    expect(hasPendingRequiredDocument([item({ status: 'pending_review' })])).toBe(true);
  });

  it('returns false when only an optional document is pending_review', () => {
    expect(hasPendingRequiredDocument([item({ required: false, status: 'pending_review' })])).toBe(false);
  });

  it('returns false when required documents are verified, missing, or rejected but none pending', () => {
    expect(
      hasPendingRequiredDocument([item({ status: 'verified' }), item({ status: 'missing' }), item({ status: 'rejected' })])
    ).toBe(false);
  });

  it('exposes a positive, finite poll interval', () => {
    expect(PENDING_REVIEW_POLL_INTERVAL_MS).toBeGreaterThan(0);
  });
});
