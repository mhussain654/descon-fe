import { View, Text, ScrollView, RefreshControl, Pressable, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Clock, Ban } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { usePaymentEligibility } from "../../features/candidate/payments/hooks/usePaymentEligibility";
import { useInitiateCheckout } from "../../features/candidate/payments/hooks/useInitiateCheckout";
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
} from "../../design-system";
import { PAYMENT_ERROR_KEYS } from "../../../../shared/payments/errorMessages";
import {
  isCheckoutExpired,
  PAYMENT_BLOCKING_REASON_KEYS,
  PAYMENT_STATUS_KEYS,
  PAYMENT_STATUS_TONES,
} from "../../../../shared/payments/statusLabels";

const RETRYABLE_ERROR_CODES = new Set(["NETWORK_ERROR", "OFFLINE", "SERVER_ERROR", "RATE_LIMITED", "IDEMPOTENCY_IN_PROGRESS"]);

const STATUS_ICONS = {
  checkout_pending: Clock,
  paid: CheckCircle,
  failed: XCircle,
  cancelled: Ban,
  expired: XCircle,
  unknown: Clock,
};

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const eligibilityQuery = usePaymentEligibility();
  const checkout = useInitiateCheckout();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  if (!fontsLoaded) {
    return null;
  }

  const BackIcon = language === "ur" ? ArrowRight : ArrowLeft;

  const renderBody = () => {
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
    const expired = payment ? isCheckoutExpired(payment.status, payment.checkoutExpiresAt) : false;
    const stillWaiting = payment?.status === "checkout_pending" && !expired;
    const checkoutError = checkout.mutation.error;
    const canRetryCheckout = checkoutError && RETRYABLE_ERROR_CODES.has(checkoutError.code);
    const showPayAction =
      eligibility.checkoutAvailable && (!payment || payment.status === "failed" || payment.status === "cancelled" || expired);

    return (
      <View>
        <View
          style={{
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
            borderWidth: 1,
            borderColor: isDark ? "#333333" : "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280", marginBottom: 4 }}>
            {t("paymentAmountLabel")}
          </Text>
          <Text style={{ fontSize: 24, fontFamily: "Inter_600SemiBold", color: isDark ? "#FFFFFF" : "#000000" }}>
            {eligibility.amount} {eligibility.currencyCode}
          </Text>
        </View>

        {payment ? <LatestPaymentCard payment={payment} expired={expired} isDark={isDark} language={language} t={t} /> : null}

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
          <Button onPress={checkout.initiate} disabled={checkout.mutation.isPending} loading={checkout.mutation.isPending}>
            {t("paymentPayAction")}
          </Button>
        ) : null}

        {checkoutError && checkoutError.code !== "IDEMPOTENCY_CONFLICT" ? (
          <View style={{ marginTop: 12 }}>
            <ValidationMessage tone="error">{checkoutError.message || t(PAYMENT_ERROR_KEYS[checkoutError.code])}</ValidationMessage>
            {canRetryCheckout ? (
              <Button variant="text" size="sm" onPress={checkout.initiate} disabled={checkout.mutation.isPending}>
                {t("retry")}
              </Button>
            ) : null}
          </View>
        ) : null}

        {stillWaiting && !eligibilityQuery.pollingTimedOut ? (
          <View style={{ marginTop: 12, borderRadius: 12, padding: 14, backgroundColor: isDark ? "#2E2416" : "#FFF7E6" }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: isDark ? "#FFFFFF" : "#374151" }}>
              {t("paymentWaitingForConfirmation")}
            </Text>
          </View>
        ) : null}

        {stillWaiting && eligibilityQuery.pollingTimedOut ? (
          <View style={{ marginTop: 12, borderRadius: 12, padding: 14, backgroundColor: isDark ? "#2E2416" : "#FFF7E6" }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: isDark ? "#FFFFFF" : "#374151", marginBottom: 10 }}>
              {t("paymentPollingTimedOutMessage")}
            </Text>
            <Button variant="outline" size="sm" onPress={() => eligibilityQuery.refetch()} disabled={eligibilityQuery.isFetching}>
              {t("paymentManualRefreshAction")}
            </Button>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: isDark ? "#121212" : "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#333333" : "#F0F0F0",
        }}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("back")} hitSlop={12}>
          <BackIcon size={24} color={isDark ? "#FFFFFF" : "#000000"} />
        </Pressable>
        <Text
          style={{
            fontSize: 22,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#FFFFFF" : "#000000",
            marginStart: 12,
          }}
        >
          {t("makePayment")}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={eligibilityQuery.isRefetching} onRefresh={() => eligibilityQuery.refetch()} title={t("pullToRefresh")} />
        }
      >
        {renderBody()}
      </ScrollView>
    </View>
  );
}

function LatestPaymentCard({ payment, expired, isDark, language, t }) {
  const displayStatus = expired ? "expired" : payment.status;
  const Icon = STATUS_ICONS[displayStatus] ?? Clock;
  const tone = expired ? "danger" : PAYMENT_STATUS_TONES[payment.status];
  const statusLabelKey = expired ? "paymentStatusExpired" : PAYMENT_STATUS_KEYS[payment.status];

  return (
    <View
      style={{
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
        borderWidth: 1,
        borderColor: isDark ? "#333333" : "#E5E7EB",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: isDark ? "#FFFFFF" : "#000000" }}>
          {t("paymentLatestPaymentLabel")}
        </Text>
        <Badge tone={tone}>{t(statusLabelKey)}</Badge>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon size={20} color={isDark ? "#9CA3AF" : "#6B7280"} />
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: isDark ? "#D1D5DB" : "#374151" }}>
          {payment.amount} {payment.currencyCode}
        </Text>
      </View>
      {displayStatus === "paid" && payment.paidAt ? (
        <Text style={{ marginTop: 8, fontSize: 12, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
          {t("paymentPaidAtLabel")}: {new Date(payment.paidAt).toLocaleString(language === "ur" ? "ur-PK" : "en-GB")}
        </Text>
      ) : null}
      {displayStatus === "paid" ? (
        <Text style={{ marginTop: 4, fontSize: 12, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
          {t("paymentReferenceLabel")}: {payment.id}
        </Text>
      ) : null}
    </View>
  );
}
