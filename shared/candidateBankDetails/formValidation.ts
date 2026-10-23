// Client-side field validation for the bank-details form. A UX improvement
// only -- the backend (Candidates::BankDetails::RequestValidator) remains
// authoritative regardless of what this module decides, same rationale as
// shared/candidateDocuments/fileValidation.ts. File validation itself is
// not duplicated here -- UpsertService reuses Documents::UploadService's
// exact same content-type/size limits, so the panel reuses
// validateSelectedFile from shared/candidateDocuments/fileValidation.ts
// directly.

import { isPakistanBank } from './pakistanBanks';

/** Mirrors CandidateBankDetail::ACCOUNT_NUMBER_FORMAT exactly: 6-20 digits after normalization (whitespace stripped). */
const ACCOUNT_NUMBER_FORMAT = /^\d{6,20}$/;

export type BankDetailFieldError = 'REQUIRED' | 'INVALID_ACCOUNT_NUMBER';

export interface BankDetailFormErrors {
  accountTitle?: BankDetailFieldError;
  accountNumber?: BankDetailFieldError;
  bankName?: BankDetailFieldError;
}

/** Same normalization the backend applies before validating/storing (AccountNumberNormalizer): uppercase, whitespace stripped. */
export function normalizeAccountNumber(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}

export function validateBankDetailFields(fields: { accountTitle: string; accountNumber: string; bankName: string }): BankDetailFormErrors {
  const errors: BankDetailFormErrors = {};

  if (!fields.accountTitle.trim()) errors.accountTitle = 'REQUIRED';

  const normalizedAccountNumber = normalizeAccountNumber(fields.accountNumber);
  if (!normalizedAccountNumber) {
    errors.accountNumber = 'REQUIRED';
  } else if (!ACCOUNT_NUMBER_FORMAT.test(normalizedAccountNumber)) {
    errors.accountNumber = 'INVALID_ACCOUNT_NUMBER';
  }

  // The form offers a fixed list of banks (see pakistanBanks.ts), so anything else is treated as not chosen.
  if (!isPakistanBank(fields.bankName)) errors.bankName = 'REQUIRED';

  return errors;
}

export function hasBankDetailFormErrors(errors: BankDetailFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
