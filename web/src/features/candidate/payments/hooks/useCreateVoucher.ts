import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { paymentsClient } from '../../../../lib/payments-client';
import type { InitiateCheckoutResult, PaymentError } from '../../../../lib/payments-client';
import {
  beginNewCheckoutAttempt,
  clearCheckoutIdempotencyKey,
  EMPTY_CHECKOUT_IDEMPOTENCY_KEY_STATE,
  randomCheckoutIdempotencyKey,
  retryCheckoutAttempt,
  type CheckoutIdempotencyKeyState,
} from '../../../../../../shared/payments/checkoutIdempotency';
import { paymentQueries } from '../../../../../../shared/queryKeys/paymentQueries';

/** Errors only something changing elsewhere can fix (not eligible, switched off): the next attempt mints a fresh key and the screen reloads what is allowed now. */
const TERMINAL_ERROR_CODES = new Set<PaymentError['code']>(['NOT_ELIGIBLE', 'CHECKOUT_UNAVAILABLE']);

interface CreateVoucherVariables {
  idempotencyKey: string;
  candidateIdAtCallTime: string;
}

/**
 * Gets the candidate's payment code, or the one already open. Same
 * idempotency-key lifecycle and double-tap guard as useInitiateCheckout.ts:
 * the request body is always empty, so the only question is whether this is a
 * retry of the current attempt or a fresh one.
 */
export function useCreateVoucher() {
  const { session, getAccessToken } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';
  const [idempotencyState, setIdempotencyState] = useState<CheckoutIdempotencyKeyState>(EMPTY_CHECKOUT_IDEMPOTENCY_KEY_STATE);

  const mutation = useMutation<InitiateCheckoutResult, PaymentError, CreateVoucherVariables>({
    mutationFn: async ({ idempotencyKey }) => paymentsClient.createVoucher(await getAccessToken(), idempotencyKey),
    onSuccess: (result, variables) => {
      if (session?.candidateId !== variables.candidateIdAtCallTime) return;

      queryClient.setQueryData(paymentQueries.eligibility(candidateId, language), result.eligibility);
      setIdempotencyState(clearCheckoutIdempotencyKey());
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_CONFLICT' || TERMINAL_ERROR_CODES.has(error.code)) {
        setIdempotencyState(clearCheckoutIdempotencyKey());
        if (TERMINAL_ERROR_CODES.has(error.code)) {
          queryClient.invalidateQueries({ queryKey: paymentQueries.eligibility(candidateId, language) });
        }
      }
    },
  });

  const getCode = useCallback(() => {
    if (!session || mutation.isPending) return;

    const resolved = idempotencyState.key
      ? retryCheckoutAttempt(idempotencyState, randomCheckoutIdempotencyKey)
      : beginNewCheckoutAttempt(randomCheckoutIdempotencyKey);
    setIdempotencyState(resolved);
    mutation.mutate({ idempotencyKey: resolved.key as string, candidateIdAtCallTime: session.candidateId });
  }, [session, mutation, idempotencyState]);

  return { getCode, mutation };
}
