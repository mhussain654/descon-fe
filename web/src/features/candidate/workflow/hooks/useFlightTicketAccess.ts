import { useCallback } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateFlightDetailClient } from '../../../../lib/candidate-flight-detail-client';
import type { FlightTicketAccess } from '../../../../lib/candidate-flight-detail-client';
import { useShortLivedAccess } from './useShortLivedAccess';

/**
 * Requests a short-lived signed URL for the candidate's own flight ticket
 * on demand -- never eagerly on page load, matching the admin-side
 * FlightDetailPanel's identical "request-on-click" rationale (the
 * credential must not sit around unused).
 */
export function useFlightTicketAccess() {
  const { session } = useAuth();
  const access = useShortLivedAccess<FlightTicketAccess>();

  const requestTicketAccess = useCallback(() => {
    if (!session) return Promise.resolve();
    return access.requestAccess(() => candidateFlightDetailClient.requestTicketAccess(session.accessToken));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, access.requestAccess]);

  return { ...access, requestTicketAccess };
}
