// Web configuration for the candidate bank-details client, wired to the
// real backend (shared/candidateBankDetails/realCandidateBankDetailsClient.ts).
// Mirrors candidate-documents-client.ts's locale-reading convention exactly.
import { createCandidateBankDetailsClient } from '../../../shared/candidateBankDetails/realCandidateBankDetailsClient';
import type {
  BankDetailUpsertParams,
  CandidateBankDetail,
  CandidateBankDetailProof,
  CandidateBankDetailsClient,
  CandidateBankDetailsError,
  CandidateBankDetailsErrorCode,
  CandidateBankDetailState,
  CandidateBankDetailSummary,
} from '../../../shared/candidateBankDetails/types';
import { apiClient } from './api-client';

export type {
  BankDetailUpsertParams,
  CandidateBankDetail,
  CandidateBankDetailProof,
  CandidateBankDetailsClient,
  CandidateBankDetailsError,
  CandidateBankDetailsErrorCode,
  CandidateBankDetailState,
  CandidateBankDetailSummary,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see candidate-documents-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const candidateBankDetailsClient: CandidateBankDetailsClient = createCandidateBankDetailsClient({
  apiClient,
  getLocale,
});
