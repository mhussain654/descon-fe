import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateFlightDetailClient } from '../../../../lib/candidate-flight-detail-client';
import type { CandidateFlightDetailError } from '../../../../lib/candidate-flight-detail-client';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';

/**
 * Requests a short-lived signed URL for the candidate's own flight ticket
 * and hands it straight to the OS via `Linking.openURL` -- the first use of
 * `Linking` in this codebase. Mobile has no equivalent of web's
 * request-then-click-a-link two-step (there's no in-app PDF viewer here);
 * a tap requests access and immediately opens the OS's PDF handler, mirroring
 * the admin FlightDetailPanel's "request-on-click, never eagerly on page
 * load" rationale for the credential itself. In-app viewing (vs. handing
 * off to the OS) is a separate future decision, not part of this item.
 */
export function useFlightTicketAccess() {
  const { session } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<CandidateFlightDetailError | null>(null);

  const downloadTicket = useCallback(async () => {
    if (!session || isRequesting) return;
    setIsRequesting(true);
    setError(null);
    try {
      const access = await candidateFlightDetailClient.requestTicketAccess(session.accessToken);
      const url = resolveDocumentAccessUrl(access.url, process.env.EXPO_PUBLIC_API_BASE_URL ?? '');
      await Linking.openURL(url);
    } catch (requestError) {
      setError(requestError as CandidateFlightDetailError);
    } finally {
      setIsRequesting(false);
    }
  }, [session, isRequesting]);

  return { downloadTicket, isRequesting, error, clearError: () => setError(null) };
}
