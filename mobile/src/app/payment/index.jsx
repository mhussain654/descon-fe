import { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Banknote, CreditCard } from "lucide-react-native";
import { ButtonHeightContext } from "../../design-system/Button";
import { PaymentHeader, PaymentAmountCard, LatestPaymentCard, PaymentNotice, paymentStyles } from "../../features/candidate/payments/components/PaymentPresentation";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { usePaymentEligibility } from "../../features/candidate/payments/hooks/usePaymentEligibility";
import { useInitiateCheckout } from "../../features/candidate/payments/hooks/useInitiateCheckout";
import { useCreateVoucher } from "../../features/candidate/payments/hooks/useCreateVoucher";
import { PaymentMethodTabs, VoucherCodeCard } from "../../features/candidate/payments/components/VoucherPresentation";
import { HostedCheckoutWebView } from "../../features/candidate/payments/components/HostedCheckoutWebView";
import {
  Button,
  ErrorState,
  ForbiddenState,
  LoadingState,
  OfflineState,
  SessionExpiredState,
  ValidationMessage,
} from "../../design-system";
import { PAYMENT_ERROR_KEYS } from "../../../../shared/payments/errorMessages";
import {
  isCheckoutExpired,
  PAYMENT_BLOCKING_REASON_KEYS,
} from "../../../../shared/payments/statusLabels";
import {
  availablePaymentMethods,
  defaultPaymentMethod,
  openVoucherPayment,
} from "../../../../shared/payments/paymentMethods";

