// Mobile configuration for the candidate flight-detail client (mirrors
// web/src/lib/candidate-flight-detail-client.ts exactly). Wires the real
// backend (shared/candidateFlightDetail/realCandidateFlightDetailClient.ts).
import { createCandidateFlightDetailClient } from '../../../shared/candidateFlightDetail/realCandidateFlightDetailClient';
import type {
  CandidateFlightDetail,
  CandidateFlightDetailClient,
  CandidateFlightDetailError,
  CandidateFlightDetailErrorCode,
  FlightTicketAccess,
} from '../../../shared/candidateFlightDetail/types';
import { getCachedLanguage } from '../contexts/LanguageContext';
import { apiClient } from './api-client';

export type { CandidateFlightDetail, CandidateFlightDetailClient, CandidateFlightDetailError, CandidateFlightDetailErrorCode, FlightTicketAccess };

export const candidateFlightDetailClient: CandidateFlightDetailClient = createCandidateFlightDetailClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});
