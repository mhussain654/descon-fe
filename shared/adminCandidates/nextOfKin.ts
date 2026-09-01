// Next-of-kin fields are all-or-nothing on the backend (Candidate model:
// `validate :next_of_kin_fields_are_complete`) -- either every one of the
// four is present, or none of them is. This mirrors that rule on the
// frontend so a partial group is caught before the request is even sent,
// reusing the existing CNIC/mobile-number normalizers rather than
// duplicating their format rules.

export interface NextOfKinFormValues {
  name: string;
  relationship: string;
  mobileNumber: string;
  cnic: string;
}

/** True once at least one next-of-kin field has a non-blank value -- the point at which all four become required. */
export function isNextOfKinStarted(values: NextOfKinFormValues): boolean {
  return Object.values(values).some((value) => value.trim() !== '');
}

export interface NextOfKinFieldErrors {
  name?: string;
  relationship?: string;
  mobileNumber?: string;
  cnic?: string;
}
