import { ADMIN_WORKFLOW_ERROR_KEYS } from './errorMessages';
import type { AdminWorkflowErrorCode } from './types';

const ALL_CODES: AdminWorkflowErrorCode[] = [
  'VALIDATION_ERROR',
  'WORKFLOW_TRANSITION_STALE',
  'WORKFLOW_TRANSITION_PREREQUISITE_MISSING',
  'IDEMPOTENCY_CONFLICT',
  'MISSING_IDEMPOTENCY_KEY',
  'INVALID_IDEMPOTENCY_KEY',
  'IDEMPOTENCY_IN_PROGRESS',
  'INACTIVE_ACCOUNT',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'NETWORK_ERROR',
  'OFFLINE',
  'SERVER_ERROR',
  'UNKNOWN',
];

describe('ADMIN_WORKFLOW_ERROR_KEYS', () => {
  it('has a non-empty translation key for every error code', () => {
    ALL_CODES.forEach((code) => {
      expect(ADMIN_WORKFLOW_ERROR_KEYS[code]).toBeTruthy();
    });
  });
});
