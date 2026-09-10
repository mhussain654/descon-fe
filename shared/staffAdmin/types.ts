// Staff/user & role administration types (MPS-F203), wired to the real
// MPS-205 backend (`Users::SummarySerializer`). The backend's `User` model
// has no name field for staff accounts -- only email, role, and staff
// state -- so this interface intentionally has no `name`, matching the
// real contract exactly (AGENTS.md: "Do not invent ... response fields").
import type { StaffRole, StaffStatus } from '../auth/staffTypes';

export interface StaffMember {
  id: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  /** ISO 8601. */
  createdAt: string;
}

export interface StaffDirectoryListParams {
  /** Matches against email, case-insensitively (substring). */
  query?: string;
  role?: StaffRole;
  status?: StaffStatus;
}

export interface StaffInviteInput {
  email: string;
  role: StaffRole;
}

export interface StaffDirectoryClient {
  listStaff(params?: StaffDirectoryListParams): Promise<StaffMember[]>;
  inviteStaff(input: StaffInviteInput): Promise<StaffMember>;
  updateStaffRole(staffId: string, role: StaffRole): Promise<StaffMember>;
  updateStaffStatus(staffId: string, status: StaffStatus): Promise<StaffMember>;
}
