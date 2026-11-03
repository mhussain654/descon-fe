import { documentStatusGroup, documentSummaryTiles, hasSubmittedForReview } from './statusGroups';

describe('documentStatusGroup', () => {
  it('maps every document status onto the five statuses the candidate sees', () => {
    expect(documentStatusGroup('missing')).toBe('required');
    expect(documentStatusGroup('uploaded')).toBe('uploaded');
    expect(documentStatusGroup('pending_review')).toBe('under_approval');
    expect(documentStatusGroup('verified')).toBe('approved');
    expect(documentStatusGroup('rejected')).toBe('rejected');
    expect(documentStatusGroup('unknown')).toBeNull();
  });
});

describe('hasSubmittedForReview', () => {
  it('is false while documents are only missing or uploaded, and true once one is under approval or reviewed', () => {
    expect(hasSubmittedForReview([{ status: 'missing', required: true }, { status: 'uploaded', required: true }])).toBe(false);
    expect(hasSubmittedForReview([{ status: 'uploaded', required: true }, { status: 'pending_review', required: true }])).toBe(true);
    expect(hasSubmittedForReview([{ status: 'verified', required: true }])).toBe(true);
    expect(hasSubmittedForReview([{ status: 'rejected', required: true }])).toBe(true);
  });
});

describe('documentSummaryTiles', () => {
  it('shows Approved, Uploaded and the fixed Required total before submitting, leaving out optional documents', () => {
    const items = [
      { status: 'missing', required: true },
      { status: 'missing', required: true },
      { status: 'uploaded', required: true },
      { status: 'uploaded', required: false },
    ] as const;

    expect(documentSummaryTiles(items, null)).toEqual([
      { group: 'approved', count: 0 },
      { group: 'uploaded', count: 1 },
      { group: 'required', count: 3 },
    ]);
  });

  it('counts the bank account in Required, and in Uploaded once added', () => {
    const items = [{ status: 'uploaded', required: true }] as const;

    expect(documentSummaryTiles(items, 'missing')).toEqual([
      { group: 'approved', count: 0 },
      { group: 'uploaded', count: 1 },
      { group: 'required', count: 2 },
    ]);
    expect(documentSummaryTiles(items, 'submitted')[1]).toEqual({ group: 'uploaded', count: 2 });
  });

  it('switches to Approved, Under Approval and Rejected once submitted, following the review', () => {
    const items = [
      { status: 'pending_review', required: true },
      { status: 'pending_review', required: true },
      { status: 'verified', required: true },
      { status: 'rejected', required: true },
    ] as const;

    expect(documentSummaryTiles(items, 'submitted')).toEqual([
      { group: 'approved', count: 1 },
      { group: 'under_approval', count: 3 },
      { group: 'rejected', count: 1 },
    ]);
  });
});
