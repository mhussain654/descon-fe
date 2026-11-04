import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminCandidateSmsClient } from '../../../../lib/admin-candidate-sms-client';
import { adminCandidateSmsQueries } from '../../../../../../shared/queryKeys/adminCandidateSmsQueries';
import type {
  AdminCandidateSmsError,
  CandidateSmsDelivery,
  CandidateSmsOverview,
  SendCandidateSmsInput,
} from '../../../../../../shared/adminCandidateSms/types';

/** The SMS staff can send this candidate, the language to preselect, and the candidate's SMS history. */
export function useCandidateSmsOverview(candidateId: string) {
  const { language } = useLanguage();

  return useQuery<CandidateSmsOverview, AdminCandidateSmsError>({
    queryKey: adminCandidateSmsQueries.overview(candidateId, language),
    queryFn: () => adminCandidateSmsClient.getOverview(candidateId),
  });
}

function randomKey(): string {
  return `admin-candidate-sms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Sends one SMS. A retry of the same message, language and values reuses its
 * Idempotency-Key, so a request that reached the server before the network
 * failed is never sent twice; any change gets a new key.
 */
export function useSendCandidateSms(candidateId: string) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const lastAttempt = useRef<{ signature: string; key: string } | null>(null);

  const mutation = useMutation<CandidateSmsDelivery, AdminCandidateSmsError, { input: SendCandidateSmsInput; key: string }>({
    mutationFn: ({ input, key }) => adminCandidateSmsClient.send(candidateId, input, key),
    onSuccess: () => {
      lastAttempt.current = null;
      queryClient.invalidateQueries({ queryKey: adminCandidateSmsQueries.overview(candidateId, language) });
    },
  });

  const send = useCallback(
    (input: SendCandidateSmsInput, options?: { onSuccess?: () => void }) => {
      if (mutation.isPending) return;
      const signature = JSON.stringify(input);
      if (lastAttempt.current?.signature !== signature) lastAttempt.current = { signature, key: randomKey() };
      mutation.mutate({ input, key: lastAttempt.current.key }, options);
    },
    [mutation]
  );

  return { send, mutation };
}
