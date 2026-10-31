import { countDocumentStatusGroups, documentStatusGroup } from './statusGroups';

describe('documentStatusGroup', () => {
  it('maps every document status onto the four statuses the candidate sees', () => {
    expect(documentStatusGroup('missing')).toBe('required');
    expect(documentStatusGroup('uploaded')).toBe('under_review');
    expect(documentStatusGroup('pending_review')).toBe('under_review');
    expect(documentStatusGroup('verified')).toBe('complete');
    expect(documentStatusGroup('rejected')).toBe('rejected');
    expect(documentStatusGroup('unknown')).toBeNull();
  });
});

describe('countDocumentStatusGroups', () => {
  const items = [
    { status: 'missing', required: true },
    { status: 'missing', required: false },
    { status: 'uploaded', required: true },
    { status: 'pending_review', required: true },
    { status: 'verified', required: true },
    { status: 'rejected', required: true },
    { status: 'unknown', required: true },
  ] as const;

  it('counts each status, leaving out optional documents not yet uploaded and unknown statuses', () => {
    expect(countDocumentStatusGroups(items, null)).toEqual({ required: 1, under_review: 2, complete: 1, rejected: 1 });
  });

  it('counts the bank account as Required until submitted, then Under Review', () => {
    expect(countDocumentStatusGroups(items, 'missing').required).toBe(2);
    expect(countDocumentStatusGroups(items, 'submitted').under_review).toBe(3);
  });
});
