// Staff/user & role administration types (MPS-F203). The client interface
// any implementation (mock today, MPS-205's real API later) must satisfy --
// same pattern as shared/auth/staffTypes.ts's StaffAuthClient.
import type { StaffRole, StaffStatus } from '../auth/staffTypes';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  /** ISO 8601. Set only while `status === 'invited'`. */
  invitedAt?: string;
  /** ISO 8601. Unset for a staff member who has never signed in. */
  lastActiveAt?: string;
}

export interface StaffDirectoryListParams {
  /** Matches against name or email, case-insensitively. */
  query?: string;
  role?: StaffRole;
  status?: StaffStatus;
}

export interface StaffInviteInput {
  name: string;
  email: string;
  role: StaffRole;
}

export interface StaffDirectoryClient {
  listStaff(params?: StaffDirectoryListParams): Promise<StaffMember[]>;
  inviteStaff(input: StaffInviteInput): Promise<StaffMember>;
  updateStaffRole(staffId: string, role: StaffRole): Promise<StaffMember>;
  updateStaffStatus(staffId: string, status: StaffStatus): Promise<StaffMember>;
}
