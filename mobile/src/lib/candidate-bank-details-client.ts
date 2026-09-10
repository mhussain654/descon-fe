// Mobile configuration for the candidate bank-details client (mirrors
// web/src/lib/candidate-bank-details-client.ts exactly). Wires the real
// backend (shared/candidateBankDetails/realCandidateBankDetailsClient.ts).
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
import { getCachedLanguage } from '../contexts/LanguageContext';
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

export const candidateBankDetailsClient: CandidateBankDetailsClient = createCandidateBankDetailsClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});
