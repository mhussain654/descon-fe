import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateConsentClient } from '../../../../lib/candidate-consent-client';
import type { CandidateConsentError } from '../../../../lib/candidate-consent-client';
import type { ConsentStatus } from '../../../../../../shared/auth/types';

/**
 * Owns the MPS-204 consent-acceptance mutation: records acceptance with the
 * backend, then updates the in-memory session so RequireAuth immediately
 * stops redirecting to the consent screen -- no page reload or re-login
 * needed.
 */
export function useAcceptConsent() {
  const { session, setConsentStatus } = useAuth();

  const mutation = useMutation<ConsentStatus, CandidateConsentError>({
    mutationFn: () => candidateConsentClient.accept(session?.accessToken ?? ''),
    onSuccess: (status) => setConsentStatus(status),
  });

  return { accept: mutation.mutate, ...mutation };
}
