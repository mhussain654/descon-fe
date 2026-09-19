import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateVisaDecisionsClient } from '../../../../lib/candidate-visa-decisions-client';
import type { CandidateVisaDecisionsError } from '../../../../lib/candidate-visa-decisions-client';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';

/**
 * Requests a short-lived signed URL for one of the candidate's own visa
 * decisions and hands it straight to the OS via `Linking.openURL` -- mirrors
 * useFlightTicketAccess.ts's identical "request-on-tap, hand off to the OS"
 * rationale. Unlike the flight ticket (one per assignment), a candidate can
 * have multiple visa decisions, so the decision's id is supplied per call.
 */
export function useVisaCopyAccess() {
  const { session } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<CandidateVisaDecisionsError | null>(null);

  const downloadVisaCopy = useCallback(
    async (visaDecisionId: string) => {
      if (!session || isRequesting) return;
      setIsRequesting(true);
      setError(null);
      try {
        const access = await candidateVisaDecisionsClient.requestVisaCopyAccess(session.accessToken, visaDecisionId);
        // Fails closed: null when the signed URL doesn't resolve to our own
        // API origin (a malformed backend response, an unexpected absolute
        // URL, a dangerous scheme) -- never hand that to Linking.openURL.
        const url = resolveDocumentAccessUrl(access.url, process.env.EXPO_PUBLIC_API_BASE_URL ?? '');
        if (!url) {
          setError({ code: 'UNKNOWN' });
          return;
        }
        await Linking.openURL(url);
      } catch (requestError) {
        setError(requestError as CandidateVisaDecisionsError);
      } finally {
        setIsRequesting(false);
      }
    },
    [session, isRequesting]
  );

  return { downloadVisaCopy, isRequesting, error, clearError: () => setError(null) };
}
