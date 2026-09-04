import { View, Text, ScrollView, RefreshControl, TouchableOpacity, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CheckCircle, Circle, Clock } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useRouter } from "expo-router";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { useApplicationProgress } from "../../../features/candidate/progress/hooks/useApplicationProgress";
import { useCandidateWorkflowHistory } from "../../../features/candidate/workflow/hooks/useCandidateWorkflowHistory";
import { useCandidateFlightDetail } from "../../../features/candidate/workflow/hooks/useCandidateFlightDetail";
import { useFlightTicketAccess } from "../../../features/candidate/workflow/hooks/useFlightTicketAccess";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState, Button, ValidationMessage } from "../../../design-system";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../../shared/applicationProgress/errorMessages";
import { WORKFLOW_HISTORY_ERROR_KEYS } from "../../../../../shared/candidateWorkflow/errorMessages";
import { findLatestQvcOutcome, QVC_OUTCOME_KEYS, QVC_OUTCOME_TONES } from "../../../../../shared/candidateWorkflow/qvcOutcome";
import { CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS } from "../../../../../shared/candidateFlightDetail/errorMessages";

const QVC_OUTCOME_STAGE_CODE = "qvc_completed_outcome_received";
const FLIGHT_TICKET_STAGE_CODES = new Set(["flight_details_uploaded", "mobilized"]);

const QVC_TONE_COLORS = {
  success: { bg: "#E6F9F0", text: "#10B981" },
  warning: { bg: "#FFF7E6", text: "#F59E0B" },
  danger: { bg: "#FEF2F2", text: "#EF4444" },
};

