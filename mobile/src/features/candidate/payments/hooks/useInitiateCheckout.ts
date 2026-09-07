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
 * Unlike web, this also owns the hosted checkout page's visibility state:
 * rather than handing the candidate off to an external browser tab, the
 * caller renders `HostedCheckoutWebView` with `checkoutUrl`/`closeCheckout`
 * so the payment page stays embedded in the app. A native WebView isn't
 * subject to the browser-only X-Frame-Options/CSP frame-ancestors
 * mechanism a web `<iframe>` would be, so this works regardless of what
 * the payment provider sets.
 */
export function useInitiateCheckout() {
  const { session } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';
  const [idempotencyState, setIdempotencyState] = useState<CheckoutIdempotencyKeyState>(EMPTY_CHECKOUT_IDEMPOTENCY_KEY_STATE);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const mutation = useMutation<InitiateCheckoutResult, PaymentError, InitiateVariables>({
    mutationFn: ({ idempotencyKey, accessTokenAtCallTime }) => paymentsClient.initiateCheckout(accessTokenAtCallTime, idempotencyKey),
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.setQueryData(paymentQueries.eligibility(candidateId, language), result.eligibility);
      setIdempotencyState(clearCheckoutIdempotencyKey());

      const url = result.payment.checkoutUrl;
      if (url) setCheckoutUrl(url);
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

  // Called once the embedded checkout is dismissed, whichever way that
  // happens (candidate closes it, or navigation reaches our own return
  // endpoint) -- never trust that as success itself; only the subsequent
  // refetch of GET /candidate/payment can say what actually happened.
  const closeCheckout = useCallback(() => {
    setCheckoutUrl(null);
    queryClient.invalidateQueries({ queryKey: paymentQueries.eligibility(candidateId, language) });
  }, [queryClient, candidateId, language]);

  return { initiate, mutation, checkoutUrl, closeCheckout };
}
