// TEMPORARY client-side mirror of descon-be's role -> permission seed data
// (db/seeds.rb, on the not-yet-merged MPS-203/204 branch). The merged
// backend (main, as of MPS-F204) does not return permissions on
// UserProfile/SessionPayload yet -- `role` is still all the login/refresh
// response gives us.
//
// Once the backend profile/session response includes `permissions: string[]`
// (per the OpenAPI schema already drafted on that branch), delete this file
// and read `data.user.permissions` directly in realStaffAuthClient.ts
// instead of calling `derivePermissionsPendingBackendSupport`. Only the two
// permission codes the frontend actually checks today are represented here
// -- this is not a full mirror of the backend's permission catalog
// (AGENTS.md: "Do not permanently duplicate the backend role matrix").
import type { StaffRole } from './staffTypes';

const ROLES_WITH_MANAGE_STAFF_USERS: readonly StaffRole[] = ['admin'];
const ROLES_WITH_MANAGE_CANDIDATE_DOCUMENTS: readonly StaffRole[] = ['admin', 'hr', 'mps'];

export function derivePermissionsPendingBackendSupport(role: StaffRole): string[] {
  const permissions: string[] = [];
  if (ROLES_WITH_MANAGE_STAFF_USERS.includes(role)) permissions.push('manage_staff_users');
  if (ROLES_WITH_MANAGE_CANDIDATE_DOCUMENTS.includes(role)) permissions.push('manage_candidate_documents');
  return permissions;
}
