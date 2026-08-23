// Maps every staff-admin domain error code (from StaffDirectoryClient's
// ApiError.serverCode) to the shared translation key that explains it --
// same rationale/pattern as shared/auth/errorMessages.ts. Generic
// infrastructure failures (network/offline/unknown, no serverCode) fall
// back to the existing 'somethingWentWrong' key, exactly like the
// candidate-auth map does for its own NETWORK_ERROR/UNKNOWN.
export type StaffAdminServerErrorCode = 'duplicate_email' | 'last_admin' | 'staff_not_found' | 'service_unavailable';

export const STAFF_ADMIN_ERROR_KEYS: Record<StaffAdminServerErrorCode, string> = {
  duplicate_email: 'staffAdminDuplicateEmailError',
  last_admin: 'staffAdminLastAdminError',
  staff_not_found: 'staffAdminNotFoundError',
  service_unavailable: 'authServiceUnavailableError',
};
