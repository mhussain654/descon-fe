import { useCallback, useRef, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Linking, StyleSheet, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { BarChart3, FileText, GraduationCap, Headphones } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { useCandidateProfile } from "../../../features/candidate/profile/hooks/useCandidateProfile";
import { useCandidateDocuments } from "../../../features/candidate/documents/hooks/useCandidateDocuments";
import { useApplicationProgress } from "../../../features/candidate/progress/hooks/useApplicationProgress";
import { useTrainingSetting } from "../../../features/candidate/training/hooks/useTrainingSetting";
import { useSupportSetting } from "../../../features/candidate/support/hooks/useSupportSetting";
import { useCandidateWorkflowHistory } from "../../../features/candidate/workflow/hooks/useCandidateWorkflowHistory";
import { HomeHeader } from "../../../features/candidate/home/HomeHeader";
import { ApplicationProgressCard } from "../../../features/candidate/home/ApplicationProgressCard";
import { NextStepCard } from "../../../features/candidate/home/NextStepCard";
import { QuickActionTile } from "../../../features/candidate/home/QuickActionTile";
import { LatestUpdateCard } from "../../../features/candidate/home/LatestUpdateCard";
import { forwardArrowSlots } from "../../../features/onboarding/directionalArrows";
import { resolveDocumentAccessUrl } from "../../../lib/resolveDocumentAccessUrl";
import { rowDirectionTowards } from "../../../lib/layoutDirection";
import { latestActionableUpdate, STAGE_UPDATE_DESCRIPTION_KEYS, STAGE_UPDATE_FALLBACK_KEY } from "../../../../../shared/candidateWorkflow/latestUpdate";
import { interpolate } from "../../../../../shared/i18n/interpolate";
import { formatCurrency, formatDate } from "../../../../../shared/i18n/locale";
import { resolveNextAction, NEXT_ACTION_KEYS } from "../../../../../shared/applicationProgress/nextAction";
import { currentDashboardStage, upcomingDashboardStage } from "../../../../../shared/applicationProgress/currentDashboardStage";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState, getFontFamily, toast } from "../../../design-system";
import { colors, spacing } from "../../../design-system/tokens";

// Where tapping "Next Steps" (and, correspondingly, which Quick Action tile
// gets highlighted as the candidate's current one) should navigate to, per
// `NextActionKind`. Every document-related kind goes to Documents; `pay_fee`
// (nextAction.ts's own dedicated kind for the fee_pending stage) goes to
// Payment; every other stage falls back to Status, since those are
// staff/system-driven waits with no dedicated screen of their own.
function resolveNextActionRoute(nextActionKind) {
  switch (nextActionKind) {
    case "rejected_replaceable":
    case "no_documents_uploaded":
    case "missing_required":
    case "expired_pcc_replaceable":
    case "ready_to_submit":
      return "/(tabs)/documents";
    case "pay_fee":
      return "/payment";
    case "workflow_stage":
    case "awaiting_review":
    case "verified":
    default:
      return "/(tabs)/status";
  }
}
// Which next-step card the home screen shows for a `NextActionKind`: the fee
// gets its own payment card, document problems a documents card, and every
// staff/system-driven wait a calm "what happens next" card.
function nextStepVariant(nextActionKind) {
  const route = resolveNextActionRoute(nextActionKind);
  if (route === "/payment") return "payment";
  if (route === "/(tabs)/documents") return "documents";
  return "waiting";
}

function greetingKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "greetingMorning";
  if (hour < 17) return "greetingAfternoon";
  return "greetingEvening";
}

