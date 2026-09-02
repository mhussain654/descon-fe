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

/**
 * Opens a blank tab synchronously, in the same call stack as the candidate's
 * click -- browsers only allow `window.open` unconditionally when it runs
 * directly inside a user-gesture handler, not after an awaited API response.
 * Passing `noopener`/`noreferrer` here would make `window.open` return
 * `null` (per spec), losing the handle this needs to navigate later once
 * the backend returns the checkout URL -- so instead this gets the same
 * protection (the new tab cannot reach back into this one via
 * `window.opener`) by nulling `opener` directly on the handle it keeps.
 */
function openProtectedBlankTab(): Window | null {
  const tab = window.open('', '_blank');
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      // Some browsers make `opener` non-configurable; the tab still has no
      // functional access back into this one without it.
    }
  }
  return tab;
}

interface InitiateVariables {
  idempotencyKey: string;
  accessTokenAtCallTime: string;
  /** The blank tab opened synchronously from the click, or null if the browser blocked it outright. Carried on the mutation variables (not a ref) so a stale/superseded attempt's result can never act on a newer attempt's tab. */
  checkoutTab: Window | null;
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
  // Set only when the pre-opened tab never made it to the checkout URL
  // (browser blocked it, or the candidate closed it while the request was
  // in flight) -- the candidate's own click on the resulting fallback
  // button is a fresh user gesture, so a plain window.open there is never
  // blocked.
  const [manualCheckoutUrl, setManualCheckoutUrl] = useState<string | null>(null);

  const mutation = useMutation<InitiateCheckoutResult, PaymentError, InitiateVariables>({
    mutationFn: ({ idempotencyKey, accessTokenAtCallTime }) => paymentsClient.initiateCheckout(accessTokenAtCallTime, idempotencyKey),
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) {
        variables.checkoutTab?.close();
        return;
      }

      queryClient.setQueryData(paymentQueries.eligibility(candidateId, language), result.eligibility);
      setIdempotencyState(clearCheckoutIdempotencyKey());

      const url = result.payment.checkoutUrl;
      const tab = variables.checkoutTab;
      if (!url) {
        setManualCheckoutUrl(null);
      } else if (tab && !tab.closed) {
        tab.location.href = url;
        setManualCheckoutUrl(null);
      } else {
        // Blocked outright (window.open returned null) or the candidate
        // closed it while the request was in flight -- never silently
        // drop the checkout URL the backend already committed to.
        setManualCheckoutUrl(url);
      }
    },
    onError: (error, variables) => {
      variables.checkoutTab?.close();
      setManualCheckoutUrl(null);

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

    setManualCheckoutUrl(null);
    // Opened synchronously, in this same click handler, before anything is
    // awaited -- see openProtectedBlankTab's own comment for why this
    // can't just pass noopener/noreferrer directly.
    const checkoutTab = openProtectedBlankTab();

    const resolved = idempotencyState.key
      ? retryCheckoutAttempt(idempotencyState, randomCheckoutIdempotencyKey)
      : beginNewCheckoutAttempt(randomCheckoutIdempotencyKey);
    setIdempotencyState(resolved);
    mutation.mutate({ idempotencyKey: resolved.key as string, accessTokenAtCallTime: session.accessToken, checkoutTab });
  }, [session, mutation, idempotencyState]);

  const openCheckoutManually = useCallback(() => {
    if (!manualCheckoutUrl) return;
    window.open(manualCheckoutUrl, '_blank', 'noopener,noreferrer');
    setManualCheckoutUrl(null);
  }, [manualCheckoutUrl]);

  return { initiate, mutation, manualCheckoutUrl, openCheckoutManually };
}
