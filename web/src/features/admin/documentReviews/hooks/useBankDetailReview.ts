import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminBankDetailsClient } from '../../../../lib/admin-bank-details-client';
import type { AdminBankDetail, AdminBankDetailError, AdminBankProofAccess } from '../../../../../../shared/adminBankDetails/types';

const bankDetailKey = (candidateId: string, locale: string) => ['adminBankDetail', candidateId, locale] as const;

function randomKey(action: string): string {
  return `admin-bank-detail-${action}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The candidate's current bank details for review (null when none were added). */
export function useAdminBankDetail(candidateId: string | undefined, enabled: boolean) {
  const { language } = useLanguage();
  return useQuery<AdminBankDetail | null, AdminBankDetailError>({
    queryKey: bankDetailKey(candidateId ?? '', language),
    queryFn: () => adminBankDetailsClient.get(candidateId as string),
    enabled: Boolean(candidateId) && enabled,
  });
}

type Decision = { action: 'verified' } | { action: 'rejected'; reason: string };

/**
 * Verify/reject for the bank details. A retry of the same decision (same
 * reason) reuses its Idempotency-Key, so a request that reached the server
 * before the network failed is never applied twice.
 */
export function useBankDetailDecision(candidateId: string | undefined) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const lastAttempt = useRef<{ signature: string; key: string } | null>(null);

  const mutation = useMutation<AdminBankDetail, AdminBankDetailError, { decision: Decision; key: string }>({
    mutationFn: ({ decision, key }) =>
      decision.action === 'verified'
        ? adminBankDetailsClient.verify(candidateId as string, key)
        : adminBankDetailsClient.reject(candidateId as string, decision.reason, key),
    onSuccess: (bankDetail) => {
      lastAttempt.current = null;
      if (candidateId) queryClient.setQueryData(bankDetailKey(candidateId, language), bankDetail);
    },
  });

  const decide = useCallback(
    (decision: Decision, options?: { onSuccess?: () => void }) => {
      if (!candidateId || mutation.isPending) return;
      const signature = JSON.stringify(decision);
      if (lastAttempt.current?.signature !== signature) lastAttempt.current = { signature, key: randomKey(decision.action) };
      mutation.mutate({ decision, key: lastAttempt.current.key }, options);
    },
    [candidateId, mutation]
  );

  return { decide, mutation };
}

/** A short-lived link to the proof file, requested only when staff open the preview. */
export function useBankProofAccess(candidateId: string | undefined) {
  const [access, setAccess] = useState<AdminBankProofAccess | null>(null);
  const mutation = useMutation<AdminBankProofAccess, AdminBankDetailError>({
    mutationFn: () => adminBankDetailsClient.requestProofAccess(candidateId as string),
    onSuccess: setAccess,
  });
  const clear = useCallback(() => {
    setAccess(null);
    mutation.reset();
  }, [mutation]);
  return { access, request: () => mutation.mutate(), clear, isRequesting: mutation.isPending, error: mutation.error };
}
