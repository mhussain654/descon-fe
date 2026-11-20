import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateFlightDetailClient } from '../../../../lib/candidate-flight-detail-client';
import type { CandidateFlightDetailError, FlightTicketAccess } from '../../../../lib/candidate-flight-detail-client';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';

/**
 * Requests a short-lived signed URL for one of the candidate's own flight
 * files and hands it straight to the OS via `Linking.openURL`. Mobile has no
 * equivalent of web's request-then-click-a-link two-step (there's no in-app
 * PDF or image viewer here); a tap requests access and immediately opens the
 * OS's handler, mirroring the admin FlightDetailPanel's "request-on-click,
 * never eagerly on page load" rationale for the credential itself.
 */
function useFlightFileAccess(request: (accessToken: string) => Promise<FlightTicketAccess>) {
  const { session, getAccessToken } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<CandidateFlightDetailError | null>(null);

  const open = useCallback(async () => {
    if (!session || isRequesting) return;
    setIsRequesting(true);
    setError(null);
    try {
      const access = await request(await getAccessToken());
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
      setError(requestError as CandidateFlightDetailError);
    } finally {
      setIsRequesting(false);
    }
  }, [session, getAccessToken, isRequesting, request]);

  return { open, isRequesting, error, clearError: () => setError(null) };
}

const requestTicket = (accessToken: string) => candidateFlightDetailClient.requestTicketAccess(accessToken);
const requestBoardingPass = (accessToken: string) => candidateFlightDetailClient.requestBoardingPassAccess(accessToken);

/** Opens the candidate's flight ticket. */
export function useFlightTicketAccess() {
  const { open, ...rest } = useFlightFileAccess(requestTicket);
  return { downloadTicket: open, ...rest };
}

/** Opens the boarding pass photo the candidate uploaded, so they can check it is the right one. */
export function useBoardingPassView() {
  const { open, ...rest } = useFlightFileAccess(requestBoardingPass);
  return { viewBoardingPass: open, ...rest };
}
