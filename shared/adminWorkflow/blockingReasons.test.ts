import { toWorkflowBlockingReason, WORKFLOW_BLOCKING_REASON_KEYS, type WorkflowBlockingReason } from './blockingReasons';

describe('toWorkflowBlockingReason', () => {
  it.each(['required_documents_not_verified', 'expired_pcc', 'payment_required', 'documents_required'] as const)(
    'recognizes the known reason %s',
    (reason) => {
      expect(toWorkflowBlockingReason(reason)).toBe(reason);
    }
  );

  it('falls back to unknown for an unrecognized reason code, never the raw string', () => {
    expect(toWorkflowBlockingReason('some_future_reason')).toBe('unknown');
  });
});

describe('WORKFLOW_BLOCKING_REASON_KEYS', () => {
  const ALL_REASONS: WorkflowBlockingReason[] = [
    'required_documents_not_verified',
    'expired_pcc',
    'payment_required',
    'documents_required',
    'unknown',
  ];

  it('has a non-empty translation key for every reason, including the unknown fallback', () => {
    ALL_REASONS.forEach((reason) => {
      expect(WORKFLOW_BLOCKING_REASON_KEYS[reason]).toBeTruthy();
    });
  });
});
