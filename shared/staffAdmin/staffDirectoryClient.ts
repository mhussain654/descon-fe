// In-memory mock implementation of StaffDirectoryClient (MPS-F203), used
// only in tests -- the app itself uses `realStaffDirectoryClient.ts`
// against the real MPS-205 backend. Rejections use the same
// `ApiError`/`ApiErrorItem` shape shared/api-client.ts already defines for
// the real API (AGENTS.md: "Normalize API errors through one documented
// error model"), including the real backend's actual status/code shape
// (422 `validation_failed` with a `field`, confirmed against
// descon-be/openapi.yaml) so tests against this mock exercise the same
// error-handling code paths as production.
import type { ApiError } from '../api-client';
import { STAFF_ROLE_RANK } from '../auth/staffTypes';
import type { StaffRole, StaffStatus } from '../auth/staffTypes';
import type { StaffDirectoryClient, StaffDirectoryListParams, StaffInviteInput, StaffMember } from './types';

/** Seed data. IDs/emails intentionally match shared/auth/staffAuthClient.ts's MOCK_STAFF_ACCOUNTS for the admin/hr/finance identities, so signing in as one of them and viewing the staff list shows a consistent, recognizable "this is you" row. */
const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'staff_admin_1',
    email: 'admin@descon.com',
    role: 'admin',
    status: 'active',
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'staff_hr_1',
    email: 'hr@descon.com',
    role: 'hr',
    status: 'active',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'staff_finance_1',
    email: 'finance@descon.com',
    role: 'finance',
    status: 'active',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'staff_invited_1',
    email: 'hamza.haroon@descon.com',
    role: 'hr',
    status: 'invited',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'staff_suspended_1',
    email: 'zara.zaidi@descon.com',
    role: 'finance',
    status: 'suspended',
    createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function randomId(): string {
  return `staff_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Real backend shape: every domain validation failure (duplicate email, last-admin protection, self-suspension) is a 422 `validation_failed` with a field, distinguished only by `field` + message -- there is no separate `duplicate_email`/`last_admin` code (confirmed against openapi.yaml). The mock matches this exactly. */
function validationError(message: string, field: string): ApiError {
  return {
    status: 422,
    code: 'HTTP_4XX',
    serverCode: 'validation_failed',
    field,
    errors: [{ code: 'validation_failed', message, field }],
  };
}

function matchesQuery(member: StaffMember, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return member.email.toLowerCase().includes(normalized);
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

    async inviteStaff({ email, role }: StaffInviteInput) {
      await wait();

      const normalizedEmail = email.trim().toLowerCase();
      if (staff.some((member) => member.email.toLowerCase() === normalizedEmail)) {
        throw validationError('A staff member with this email already exists.', 'email');
      }

      const invited: StaffMember = {
        id: randomId(),
        email: email.trim(),
        role,
        status: 'invited',
        createdAt: new Date().toISOString(),
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
        throw validationError('At least one active admin must remain.', 'user.role');
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
        throw validationError('At least one active admin must remain.', 'user.staff_state');
      }

      const updated: StaffMember = { ...existing, status };
      staff = staff.map((member) => (member.id === staffId ? updated : member));
      return updated;
    },
  };
}