const RETRYABLE_ERROR_CODES = new Set(["NETWORK_ERROR", "OFFLINE", "SERVER_ERROR", "RATE_LIMITED", "IDEMPOTENCY_IN_PROGRESS"]);

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const eligibilityQuery = usePaymentEligibility();
  const checkout = useInitiateCheckout();
  const voucher = useCreateVoucher();
  const [chosenMethod, setChosenMethod] = useState(null);

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };


  const renderBody = () => {
    // isPending, not isLoading -- see documents/index.jsx for why a disabled
    // (auth still restoring) query needs this, not isLoading.
    if (eligibilityQuery.isPending) {
      return <LoadingState message={t("loading")} language={language} />;
    }

    const error = eligibilityQuery.error;
    if (error?.code === "SESSION_EXPIRED" || error?.code === "INACTIVE_ACCOUNT") {
      return (
        <SessionExpiredState
          title={t("dsSessionExpiredTitle")}
          description={t("dsSessionExpiredDescription")}
          actionLabel={t("dsSessionExpiredAction")}
          onAction={returnToSignIn}
          language={language}
        />
      );
    }
    if (error?.code === "FORBIDDEN") {
      return (
        <ForbiddenState title={t("dsForbiddenTitle")} description={t(PAYMENT_ERROR_KEYS.FORBIDDEN)} language={language} />
      );
    }
    if (error?.code === "OFFLINE") {
      return (
        <OfflineState
          title={t("dsOfflineTitle")}
          description={t("dsOfflineDescription")}
          retryLabel={t("retry")}
          onRetry={() => eligibilityQuery.refetch()}
          language={language}
        />
      );
    }
    if (error) {
      return (
        <ErrorState
          message={t(PAYMENT_ERROR_KEYS[error.code])}
          retryLabel={t("retry")}
          onRetry={() => eligibilityQuery.refetch()}
          language={language}
        />
      );
    }

    const eligibility = eligibilityQuery.data;
    if (!eligibility) {
      return (
        <ErrorState
          message={t("somethingWentWrong")}
          retryLabel={t("retry")}
          onRetry={() => eligibilityQuery.refetch()}
          language={language}
        />
      );
    }

    const payment = eligibility.latestPayment;
    const expired = payment ? isCheckoutExpired(payment.status, payment.checkoutExpiresAt) : false;
    // Once the fee is paid there is nothing left to pay, whatever else the screen would offer.
    const alreadyPaid = payment?.status === "paid";
    const methods = alreadyPaid ? [] : availablePaymentMethods(eligibility);
    const selectedMethod = chosenMethod && methods.includes(chosenMethod) ? chosenMethod : defaultPaymentMethod(eligibility);
    const openVoucher = openVoucherPayment(eligibility);
    const voucherExpired = payment?.provider === "kuickpay_voucher" && expired;
    const stillWaitingForCard = eligibility.cardCheckoutOpen;
    const checkoutError = checkout.mutation.error;
    const voucherError = voucher.mutation.error;
    const canRetryCheckout = checkoutError && RETRYABLE_ERROR_CODES.has(checkoutError.code);
    const showPayAction = eligibility.checkoutAvailable && !eligibility.cardCheckoutOpen;

    return (
      <View>
        <PaymentAmountCard amount={eligibility.amount} currencyCode={eligibility.currencyCode} language={language} t={t} />

        {payment && payment.id !== openVoucher?.id ? <LatestPaymentCard payment={payment} expired={expired} language={language} t={t} /> : null}

        {!eligibility.eligible ? (
          <PaymentNotice
            title={t("paymentNotEligibleTitle")}
            message={eligibility.blockingReasons.map((reason) => t(PAYMENT_BLOCKING_REASON_KEYS[reason])).join(" ")}
            language={language}
          />
        ) : null}

        {eligibility.eligible && !alreadyPaid && methods.length === 0 ? (
          <ValidationMessage tone="error" language={language}>
            {t("paymentProviderUnavailableError")}
          </ValidationMessage>
        ) : null}

        {eligibility.eligible && methods.length > 0 ? (
          <PaymentMethodTabs methods={methods} selected={selectedMethod} onSelect={setChosenMethod} language={language} t={t} />
        ) : null}

        {eligibility.eligible && selectedMethod === "voucher" && methods.includes("voucher") ? (
          <View>
            {openVoucher ? (
              <>
                <VoucherCodeCard voucher={openVoucher} language={language} t={t} />
                <PaymentNotice language={language} message={t("paymentVoucherWaiting")}>
                  <Button variant="outline" size="sm" onPress={() => eligibilityQuery.refetch()} disabled={eligibilityQuery.isFetching} language={language}>
                    {t("paymentManualRefreshAction")}
                  </Button>
                </PaymentNotice>
                <PaymentNotice language={language} message={t("paymentPayOnlyOneNotice")} />
              </>
            ) : (
              <>
                <PaymentNotice language={language} message={t("paymentVoucherIntro")} />
                {voucherExpired ? (
                  <ValidationMessage tone="error" language={language}>{t("paymentVoucherExpiredMessage")}</ValidationMessage>
                ) : null}
                {eligibility.cardCheckoutOpen ? <PaymentNotice language={language} message={t("paymentCodeWhileCardOpenNotice")} /> : null}
                {!eligibility.voucherAvailable ? (
                  <ValidationMessage tone="error" language={language}>{t("paymentVoucherUnavailableError")}</ValidationMessage>
                ) : null}
                {eligibility.voucherAvailable ? (
                  <Button
                    fullWidth
                    style={paymentStyles.pay}
                    leadingIcon={<Banknote size={16} color="#FFFFFF" />}
                    onPress={voucher.getCode}
                    disabled={voucher.mutation.isPending}
                    loading={voucher.mutation.isPending}
                    language={language}
                  >
                    {t(voucherExpired ? "paymentVoucherGetNewCodeAction" : "paymentVoucherGetCodeAction")}
                  </Button>
                ) : null}
              </>
            )}
            {voucherError && voucherError.code !== "IDEMPOTENCY_CONFLICT" ? (
              <View style={paymentStyles.error}>
                <ValidationMessage tone="error" language={language}>
                  {voucherError.message || t(PAYMENT_ERROR_KEYS[voucherError.code])}
                </ValidationMessage>
              </View>
            ) : null}
          </View>
        ) : null}

        {eligibility.eligible && selectedMethod === "card" && methods.includes("card") ? (
          <View>
            {openVoucher ? <PaymentNotice language={language} message={t("paymentCardWhileCodeOpenNotice")} /> : null}

            {showPayAction ? (
              <Button
                fullWidth
                style={paymentStyles.pay}
                leadingIcon={<CreditCard size={16} color="#FFFFFF" />}
                onPress={checkout.initiate}
                disabled={checkout.mutation.isPending}
                loading={checkout.mutation.isPending}
                language={language}
              >
                {t("paymentPayAction")}
              </Button>
            ) : null}

            {checkoutError && checkoutError.code !== "IDEMPOTENCY_CONFLICT" ? (
              <View style={paymentStyles.error}>
                <ValidationMessage tone="error" language={language}>
                  {checkoutError.message || t(PAYMENT_ERROR_KEYS[checkoutError.code])}
                </ValidationMessage>
                {canRetryCheckout ? (
                  <Button variant="text" size="sm" onPress={checkout.initiate} disabled={checkout.mutation.isPending} language={language}>
                    {t("retry")}
                  </Button>
                ) : null}
              </View>
            ) : null}

            {stillWaitingForCard ? (
              <PaymentNotice language={language} message={t(eligibilityQuery.pollingTimedOut ? "paymentPollingTimedOutMessage" : "paymentWaitingForConfirmation")}>
                {eligibilityQuery.pollingTimedOut ? (
                  <Button variant="outline" size="sm" onPress={() => eligibilityQuery.refetch()} disabled={eligibilityQuery.isFetching} language={language}>
                    {t("paymentManualRefreshAction")}
                  </Button>
                ) : null}
              </PaymentNotice>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ButtonHeightContext.Provider value={34}>
      <View style={paymentStyles.screen}>
        <StatusBar style="light" />
        <PaymentHeader language={language} t={t} topInset={insets.top} onBack={() => router.back()} />
        <ScrollView
          style={paymentStyles.scroll}
          contentContainerStyle={[paymentStyles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={eligibilityQuery.isRefetching} onRefresh={() => eligibilityQuery.refetch()} title={t("pullToRefresh")} />}
        >
          {renderBody()}
        </ScrollView>

        <HostedCheckoutWebView
          url={checkout.checkoutUrl}
          onClose={checkout.closeCheckout}
          closeLabel={t("dsClose")}
          loadingLabel={t("loading")}
          blockedMessage={t("paymentCheckoutNavigationBlocked")}
          language={language}
        />
      </View>
    </ButtonHeightContext.Provider>
  );
}
