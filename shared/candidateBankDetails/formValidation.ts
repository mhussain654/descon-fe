// Client-side field validation for the bank-details form. A UX improvement
// only -- the backend (Candidates::BankDetails::RequestValidator) remains
// authoritative regardless of what this module decides, same rationale as
// shared/candidateDocuments/fileValidation.ts. File validation itself is
// not duplicated here -- UpsertService reuses Documents::UploadService's
// exact same content-type/size limits, so the panel reuses
// validateSelectedFile from shared/candidateDocuments/fileValidation.ts
// directly.

import { isPakistanBank } from './pakistanBanks';

/** Mirrors descon-be's PakistanIban::FORMAT: "PK", 2 check digits, a 4-letter bank code and 16 digits. */
const PAKISTAN_IBAN_FORMAT = /^PK\d{2}[A-Z]{4}\d{16}$/;

/** ISO 13616 mod-97 check of an already-normalized IBAN, computed piecewise so no big integers are needed. */
function ibanChecksumValid(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const value = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Client rule: the candidate's full Pakistani IBAN, not a plain account number. Mirrors PakistanIban.valid?. */
export function isValidPakistanIban(normalized: string): boolean {
  return PAKISTAN_IBAN_FORMAT.test(normalized) && ibanChecksumValid(normalized);
}

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
  } else if (!isValidPakistanIban(normalizedAccountNumber)) {
    errors.accountNumber = 'INVALID_ACCOUNT_NUMBER';
  }

  // The form offers a fixed list of banks (see pakistanBanks.ts), so anything else is treated as not chosen.
  if (!isPakistanBank(fields.bankName)) errors.bankName = 'REQUIRED';

  return errors;
}

export function hasBankDetailFormErrors(errors: BankDetailFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
