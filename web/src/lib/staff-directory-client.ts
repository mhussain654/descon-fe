// Web configuration for the staff directory / role-admin client (MPS-F203).
// Same selection pattern as staff-auth-client.ts and candidate auth-client.ts.
import {
  createMockStaffDirectoryClient,
  createUnavailableStaffDirectoryClient,
} from '../../../shared/staffAdmin/staffDirectoryClient';
import type { StaffDirectoryClient } from '../../../shared/staffAdmin/types';

export type { StaffDirectoryClient, StaffDirectoryListParams, StaffInviteInput, StaffMember } from '../../../shared/staffAdmin/types';

export function selectStaffDirectoryClient(isDev: boolean): StaffDirectoryClient {
  if (isDev) {
    return createMockStaffDirectoryClient();
  }
  // No real MPS-205 backend is wired up yet. Production must never fall
  // back to the mock (AGENTS.md: "Never silently fall back to mock data in
  // production") -- every call fails safely instead.
  return createUnavailableStaffDirectoryClient();
}

export const staffDirectoryClient = selectStaffDirectoryClient(import.meta.env.DEV);
