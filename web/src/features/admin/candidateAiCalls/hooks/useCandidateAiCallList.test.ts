import { describe, expect, it } from 'vitest';
import { AI_CALL_POLL_INTERVAL_MS, nextAiCallPollInterval } from './useCandidateAiCallList';
import type { AdminCandidateAiCall } from '../../../../lib/admin-candidate-ai-calls-client';

function call(status: AdminCandidateAiCall['status']): AdminCandidateAiCall {
  return {
    id: `call-${status}`,
    direction: 'outbound',
    callReason: 'missing_documents',
    languageCode: 'en',
    status,
    verificationStatus: 'not_applicable',
    createdAt: '2026-09-10T10:00:00Z',
  };
}

describe('nextAiCallPollInterval', () => {
  it('does not poll when there is no data yet', () => {
    expect(nextAiCallPollInterval(undefined)).toBe(false);
  });

  it('does not poll an empty call list', () => {
    expect(nextAiCallPollInterval([])).toBe(false);
  });

  it.each(['requested', 'queued', 'ringing', 'in_progress', 'processing'] as const)(
    'polls while a call is still %s',
    (status) => {
      expect(nextAiCallPollInterval([call(status)])).toBe(AI_CALL_POLL_INTERVAL_MS);
    }
  );

  it.each(['completed', 'failed', 'cancelled'] as const)('stops polling once every call is %s', (status) => {
    expect(nextAiCallPollInterval([call(status)])).toBe(false);
  });

  it('keeps polling if even one call among several is still non-terminal', () => {
    expect(nextAiCallPollInterval([call('completed'), call('ringing'), call('failed')])).toBe(AI_CALL_POLL_INTERVAL_MS);
  });

  it('stops only once every call has reached a terminal status', () => {
    expect(nextAiCallPollInterval([call('completed'), call('failed'), call('cancelled')])).toBe(false);
  });
});
