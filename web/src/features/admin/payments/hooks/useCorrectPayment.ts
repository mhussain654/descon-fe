import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  adminPaymentsClient,
  type AdminPaymentError,
  type PaymentCorrectionRequest,
  type PaymentDetail,
} from '../../../../lib/admin-payments-client';
import { adminPaymentQueries } from '../../../../../../shared/queryKeys/adminPaymentQueries';

function randomIdempotencyKey(): string {
  return `admin-payment-correction-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Applies a correction to one payment (ticket: "Stable Idempotency-Key").
 * A fresh key is minted lazily -- inside the mutationFn itself, via a
 * `useRef` rather than state (state only updates on the next render, which
 * would still be stale if a retry fires immediately) -- the first time a
 * confirmed submission actually runs, and reused across any retry of that
 * exact same submission. Call `resetForNewAttempt` whenever the correction
 * being submitted has genuinely changed (a different field/finding/value),
 * so that's treated as a new action with its own key, not a retry.
 *
 * On success, seeds this payment's own detail cache with the corrected
 * result and invalidates both the detail query and every payment-list
 * query, so the list's own status/reconciliation columns and the detail
 * page's own findings/events both reflect the correction immediately
 * (ticket: "Refresh of payment detail, list, and reconciliation data after
 * success").
 */
export function useCorrectPayment(paymentId: string) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);
  const isCorrectingRef = useRef(false);

  const mutation = useMutation<PaymentDetail, AdminPaymentError, PaymentCorrectionRequest>({
    mutationFn: (correction) => {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = randomIdempotencyKey();
      return adminPaymentsClient.correctPayment(paymentId, correction, idempotencyKeyRef.current);
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(adminPaymentQueries.detail(detail.id, language), detail);
      queryClient.invalidateQueries({ queryKey: adminPaymentQueries.detail(detail.id, language) });
      queryClient.invalidateQueries({ queryKey: ['adminPayments', 'list'] });
      idempotencyKeyRef.current = null;
    },
    onSettled: () => {
      isCorrectingRef.current = false;
    },
  });

  const correct = useCallback(
    (correction: PaymentCorrectionRequest) => {
      if (isCorrectingRef.current) return;
      isCorrectingRef.current = true;
      mutation.mutate(correction);
    },
    [mutation]
  );

  const resetForNewAttempt = useCallback(() => {
    idempotencyKeyRef.current = null;
    mutation.reset();
  }, [mutation]);

  return { correct, resetForNewAttempt, mutation };
}
