// Web configuration for the candidate flight-detail client, wired to the
// real backend (shared/candidateFlightDetail/realCandidateFlightDetailClient.ts).
// Mirrors candidate-documents-client.ts's locale-reading convention exactly.
import { createCandidateFlightDetailClient } from '../../../shared/candidateFlightDetail/realCandidateFlightDetailClient';
import type {
  CandidateFlightDetail,
  CandidateFlightDetailClient,
  CandidateFlightDetailError,
  CandidateFlightDetailErrorCode,
  FlightTicketAccess,
} from '../../../shared/candidateFlightDetail/types';
import { apiClient } from './api-client';

export type { CandidateFlightDetail, CandidateFlightDetailClient, CandidateFlightDetailError, CandidateFlightDetailErrorCode, FlightTicketAccess };

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see candidate-documents-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const candidateFlightDetailClient: CandidateFlightDetailClient = createCandidateFlightDetailClient({
  apiClient,
  getLocale,
});
