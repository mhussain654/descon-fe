import { useEffect } from "react";
import { CheckCircle, XCircle, Clock, Ban } from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { usePaymentEligibility } from "../hooks/usePaymentEligibility";
import { useInitiateCheckout } from "../hooks/useInitiateCheckout";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  OfflineState,
  SessionExpiredState,
  ValidationMessage,
} from "../../../../design-system";
import { PAYMENT_ERROR_KEYS } from "../../../../../../shared/payments/errorMessages";
import { PAYMENT_BLOCKING_REASON_KEYS, PAYMENT_STATUS_KEYS, PAYMENT_STATUS_TONES } from "../../../../../../shared/payments/statusLabels";

const RETRYABLE_ERROR_CODES = new Set(["NETWORK_ERROR", "OFFLINE", "SERVER_ERROR", "RATE_LIMITED", "IDEMPOTENCY_IN_PROGRESS"]);

const STATUS_ICONS = {
  checkout_pending: Clock,
  paid: CheckCircle,
  failed: XCircle,
  cancelled: Ban,
  unknown: Clock,
};

export function PaymentPanel() {
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const eligibilityQuery = usePaymentEligibility();
  const checkout = useInitiateCheckout();

  const returnToSignIn = () => {
    logout("expired");
  };

  useEffect(() => {
    const code = checkout.mutation.error?.code;
    if (code === "SESSION_EXPIRED" || code === "INACTIVE_ACCOUNT") {
      returnToSignIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout.mutation.error]);

  // Never redirect via the SPA's own tab -- an in-memory-only session
  // would be lost the moment the browser navigates away to the hosted
  // checkout page and back. Opening a new tab keeps this tab's session
  // alive so it can keep polling for the authoritative outcome, matching
  // the ticket's own "backend payment status is authoritative, never a
  // redirect/URL param" requirement -- there is nothing in this tab that
  // ever trusts anything about what happens in the other one.
  useEffect(() => {
    const url = checkout.mutation.data?.payment.checkoutUrl;
    if (checkout.mutation.isSuccess && url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [checkout.mutation.isSuccess, checkout.mutation.data]);

  if (eligibilityQuery.isLoading) {
    return <LoadingState message={t("loading")} />;
  }

  const error = eligibilityQuery.error;
  if (error?.code === "SESSION_EXPIRED" || error?.code === "INACTIVE_ACCOUNT") {
    return (
      <SessionExpiredState
        title={t("dsSessionExpiredTitle")}
        description={t("dsSessionExpiredDescription")}
        actionLabel={t("dsSessionExpiredAction")}
        onAction={returnToSignIn}
      />
    );
  }
  if (error?.code === "FORBIDDEN") {
    return <ForbiddenState title={t("dsForbiddenTitle")} description={t(PAYMENT_ERROR_KEYS.FORBIDDEN)} />;
  }
  if (error?.code === "OFFLINE") {
    return (
      <OfflineState
        title={t("dsOfflineTitle")}
        description={t("dsOfflineDescription")}
        retryLabel={t("retry")}
        onRetry={() => eligibilityQuery.refetch()}
      />
    );
  }
  if (error) {
    return (
      <ErrorState message={t(PAYMENT_ERROR_KEYS[error.code])} retryLabel={t("retry")} onRetry={() => eligibilityQuery.refetch()} />
    );
  }

  const eligibility = eligibilityQuery.data;
  if (!eligibility) {
    return <ErrorState message={t("somethingWentWrong")} retryLabel={t("retry")} onRetry={() => eligibilityQuery.refetch()} />;
  }

  const payment = eligibility.latestPayment;
  const checkoutError = checkout.mutation.error;
  const canRetryCheckout = checkoutError && RETRYABLE_ERROR_CODES.has(checkoutError.code);
  const showPayAction =
    eligibility.checkoutAvailable && (!payment || payment.status === "failed" || payment.status === "cancelled");

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-1 text-sm text-gray-600">{t("paymentAmountLabel")}</div>
        <div className="text-2xl font-semibold text-black" dir="ltr">
          {eligibility.amount} {eligibility.currencyCode}
        </div>
      </div>

      {payment ? <LatestPaymentCard payment={payment} language={language} t={t} /> : null}

      {!eligibility.eligible ? (
        <EmptyState
          title={t("paymentNotEligibleTitle")}
          description={eligibility.blockingReasons.map((reason) => t(PAYMENT_BLOCKING_REASON_KEYS[reason])).join(" ")}
        />
      ) : null}

      {eligibility.eligible && !eligibility.checkoutAvailable ? (
        <ValidationMessage tone="error">{t("paymentProviderUnavailableError")}</ValidationMessage>
      ) : null}

      {showPayAction ? (
        <Button onClick={checkout.initiate} disabled={checkout.mutation.isPending} loading={checkout.mutation.isPending}>
          {t("paymentPayAction")}
        </Button>
      ) : null}

      {checkoutError && checkoutError.code !== "IDEMPOTENCY_CONFLICT" ? (
        <div>
          <ValidationMessage tone="error">{checkoutError.message || t(PAYMENT_ERROR_KEYS[checkoutError.code])}</ValidationMessage>
          {canRetryCheckout ? (
            <Button variant="text" size="sm" onClick={checkout.initiate} disabled={checkout.mutation.isPending}>
              {t("retry")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {payment?.status === "checkout_pending" ? (
        <div className="rounded-xl bg-[#FFF7E6] px-4 py-3 text-sm text-gray-700">{t("paymentWaitingForConfirmation")}</div>
      ) : null}
    </div>
  );
}

function LatestPaymentCard({ payment, language, t }) {
  const Icon = STATUS_ICONS[payment.status] ?? Clock;
  const tone = PAYMENT_STATUS_TONES[payment.status];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-black">{t("paymentLatestPaymentLabel")}</span>
        <Badge tone={tone}>{t(PAYMENT_STATUS_KEYS[payment.status])}</Badge>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-700">
        <Icon size={20} />
        <span dir="ltr">
          {payment.amount} {payment.currencyCode}
        </span>
      </div>
      {payment.status === "paid" && payment.paidAt ? (
        <div className="mt-2 text-xs text-gray-500">
          {t("paymentPaidAtLabel")}:{" "}
          <span dir="ltr">{new Date(payment.paidAt).toLocaleString(language === "ur" ? "ur-PK" : "en-GB")}</span>
        </div>
      ) : null}
    </div>
  );
}
