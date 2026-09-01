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

/** Error codes the candidate can only resolve by something changing elsewhere (eligibility lost, provider down) -- retrying the same key would just replay the same doomed outcome, so these mint a fresh key on the next attempt rather than reusing this one. */
const TERMINAL_ERROR_CODES = new Set<PaymentError['code']>(['NOT_ELIGIBLE', 'CHECKOUT_UNAVAILABLE']);

interface InitiateVariables {
  idempotencyKey: string;
  accessTokenAtCallTime: string;
}

/**
 * Owns the checkout-initiation mutation's idempotency-key lifecycle
 * (ticket: "a unique idempotency key for each intentional attempt") and
 * duplicate-click guard, mirroring useSubmitDocuments.ts's identical
 * pattern for the same reason: the request body is always empty, so there
 * is nothing to compare between attempts -- only "is this a retry of the
 * current attempt, or a fresh intentional one?"
 */
export function useInitiateCheckout() {
  const { session } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';
  const [idempotencyState, setIdempotencyState] = useState<CheckoutIdempotencyKeyState>(EMPTY_CHECKOUT_IDEMPOTENCY_KEY_STATE);

  const mutation = useMutation<InitiateCheckoutResult, PaymentError, InitiateVariables>({
    mutationFn: ({ idempotencyKey, accessTokenAtCallTime }) => paymentsClient.initiateCheckout(accessTokenAtCallTime, idempotencyKey),
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

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
      // RATE_LIMITED/NETWORK_ERROR/OFFLINE/SERVER_ERROR/IDEMPOTENCY_IN_PROGRESS:
      // keep the same key so a manual retry replays safely.
    },
  });

  const initiate = useCallback(() => {
    // Guards double-click/concurrent initiation (ticket: "Disable repeated
    // clicks while initiation is processing.") -- disabling the button
    // while pending covers the UI, this covers a caller bypassing it.
    if (!session || mutation.isPending) return;

    const resolved = idempotencyState.key
      ? retryCheckoutAttempt(idempotencyState, randomCheckoutIdempotencyKey)
      : beginNewCheckoutAttempt(randomCheckoutIdempotencyKey);
    setIdempotencyState(resolved);
    mutation.mutate({ idempotencyKey: resolved.key as string, accessTokenAtCallTime: session.accessToken });
  }, [session, mutation, idempotencyState]);

  return { initiate, mutation };
}