import { CANDIDATE_PROFILE_ERROR_KEYS } from "../../../../../shared/candidateProfile/errorMessages";
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from "../../../../../shared/candidateDocuments/errorMessages";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../../shared/applicationProgress/errorMessages";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const profileQuery = useCandidateProfile();
  const checklistQuery = useCandidateDocuments();
  const progressQuery = useApplicationProgress();
  // Deliberately not part of `isLoading`/`primaryError` below -- the
  // Training quick action opens an external link directly (no intermediate
  // screen), so a slow or failed fetch of that one link should never block
  // the rest of the dashboard from rendering. The tile itself just stays
  // disabled until the URL is available.
  const trainingQuery = useTrainingSetting();
  // Like Training, neither blocks the screen: a missing support number just
  // disables its tile, and the latest-update card has its own empty state.
  const supportQuery = useSupportSetting();
  const historyQuery = useCandidateWorkflowHistory();
  useRefetchOnFocus(profileQuery.refetch, profileQuery.isFetching);
  useRefetchOnFocus(checklistQuery.refetch, checklistQuery.isFetching);
  useRefetchOnFocus(progressQuery.refetch, progressQuery.isFetching);
  useRefetchOnFocus(historyQuery.refetch, historyQuery.isFetching);

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  // `isRefreshing` state alone isn't a reliable re-entry guard: two calls to
  // `handleRefresh` that both start before React commits the first
  // `setIsRefreshing(true)` would both close over the same stale `false` and
  // both proceed. A ref is read/written synchronously, so the second call
  // always sees the first call's lock regardless of render timing.
  const isRefreshingRef = useRef(false);
  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.all([
        profileQuery.refetch(),
        checklistQuery.refetch(),
        progressQuery.refetch(),
        historyQuery.refetch(),
      ]);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [profileQuery.refetch, checklistQuery.refetch, progressQuery.refetch, historyQuery.refetch]);

  // Dashboard composes 3 independent queries (profile, checklist, progress)
  // -- a SESSION_EXPIRED/INACTIVE_ACCOUNT from *any* of them must win over a
  // merely transient error (offline/network/server) from another, or the
  // candidate would see a "Retry" button instead of the screen that actually
  // ends/protects an invalid session. Only once no source query reports a
  // session-ending error do we fall back to picking the first real error in
  // priority order (profile identity first, since nothing else can render
  // meaningfully without it), matching Documents/Status/Profile's own
  // per-query dedicated states instead of silently leaving the header blank
  // or the status card stuck at "0%" (indistinguishable from valid empty
  // data).
  const errorSources = [
    { error: profileQuery.error, keys: CANDIDATE_PROFILE_ERROR_KEYS },
    { error: checklistQuery.error, keys: CANDIDATE_DOCUMENTS_ERROR_KEYS },
    { error: progressQuery.error, keys: APPLICATION_PROGRESS_ERROR_KEYS },
  ];
  const primarySource =
    errorSources.find((source) => source.error?.code === "SESSION_EXPIRED" || source.error?.code === "INACTIVE_ACCOUNT") ??
    errorSources.find((source) => source.error);
  const primaryError = primarySource?.error ?? null;
  const primaryErrorKeys = primarySource?.keys ?? CANDIDATE_PROFILE_ERROR_KEYS;
  // `isPending`, not `isLoading` -- a query disabled while auth is still
  // restoring has `isLoading: false` (v5: isLoading = isPending &&
  // isFetching, never true while disabled) but is just as "no data yet" as
  // one that's actively fetching. Gating on `isLoading` alone let that brief
  // disabled window fall through past this check with stale/undefined data.
  const isLoading = profileQuery.isPending || checklistQuery.isPending || progressQuery.isPending;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <LoadingState message={t("loading")} language={language} />
      </View>
    );
  }
  if (primaryError?.code === "SESSION_EXPIRED") {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <SessionExpiredState
          title={t("dsSessionExpiredTitle")}
          description={t("dsSessionExpiredDescription")}
          actionLabel={t("dsSessionExpiredAction")}
          onAction={returnToSignIn}
          language={language}
        />
      </View>
    );
  }
  if (primaryError?.code === "INACTIVE_ACCOUNT") {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ForbiddenState
          title={t("candidateProfileInactiveAccountTitle")}
          description={t("candidateProfileInactiveAccountDescription")}
          actionLabel={t("candidateProfileInactiveAccountAction")}
          onAction={returnToSignIn}
          language={language}
        />
      </View>
    );
  }
  if (primaryError?.code === "OFFLINE") {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <OfflineState
          title={t("dsOfflineTitle")}
          description={t("dsOfflineDescription")}
          retryLabel={t("retry")}
          onRetry={handleRefresh}
          language={language}
        />
      </View>
    );
  }
  if (primaryError) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ErrorState message={t(primaryErrorKeys[primaryError.code])} retryLabel={t("retry")} onRetry={handleRefresh} language={language} />
      </View>
    );
  }
  if (!profileQuery.data || !progressQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ErrorState message={t("somethingWentWrong")} retryLabel={t("retry")} onRetry={handleRefresh} language={language} />
      </View>
    );
  }

  const profile = profileQuery.data;
  const workflow = progressQuery.data?.workflow;
  const isUrdu = language === "ur";
  // The real, backend-authoritative workflow (MPS-501) -- `currentWorkflowStage`
  // is a separate, HR-advanced pipeline position that can legitimately lag
  // behind it, so summarizing "current status" here from the same timeline
  // Status renders keeps the two screens telling the same story.
  const currentStage = workflow ? currentDashboardStage(workflow.timeline) : null;
  // What the next-step card announces when the next move is on staff's side:
  // the upcoming stage, never the current one (that's the badge above and
  // the latest update below), so the three never repeat each other.
  const upcomingStage = workflow ? upcomingDashboardStage(workflow.timeline) : null;
  const percentage = workflow?.progressPercentage ?? 0;
  const nextAction =
    progressQuery.data && checklistQuery.data ? resolveNextAction(progressQuery.data, checklistQuery.data) : null;
  const nextActionMessage = nextAction
    ? `${t(NEXT_ACTION_KEYS[nextAction.kind])}${nextAction.requirementName ? `: ${nextAction.requirementName}` : ""}`
    : t("waitingForVerification");
  const variant = nextAction ? nextStepVariant(nextAction.kind) : "waiting";
  const nextStep = {
    payment: {
      title: t("homePayFeeTitle"),
      description: t("homePayFeeDescription"),
      amountText: profile.payment?.amount
        ? formatCurrency(Number(profile.payment.amount), language, profile.payment.currencyCode || "PKR")
        : undefined,
      actionLabel: t("homePayNow"),
      route: "/payment",
    },
    documents: {
      title: nextActionMessage,
      description: t("homeDocumentsActionDescription"),
      actionLabel: t("homeGoToDocuments"),
      route: "/(tabs)/documents",
    },
    waiting: {
      title: upcomingStage ? upcomingStage.name : t("homeJourneyCompleteTitle"),
      description: upcomingStage ? t("homeWaitingDescription") : t("homeJourneyCompleteDescription"),
      actionLabel: t("homeViewStatus"),
      route: "/(tabs)/status",
    },
  }[variant];
  const forwardArrow = forwardArrowSlots(language, colors.brand.on, 15);

  const latest = latestActionableUpdate(historyQuery.data?.items ?? []);
  const latestUpdate = latest
    ? {
        title: latest.toStage.name,
        description: t(STAGE_UPDATE_DESCRIPTION_KEYS[latest.toStage.code] ?? STAGE_UPDATE_FALLBACK_KEY),
        dateLabel: formatDate(latest.occurredAt, language),
      }
    : null;

  const photoUri = profile.photoUrl
    ? resolveDocumentAccessUrl(profile.photoUrl, process.env.EXPO_PUBLIC_API_BASE_URL ?? "") || null
    : null;
  const supportPhone = supportQuery.data?.phoneNumber ?? null;
  const trainingUrl = trainingQuery.data?.url ?? null;
  const tileRowDirection = rowDirectionTowards(isUrdu ? "right" : "left");

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* Soft multi-tone wash behind the cards, as in the approved design. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="homeBackdrop" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#EEF8FF" />
            <Stop offset="0.48" stopColor="#FFF8EE" />
            <Stop offset="1" stopColor="#F3F7FF" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeBackdrop)" />
      </Svg>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing[6] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} title={t("pullToRefresh")} />
        }
      >
        <HomeHeader
          language={language}
          topInset={insets.top}
          greeting={t(greetingKey())}
          fullName={profile.fullName}
          referenceLine={
            profile.referenceNumber
              ? interpolate(t("homeReference"), { reference: profile.referenceNumber })
              : t("candidateProfileNotAssignedYet")
          }
          photoUri={photoUri}
          photoLabel={t("homeProfilePhoto")}
          country={profile.country}
        />

        <View style={styles.content}>
          <ApplicationProgressCard
            language={language}
            title={t("homeMyJourney")}
            stageLabel={currentStage ? currentStage.name : null}
            stepsLine={interpolate(t("homeStepsComplete"), {
              completed: workflow?.completedCount ?? 0,
              total: workflow?.totalCount ?? 0,
            })}
            percentLine={interpolate(t("homePercentComplete"), { percent: percentage })}
            percentage={percentage}
          />

          <NextStepCard
            language={language}
            variant={variant}
            eyebrow={t("homeNextStepLabel")}
            title={nextStep.title}
            description={nextStep.description}
            amountText={nextStep.amountText}
            actionLabel={nextStep.actionLabel}
            onAction={() => router.push(nextStep.route)}
            leadingIcon={forwardArrow.leadingIcon}
            trailingIcon={forwardArrow.trailingIcon}
          />

          <View>
            <Text style={[styles.sectionTitle, isUrdu && styles.sectionTitleUrdu, { fontFamily: getFontFamily(language, "bold") }]}>
              {t("homeQuickActions")}
            </Text>
            <View style={styles.tileGrid}>
              <View style={[styles.tileRow, { flexDirection: tileRowDirection }]}>
                <QuickActionTile
                  language={language}
                  tone="blue"
                  icon={FileText}
                  title={t("homeQuickDocumentsTitle")}
                  subtitle={t("homeQuickDocumentsSubtitle")}
                  onPress={() => router.push("/(tabs)/documents")}
                />
                <QuickActionTile
                  language={language}
                  tone="green"
                  icon={BarChart3}
                  title={t("homeQuickStatusTitle")}
                  subtitle={t("homeQuickStatusSubtitle")}
                  onPress={() => router.push("/(tabs)/status")}
                />
              </View>
              <View style={[styles.tileRow, { flexDirection: tileRowDirection }]}>
                <QuickActionTile
                  language={language}
                  tone="purple"
                  icon={GraduationCap}
                  title={t("homeQuickTrainingTitle")}
                  subtitle={t("homeQuickTrainingSubtitle")}
                  onPress={() => trainingUrl && Linking.openURL(trainingUrl)}
                  disabled={!trainingUrl}
                />
                <QuickActionTile
                  language={language}
                  tone="coral"
                  icon={Headphones}
                  title={t("homeQuickSupportTitle")}
                  subtitle={t("homeQuickSupportSubtitle")}
                  // Always shown at full strength -- a washed-out tile reads as
                  // broken. Until staff set a number, a tap explains instead.
                  onPress={() =>
                    supportPhone ? Linking.openURL(`tel:${supportPhone}`) : toast.info(t("homeSupportUnavailable"))
                  }
                />
              </View>
            </View>
          </View>

          <LatestUpdateCard
            language={language}
            heading={t("homeLatestUpdate")}
            seeAllLabel={t("homeSeeAll")}
            onSeeAll={() => router.push("/(tabs)/status")}
            update={latestUpdate}
            emptyMessage={t("homeNoUpdatesYet")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F7FF" },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { paddingHorizontal: 14, paddingTop: 14, gap: 12 },
  sectionTitle: { marginBottom: spacing[2], paddingHorizontal: 2, fontSize: 16, fontWeight: "800", color: colors.text.primary },
  sectionTitleUrdu: { lineHeight: 34 },
  tileGrid: { gap: spacing[2] },
  tileRow: { gap: spacing[2] },
});
