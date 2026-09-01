// Admin candidate creation, detail and profile-editing types (MPS-F301). The
// client interface any implementation (real today -- backend PR
// feat/mps-f301-admin-candidate-creation-profile-editing -- must satisfy),
// mirroring the shared/adminWorkflow/types.ts pattern.

export interface ReferenceDataItem {
  code: string;
  /** Localized per the caller's current language. */
  name: string;
}

export interface AdminCandidateAssignmentSummary {
  id: string;
  referenceNumber: string;
  country: ReferenceDataItem;
  project: ReferenceDataItem;
  craft: ReferenceDataItem;
  currentWorkflowStage: { code: string; name: string };
  createdAt: string;
}

/**
 * Next-of-kin fields are all-or-nothing on the backend (Candidate model:
 * `validate :next_of_kin_fields_are_complete`, MPS-F301 next-of-kin
 * completion) -- either every one of the four is present, or none of them
 * is. A candidate with no next-of-kin recorded legitimately has all four
 * null; the fields are staff-facing only, unmasked, same trust level as
 * the candidate's own CNIC on this screen.
 */
export interface NextOfKinDetail {
  name: string | null;
  relationship: string | null;
  mobileNumber: string | null;
  cnic: string | null;
}

export interface AdminCandidateDetail {
  id: string;
  fullName: string;
  /** Unmasked -- staff with view_candidates/manage_candidates are trusted with the real value, unlike the candidate's own masked self-service profile. */
  cnic: string;
  mobileNumber: string;
  passportNumber: string | null;
  nextOfKin: NextOfKinDetail;
  preferredLocale: 'en' | 'ur';
  candidateStatus: string;
  active: boolean;
  createdAt: string;
  /** The more recent of the candidate's and its assignment's own updated_at. Echo back as `expectedUpdatedAt` on a subsequent update to guard against overwriting a concurrent edit. */
  updatedAt: string | null;
  assignment: AdminCandidateAssignmentSummary | null;
}

/** Send all four fields together, or none -- matches the backend's all-or-nothing validation. Sending all four as empty strings intentionally clears a previously recorded next-of-kin (the backend accepts an all-blank group as "clear", not as an incomplete one). */
export interface NextOfKinInput {
  name: string;
  relationship: string;
  mobileNumber: string;
  cnic: string;
}

export interface CreateCandidateInput {
  fullName: string;
  cnic: string;
  /** Stored as the candidate's own CNIC/OTP login mobile number. */
  mobileNumber: string;
  passportNumber?: string;
  /** Omit entirely to leave next-of-kin blank -- never send a partially-filled group. */
  nextOfKin?: NextOfKinInput;
  preferredLocale: 'en' | 'ur';
  countryCode: string;
  projectCode: string;
  craftCode: string;
  referenceNumber: string;
  idempotencyKey: string;
}

/**
 * Every field but `candidateId` is optional -- only fields actually being
 * changed should be set, since the real client only sends the keys present
 * on this object (never defaulting an omitted field to null/blank). `cnic`
 * and `referenceNumber` are never accepted here; both are immutable once the
 * candidate is created. `countryCode`/`projectCode`/`craftCode` are only
 * accepted by the backend while the candidate's assignment has not moved
 * past `documents_pending` -- submitting them later surfaces
 * ASSIGNMENT_FIELD_LOCKED.
 */
export interface UpdateCandidateInput {
  candidateId: string;
  fullName?: string;
  mobileNumber?: string;
  /** Send an empty string to clear a previously recorded passport number. */
  passportNumber?: string;
  /** Omit to leave next-of-kin completely untouched (an existing group is preserved, never silently cleared). Send all four fields as empty strings to intentionally clear it. */
  nextOfKin?: NextOfKinInput;
  preferredLocale?: 'en' | 'ur';
  countryCode?: string;
  projectCode?: string;
  craftCode?: string;
  /** Echo the detail response's own `updatedAt` to guard against overwriting a concurrent change. */
  expectedUpdatedAt?: string;
}

/**
 * Stable, platform-agnostic failure buckets, mirroring
 * shared/adminWorkflow/types.ts's AdminWorkflowErrorCode conventions.
 */
export type AdminCandidateErrorCode =
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_CNIC'
  | 'DUPLICATE_PASSPORT_NUMBER'
  | 'DUPLICATE_REFERENCE_NUMBER'
  | 'ASSIGNMENT_FIELD_LOCKED'
  | 'STALE_CANDIDATE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminCandidateError {
  code: AdminCandidateErrorCode;
  /** The backend's own already-localized message, when present -- prefer this over a hardcoded translation for VALIDATION_ERROR/DUPLICATE_*/ASSIGNMENT_FIELD_LOCKED, which cover many distinct underlying reasons. */
  message?: string;
  /** The field the first envelope error applies to, for form-level mapping (e.g. 'cnic', 'passport_number', 'reference_number', 'country_code'). */
  field?: string;
  retryAfterSeconds?: number;
}

export interface AdminCandidateClient {
  getCandidate(candidateId: string): Promise<AdminCandidateDetail>;
  createCandidate(input: CreateCandidateInput): Promise<AdminCandidateDetail>;
  updateCandidate(input: UpdateCandidateInput): Promise<AdminCandidateDetail>;
  getCountries(): Promise<ReferenceDataItem[]>;
  getProjects(): Promise<ReferenceDataItem[]>;
  getCrafts(): Promise<ReferenceDataItem[]>;
}