function formatStageDate(iso, language) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(language === "ur" ? "ur-PK" : "en-GB");
}

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const progressQuery = useApplicationProgress();
  const historyQuery = useCandidateWorkflowHistory();
  const flightDetailQuery = useCandidateFlightDetail();
  const ticketAccess = useFlightTicketAccess();
  useRefetchOnFocus(progressQuery.refetch, progressQuery.isFetching);
  useRefetchOnFocus(historyQuery.refetch, historyQuery.isFetching);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "completed":
        return {
          icon: CheckCircle,
          iconColor: "#10B981",
          lineColor: "#10B981",
          textColor: isDark ? "#FFFFFF" : "#000000",
        };
      case "current":
        return {
          icon: Clock,
          iconColor: "#0066CC",
          lineColor: "#E5E7EB",
          textColor: isDark ? "#FFFFFF" : "#000000",
        };
      default:
        return {
          icon: Circle,
          iconColor: isDark ? "#4B5563" : "#D1D5DB",
          lineColor: isDark ? "#333333" : "#E5E7EB",
          textColor: isDark ? "#6B7280" : "#9CA3AF",
        };
    }
  };

  const workflow = progressQuery.data?.workflow;
  const timeline = workflow?.timeline ?? [];
  const qvcOutcome = findLatestQvcOutcome(historyQuery.data?.items ?? []);
  const historyItems = historyQuery.data?.items ?? [];
  const lastUpdatedLabel = workflow ? formatStageDate(workflow.updatedAt, language) : null;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: isDark ? "#121212" : "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#333333" : "#F0F0F0",
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#FFFFFF" : "#000000",
            marginBottom: 4,
          }}
        >
          {t("status")}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: isDark ? "#9CA3AF" : "#6B7280",
          }}
        >
          {t("mobilizationProgress")}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: insets.bottom + 80,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={progressQuery.isRefetching || historyQuery.isRefetching}
            onRefresh={() => {
              progressQuery.refetch();
              historyQuery.refetch();
            }}
            title={t("pullToRefresh")}
          />
        }
      >
        {progressQuery.isLoading ? <LoadingState message={t("loading")} /> : null}

        {progressQuery.error?.code === "SESSION_EXPIRED" ? (
          <SessionExpiredState
            title={t("dsSessionExpiredTitle")}
            description={t("dsSessionExpiredDescription")}
            actionLabel={t("dsSessionExpiredAction")}
            onAction={returnToSignIn}
          />
        ) : null}

        {progressQuery.error?.code === "INACTIVE_ACCOUNT" ? (
          <ForbiddenState
            title={t("candidateProfileInactiveAccountTitle")}
            description={t("candidateProfileInactiveAccountDescription")}
            actionLabel={t("candidateProfileInactiveAccountAction")}
            onAction={returnToSignIn}
          />
        ) : null}

        {progressQuery.error?.code === "OFFLINE" ? (
          <OfflineState
            title={t("dsOfflineTitle")}
            description={t("dsOfflineDescription")}
            retryLabel={t("retry")}
            onRetry={() => progressQuery.refetch()}
          />
        ) : null}

        {progressQuery.error && !["OFFLINE", "SESSION_EXPIRED", "INACTIVE_ACCOUNT"].includes(progressQuery.error.code) ? (
          <ErrorState
            message={t(APPLICATION_PROGRESS_ERROR_KEYS[progressQuery.error.code])}
            retryLabel={t("retry")}
            onRetry={() => progressQuery.refetch()}
          />
        ) : null}

        {!progressQuery.isLoading && !progressQuery.error && timeline.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
              {t("workflowStagesCompletedPrefix")}: {workflow.completedCount}/{workflow.totalCount}
            </Text>
            {lastUpdatedLabel ? (
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
                {t("workflowLastUpdatedPrefix")}: {lastUpdatedLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Timeline */}
        {!progressQuery.isLoading && !progressQuery.error && timeline.length > 0 ? (
          <View>
            {timeline.map((stage, index) => {
              const config = getStatusConfig(stage.status);
              const StatusIcon = config.icon;
              const isLast = index === timeline.length - 1;
              const startedLabel = formatStageDate(stage.startedAt, language);
              const completedLabel = formatStageDate(stage.completedAt, language);
              const outcomeTone = qvcOutcome ? QVC_TONE_COLORS[QVC_OUTCOME_TONES[qvcOutcome.code]] : null;

              return (
                <View key={stage.code} style={{ flexDirection: "row" }}>
                  {/* Icon Column */}
                  <View style={{ alignItems: "center", marginEnd: 16 }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor:
                          stage.status === "current"
                            ? isDark
                              ? "#1A2B3D"
                              : "#E6F2FF"
                            : isDark
                              ? "#1E1E1E"
                              : "#FFFFFF",
                        borderWidth: stage.status === "pending" ? 2 : 0,
                        borderColor: isDark ? "#333333" : "#E5E7EB",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <StatusIcon
                        size={stage.status === "pending" ? 12 : 18}
                        color={config.iconColor}
                        fill={stage.status === "completed" ? config.iconColor : "none"}
                      />
                    </View>

                    {!isLast && (
                      <View
                        style={{
                          width: 2,
                          flex: 1,
                          backgroundColor: config.lineColor,
                          marginVertical: 4,
                          minHeight: 40,
                        }}
                      />
                    )}
                  </View>

                  {/* Content Column */}
                  <View
                    style={{
                      flex: 1,
                      paddingBottom: isLast ? 0 : 24,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: stage.status === "current" ? "Inter_600SemiBold" : "Inter_500Medium",
                        color: config.textColor,
                        marginBottom: 2,
                      }}
                    >
                      {stage.name}
                    </Text>
                    {completedLabel ? (
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
                        {t("workflowStageCompletedPrefix")} {completedLabel}
                      </Text>
                    ) : startedLabel ? (
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
                        {t("workflowStageStartedPrefix")} {startedLabel}
                      </Text>
                    ) : null}
                    {stage.status === "current" && (
                      <View
                        style={{
                          backgroundColor: isDark ? "#1A2B3D" : "#E6F2FF",
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          marginTop: 8,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#0066CC" }}>{t("inProgress")}</Text>
                      </View>
                    )}
                    {stage.code === QVC_OUTCOME_STAGE_CODE && qvcOutcome ? (
                      <View
                        style={{
                          backgroundColor: outcomeTone.bg,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          marginTop: 8,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: outcomeTone.text }}>
                          {t("qvcOutcome")}: {t(QVC_OUTCOME_KEYS[qvcOutcome.code])}
                          {formatStageDate(qvcOutcome.date, language) ? ` • ${formatStageDate(qvcOutcome.date, language)}` : ""}
                        </Text>
                      </View>
                    ) : null}
                    {FLIGHT_TICKET_STAGE_CODES.has(stage.code) && stage.status !== "pending" && flightDetailQuery.data?.ticketAttached ? (
                      <View style={{ marginTop: 8 }}>
                        <Button variant="outline" size="sm" onPress={ticketAccess.downloadTicket} disabled={ticketAccess.isRequesting}>
                          {t("candidateFlightDownloadTicketAction")}
                        </Button>
                        {ticketAccess.error ? (
                          <View style={{ marginTop: 4 }}>
                            <ValidationMessage tone="error">
                              {ticketAccess.error.message || t(CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS[ticketAccess.error.code])}
                            </ValidationMessage>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Recent updates */}
        {!progressQuery.isLoading && !progressQuery.error && timeline.length > 0 ? (
          <View
            style={{
              marginTop: 24,
              backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: isDark ? "#333333" : "#E5E7EB",
            }}
          >
            <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: isDark ? "#FFFFFF" : "#000000", marginBottom: 16 }}>
              {t("workflowHistoryTitle")}
            </Text>
            {historyQuery.isLoading ? (
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>{t("loading")}</Text>
            ) : historyQuery.error ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
                  {t(WORKFLOW_HISTORY_ERROR_KEYS[historyQuery.error.code])}
                </Text>
                <TouchableOpacity onPress={() => historyQuery.refetch()}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#0066CC" }}>{t("retry")}</Text>
                </TouchableOpacity>
              </View>
            ) : historyItems.length === 0 ? (
              <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
                {t("workflowHistoryEmpty")}
              </Text>
            ) : (
              [...historyItems].reverse().map((item) => (
                <View
                  key={`${item.toStage.code}-${item.occurredAt}`}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: isDark ? "#FFFFFF" : "#000000" }}>
                    {item.toStage.name}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
                    {formatStageDate(item.occurredAt, language)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
