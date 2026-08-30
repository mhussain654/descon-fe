import { resolveNextAction, NEXT_ACTION_KEYS } from './nextAction';
import type { ApplicationProgress } from './types';
import type { CandidateDocumentChecklistItem } from '../candidateDocuments/types';

function progress(overrides: Partial<ApplicationProgress['documents']> = {}): ApplicationProgress {
  return {
    candidateStatus: 'registered',
    currentWorkflowStage: { code: 'documents_pending', name: 'Documents pending' },
    documents: {
      requiredTotal: 1,
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
    },
  };
}

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

describe('resolveNextAction', () => {
  it('prioritizes a rejected, replaceable required document above everything else', () => {
    const checklist = [
      item({ requirementCode: 'passport', name: 'Passport', status: 'missing' }),
      item({ requirementCode: 'cnic', name: 'CNIC', status: 'rejected', replacementAllowed: true }),
    ];
    const result = resolveNextAction(progress({ canSubmit: true }), checklist);
    expect(result).toEqual({ kind: 'rejected_replaceable', requirementName: 'CNIC' });
  });

  it('ignores a rejected document that cannot yet be replaced', () => {
    const checklist = [item({ status: 'rejected', replacementAllowed: false }), item({ requirementCode: 'cnic', name: 'CNIC', status: 'missing' })];
    const result = resolveNextAction(progress(), checklist);
    expect(result).toEqual({ kind: 'missing_required', requirementName: 'CNIC' });
  });

  it('falls back to a missing required document when nothing is rejected', () => {
    const checklist = [item({ status: 'missing' })];
    expect(resolveNextAction(progress(), checklist)).toEqual({ kind: 'missing_required', requirementName: 'Passport' });
  });

  it('never surfaces an optional missing document as the next action', () => {
    const checklist = [item({ required: false, status: 'missing' })];
    expect(resolveNextAction(progress({ canSubmit: true }), checklist).kind).not.toBe('missing_required');
  });

  it('surfaces a replaceable expired PCC document', () => {
    const checklist = [
      item({
        requirementCode: 'police_character',
        name: 'Police Character Certificate',
        status: 'verified',
        replacementAllowed: true,
        document: { id: 'd1', fileName: 'pcc.pdf', contentType: 'application/pdf', fileSize: 1, uploadedAt: '2026-01-01', complianceStatus: 'expired' },
      }),
    ];
    expect(resolveNextAction(progress(), checklist)).toEqual({
      kind: 'expired_pcc_replaceable',
      requirementName: 'Police Character Certificate',
    });
  });

  it('signals ready-to-submit once nothing is missing/rejected/expired and canSubmit is true', () => {
    const checklist = [item({ status: 'uploaded' })];
    expect(resolveNextAction(progress({ canSubmit: true }), checklist)).toEqual({ kind: 'ready_to_submit' });
  });

  it('signals awaiting-review while a document is pending review and nothing blocks submission', () => {
    const checklist = [item({ status: 'pending_review' })];
    expect(resolveNextAction(progress({ pendingReview: 1 }), checklist)).toEqual({ kind: 'awaiting_review' });
  });

  it('signals verified once the backend reports the submission state as verified', () => {
    const checklist = [item({ status: 'verified' })];
    expect(resolveNextAction(progress({ verified: 1, submissionState: 'verified' }), checklist)).toEqual({ kind: 'verified' });
  });

  it('falls back to the workflow stage when nothing else applies', () => {
    const result = resolveNextAction(progress({ submissionState: 'no_requirements' }), []);
    expect(result).toEqual({ kind: 'workflow_stage', requirementName: 'Documents pending' });
  });

  it('falls back with no requirement name when there is no current workflow stage either', () => {
    const p = progress({ submissionState: 'no_assignment' });
    p.currentWorkflowStage = null;
    expect(resolveNextAction(p, [])).toEqual({ kind: 'workflow_stage', requirementName: undefined });
  });

  it('defines a translation key for every possible next-action kind', () => {
    for (const kind of Object.keys(NEXT_ACTION_KEYS)) {
      expect(typeof NEXT_ACTION_KEYS[kind as keyof typeof NEXT_ACTION_KEYS]).toBe('string');
    }
  });
});
