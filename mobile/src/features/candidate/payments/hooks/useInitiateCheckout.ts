import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
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

/** Mirrors web's useInitiateCheckout.ts's identical TERMINAL_ERROR_CODES exactly. */
const TERMINAL_ERROR_CODES = new Set<PaymentError['code']>(['NOT_ELIGIBLE', 'CHECKOUT_UNAVAILABLE']);

interface InitiateVariables {
  idempotencyKey: string;
  accessTokenAtCallTime: string;
}

/**
 * Owns checkout initiation's idempotency-key lifecycle and duplicate-tap
 * guard -- see web's useInitiateCheckout.ts for the full rationale, which
 * applies identically here.
 *
 * Unlike web, this mutation also owns opening the hosted checkout page
 * itself: `expo-web-browser`'s `openBrowserAsync` opens an in-app browser
 * (SFSafariViewController on iOS, a Custom Tab on Android) and its promise
 * resolves once the candidate dismisses it, at which point the caller
 * re-fetches eligibility -- the candidate's own secure-store-backed
 * session is never at risk here (unlike web's in-memory-only session), so
 * there is no need to open a separate tab/window to protect it.
 */
export function useInitiateCheckout() {
  const { session } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';
  const [idempotencyState, setIdempotencyState] = useState<CheckoutIdempotencyKeyState>(EMPTY_CHECKOUT_IDEMPOTENCY_KEY_STATE);

  const mutation = useMutation<InitiateCheckoutResult, PaymentError, InitiateVariables>({
    mutationFn: ({ idempotencyKey, accessTokenAtCallTime }) => paymentsClient.initiateCheckout(accessTokenAtCallTime, idempotencyKey),
    onSuccess: async (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.setQueryData(paymentQueries.eligibility(candidateId, language), result.eligibility);
      setIdempotencyState(clearCheckoutIdempotencyKey());

      const url = result.payment.checkoutUrl;
      if (!url) return;
      // Never trust the mere act of the browser closing as success --
      // dismissing it (back gesture, "Done", completing payment, or
      // abandoning it) all resolve the same way; only the subsequent
      // refetch of GET /candidate/payment can say what actually happened.
      await WebBrowser.openBrowserAsync(url);
      queryClient.invalidateQueries({ queryKey: paymentQueries.eligibility(candidateId, language) });
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

  const initiate = useCallback(() => {
    if (!session || mutation.isPending) return;

    const resolved = idempotencyState.key
      ? retryCheckoutAttempt(idempotencyState, randomCheckoutIdempotencyKey)
      : beginNewCheckoutAttempt(randomCheckoutIdempotencyKey);
    setIdempotencyState(resolved);
    mutation.mutate({ idempotencyKey: resolved.key as string, accessTokenAtCallTime: session.accessToken });
  }, [session, mutation, idempotencyState]);

  return { initiate, mutation };
}
