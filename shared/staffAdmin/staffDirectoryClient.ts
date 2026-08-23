// In-memory mock implementation of StaffDirectoryClient (MPS-F203). Stands
// in for the not-yet-built MPS-205 staff-admin API during UI development.
// Rejections use the same `ApiError`/`ApiErrorItem` shape shared/api-client.ts
// already defines for the real API, so the UI's field-addressable error
// handling is written once against that one documented error model
// (AGENTS.md: "Normalize API errors through one documented error model") and
// doesn't change when the real MPS-205 client replaces this mock.
import type { ApiError } from '../api-client';
import { STAFF_ROLE_RANK } from '../auth/staffTypes';
import type { StaffRole, StaffStatus } from '../auth/staffTypes';
import type { StaffDirectoryClient, StaffDirectoryListParams, StaffInviteInput, StaffMember } from './types';

/** Seed data. IDs/emails intentionally match shared/auth/staffAuthClient.ts's MOCK_STAFF_ACCOUNTS for the admin/manager/viewer identities, so signing in as one of them and viewing the staff list shows a consistent, recognizable "this is you" row. */
const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'staff_admin_1',
    name: 'Ayesha Admin',
    email: 'admin@descon.com',
    role: 'admin',
    status: 'active',
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'staff_manager_1',
    name: 'Bilal Manager',
    email: 'manager@descon.com',
    role: 'manager',
    status: 'active',
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'staff_viewer_1',
    name: 'Sana Viewer',
    email: 'viewer@descon.com',
    role: 'viewer',
    status: 'active',
    lastActiveAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'staff_invited_1',
    name: 'Hamza Haroon',
    email: 'hamza.haroon@descon.com',
    role: 'manager',
    status: 'invited',
    invitedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'staff_suspended_1',
    name: 'Zara Zaidi',
    email: 'zara.zaidi@descon.com',
    role: 'viewer',
    status: 'suspended',
    lastActiveAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function randomId(): string {
  return `staff_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function conflictError(errorCode: string, message: string): ApiError {
  return {
    status: 409,
    code: 'HTTP_4XX',
    serverCode: errorCode,
    errors: [{ code: errorCode, message }],
  };
}

function validationError(errorCode: string, message: string, field: string): ApiError {
  return {
    status: 422,
    code: 'HTTP_4XX',
    serverCode: errorCode,
    field,
    errors: [{ code: errorCode, message, field }],
  };
}

function matchesQuery(member: StaffMember, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return member.name.toLowerCase().includes(normalized) || member.email.toLowerCase().includes(normalized);
}

export interface MockStaffDirectoryClientOptions {
  /** Simulated network latency in ms. Set to 0 in tests. */
  delayMs?: number;
}

export function createMockStaffDirectoryClient(options: MockStaffDirectoryClientOptions = {}): StaffDirectoryClient {
  const { delayMs = 300 } = options;
  const wait = () => (delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve());

  // Deliberately module-instance-local (not module-level) state -- each
  // `createMockStaffDirectoryClient()` call starts from the same seed, so
  // tests stay isolated from each other without needing a manual reset hook.
  let staff: StaffMember[] = INITIAL_STAFF.map((member) => ({ ...member }));

  function activeAdminCount(): number {
    return staff.filter((member) => member.role === 'admin' && member.status !== 'suspended').length;
  }

  return {
    async listStaff(params: StaffDirectoryListParams = {}) {
      await wait();
      return staff.filter((member) => {
        if (params.query && !matchesQuery(member, params.query)) return false;
        if (params.role && member.role !== params.role) return false;
        if (params.status && member.status !== params.status) return false;
        return true;
      });
    },

    async inviteStaff({ name, email, role }: StaffInviteInput) {
      await wait();

      const normalizedEmail = email.trim().toLowerCase();
      if (staff.some((member) => member.email.toLowerCase() === normalizedEmail)) {
        throw validationError('duplicate_email', 'A staff member with this email already exists.', 'email');
      }

      const invited: StaffMember = {
        id: randomId(),
        name: name.trim(),
        email: email.trim(),
        role,
        status: 'invited',
        invitedAt: new Date().toISOString(),
      };
      staff = [...staff, invited];
      return invited;
    },

    async updateStaffRole(staffId: string, role: StaffRole) {
      await wait();

      const existing = staff.find((member) => member.id === staffId);
      if (!existing) {
        throw { status: 404, code: 'HTTP_4XX', serverCode: 'staff_not_found' } satisfies ApiError;
      }

      const isDowngrade = STAFF_ROLE_RANK[role] < STAFF_ROLE_RANK[existing.role];
      if (isDowngrade && existing.role === 'admin' && activeAdminCount() <= 1) {
        throw conflictError('last_admin', 'At least one active admin must remain.');
      }

      const updated: StaffMember = { ...existing, role };
      staff = staff.map((member) => (member.id === staffId ? updated : member));
      return updated;
    },

    async updateStaffStatus(staffId: string, status: StaffStatus) {
      await wait();

      const existing = staff.find((member) => member.id === staffId);
      if (!existing) {
        throw { status: 404, code: 'HTTP_4XX', serverCode: 'staff_not_found' } satisfies ApiError;
      }

      if (status === 'suspended' && existing.role === 'admin' && existing.status !== 'suspended' && activeAdminCount() <= 1) {
        throw conflictError('last_admin', 'At least one active admin must remain.');
      }

      const updated: StaffMember = { ...existing, status };
      staff = staff.map((member) => (member.id === staffId ? updated : member));
      return updated;
    },
  };
}

/**
 * Safe fallback for any build where the mock must not be reachable (i.e.
 * production, until MPS-205 ships a real implementation) -- same pattern as
 * shared/auth/staffAuthClient.ts's `createUnavailableStaffAuthClient`.
 */
export function createUnavailableStaffDirectoryClient(): StaffDirectoryClient {
  const fail = (): Promise<never> =>
    Promise.reject({ status: 503, code: 'HTTP_5XX', serverCode: 'service_unavailable' } satisfies ApiError);
  return {
    listStaff: fail,
    inviteStaff: fail,
    updateStaffRole: fail,
    updateStaffStatus: fail,
  };
}
