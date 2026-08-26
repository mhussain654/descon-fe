// Web configuration for the staff authentication client (MPS-F204). Wires
// the real MPS-202 backend (shared/auth/realStaffAuthClient.ts, calling
// shared/api-client.ts's apiClient) -- the mock
// (shared/auth/staffAuthClient.ts) now exists purely for dev-without-a-
// backend convenience and tests, never wired into the app (AGENTS.md: "No
// staff authentication mock data remains in the active runtime path").
import { createStaffAuthClient } from '../../../shared/auth/realStaffAuthClient';
import type { StaffAuthClient } from '../../../shared/auth/staffTypes';
import { apiClient } from './api-client';

export type { StaffAuthClient, StaffAuthError, StaffAuthErrorCode, StaffRole, StaffSession } from '../../../shared/auth/staffTypes';

export const staffAuthClient: StaffAuthClient = createStaffAuthClient({ apiClient });
