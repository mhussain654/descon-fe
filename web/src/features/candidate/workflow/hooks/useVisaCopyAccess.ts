import { useCallback } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateVisaDecisionsClient } from '../../../../lib/candidate-visa-decisions-client';
import type { CandidateVisaDecisionsError, VisaCopyAccess } from '../../../../lib/candidate-visa-decisions-client';
import { useShortLivedAccess } from './useShortLivedAccess';

/**
 * Requests a short-lived signed URL for one of the candidate's own visa
 * decisions on demand -- never eagerly on page load, mirroring
 * useFlightTicketAccess.ts's identical "request-on-click" rationale (the
 * credential must not sit around unused). Unlike the flight ticket (one per
 * assignment), a candidate can have multiple visa decisions, so the
 * decision's id must be supplied per request rather than assumed.
 */
export function useVisaCopyAccess() {
  const { session } = useAuth();
  const access = useShortLivedAccess<VisaCopyAccess, CandidateVisaDecisionsError>();

  const requestVisaCopyAccess = useCallback(
    (visaDecisionId: string) => {
      if (!session) return Promise.resolve();
      return access.requestAccess(() =>
        candidateVisaDecisionsClient.requestVisaCopyAccess(session.accessToken, visaDecisionId)
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [session, access.requestAccess]
  );

  return { ...access, requestVisaCopyAccess };
}
