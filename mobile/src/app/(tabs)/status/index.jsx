import { View, ScrollView, RefreshControl } from "react-native";
import { Text } from "../../../design-system/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Download } from "lucide-react-native";
import { StatusHeader, JourneySummary, JourneyStepCard, statusStyles, statusCopyStyle } from "../../../features/candidate/progress/components/StatusPresentation";
import { ButtonHeightContext } from "../../../design-system/Button";
import { isStartSide } from "../../../lib/layoutDirection";
import { useRouter } from "expo-router";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { useApplicationProgress } from "../../../features/candidate/progress/hooks/useApplicationProgress";
import { useCandidateWorkflowHistory } from "../../../features/candidate/workflow/hooks/useCandidateWorkflowHistory";
import { useCandidateFlightDetail } from "../../../features/candidate/workflow/hooks/useCandidateFlightDetail";
import { useFlightTicketAccess } from "../../../features/candidate/workflow/hooks/useFlightTicketAccess";
import { useCandidateVisaDecisions } from "../../../features/candidate/workflow/hooks/useCandidateVisaDecisions";
import { useVisaCopyAccess } from "../../../features/candidate/workflow/hooks/useVisaCopyAccess";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState, Button, ValidationMessage, getFontFamily } from "../../../design-system";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../../shared/applicationProgress/errorMessages";
import { findLatestQvcOutcome, QVC_OUTCOME_KEYS, QVC_OUTCOME_TONES } from "../../../../../shared/candidateWorkflow/qvcOutcome";
import { mobilizationJourney } from "../../../../../shared/applicationProgress/mobilizationJourney";
import { VISA_OUTCOME_KEYS, VISA_OUTCOME_TONES } from "../../../../../shared/candidateVisaDecisions/outcomeLabels";
import { CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS } from "../../../../../shared/candidateFlightDetail/errorMessages";
import { CANDIDATE_VISA_DECISIONS_ERROR_KEYS } from "../../../../../shared/candidateVisaDecisions/errorMessages";

// The steps that carry an outcome or a download of their own.
const QVC_OUTCOME_STEP = "qvc_status";
const VISA_OUTCOME_STEP = "visa";
const FLIGHT_TICKET_STEP = "ready_to_fly";

const QVC_TONE_COLORS = {
  success: { bg: "#E6F9F0", text: "#087C46" },
  warning: { bg: "#FFF7E6", text: "#9A5700" },
  danger: { bg: "#FEF2F2", text: "#B42318" },
};

function formatStageDate(iso, language) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(language === "ur" ? "ur-PK" : "en-GB");
}

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const progressQuery = useApplicationProgress();
  const historyQuery = useCandidateWorkflowHistory();
  const flightDetailQuery = useCandidateFlightDetail();
  const ticketAccess = useFlightTicketAccess();
  const visaDecisionsQuery = useCandidateVisaDecisions();
  const visaCopyAccess = useVisaCopyAccess();
  useRefetchOnFocus(progressQuery.refetch, progressQuery.isFetching);
  useRefetchOnFocus(historyQuery.refetch, historyQuery.isFetching);
  useRefetchOnFocus(flightDetailQuery.refetch, flightDetailQuery.isFetching);
  useRefetchOnFocus(visaDecisionsQuery.refetch, visaDecisionsQuery.isFetching);

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  const workflow = progressQuery.data?.workflow;
  const timeline = workflow?.timeline ?? [];
  // The client's mobilization process for the candidate's Business Unit: a few
  // steps, each Approved / In process / Rejected, instead of every internal stage.
  const journey = mobilizationJourney({
    countryCode: workflow?.mobilizationProcess?.countryCode,
    timeline,
    outcomes: workflow?.outcomes,
    documents: progressQuery.data?.documents,
  });
  const qvcOutcome = findLatestQvcOutcome(historyQuery.data?.items ?? []);
  // The latest recorded visa decision (a candidate can be re-submitted, so this is
  // never assumed to be the only one) -- the backend returns the list in chronological order.
  const latestVisaDecision = visaDecisionsQuery.data?.at(-1) ?? null;
  const lastUpdatedLabel = workflow ? formatStageDate(workflow.updatedAt, language) : null;

  return (
    <ButtonHeightContext.Provider value={34}>
    <View style={statusStyles.screen}>
      <StatusBar style="light" />
      <StatusHeader countryCode={workflow?.mobilizationProcess?.countryCode} topInset={insets.top} language={language} t={t} />
      <ScrollView
        style={statusStyles.scroll}
        contentContainerStyle={[statusStyles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={progressQuery.isRefetching || historyQuery.isRefetching || flightDetailQuery.isRefetching || visaDecisionsQuery.isRefetching}
            onRefresh={() => {
              progressQuery.refetch();
              historyQuery.refetch();
              flightDetailQuery.refetch();
              visaDecisionsQuery.refetch();
            }}
            title={t("pullToRefresh")}
          />
        }
      >
        {/* isPending, not isLoading -- see documents/index.jsx for why a
            disabled (auth still restoring) query needs this, not isLoading. */}
        {progressQuery.isPending ? <LoadingState message={t("loading")} language={language} /> : null}

        {progressQuery.error?.code === "SESSION_EXPIRED" ? (
          <SessionExpiredState
            title={t("dsSessionExpiredTitle")}
            description={t("dsSessionExpiredDescription")}
            actionLabel={t("dsSessionExpiredAction")}
            onAction={returnToSignIn}
            language={language}
          />
        ) : null}

        {progressQuery.error?.code === "INACTIVE_ACCOUNT" ? (
          <ForbiddenState
            title={t("candidateProfileInactiveAccountTitle")}
            description={t("candidateProfileInactiveAccountDescription")}
            actionLabel={t("candidateProfileInactiveAccountAction")}
            onAction={returnToSignIn}
            language={language}
          />
        ) : null}

        {progressQuery.error?.code === "OFFLINE" ? (
          <OfflineState
            title={t("dsOfflineTitle")}
            description={t("dsOfflineDescription")}
            retryLabel={t("retry")}
            onRetry={() => progressQuery.refetch()}
            language={language}
          />
        ) : null}

        {progressQuery.error && !["OFFLINE", "SESSION_EXPIRED", "INACTIVE_ACCOUNT"].includes(progressQuery.error.code) ? (
          <ErrorState
            message={t(APPLICATION_PROGRESS_ERROR_KEYS[progressQuery.error.code])}
            retryLabel={t("retry")}
            onRetry={() => progressQuery.refetch()}
            language={language}
          />
        ) : null}

        {!progressQuery.isPending && !progressQuery.error && timeline.length > 0 ? (
          <JourneySummary journey={journey} updatedLabel={lastUpdatedLabel} language={language} t={t} />
        ) : null}

        {!progressQuery.isPending && !progressQuery.error && timeline.length === 0 ? (
          <View style={statusStyles.empty}><Text style={[statusStyles.historyName, statusCopyStyle(language)]}>{t("candidateStatusEmpty")}</Text></View>
        ) : null}

        {/* Timeline */}
        {!progressQuery.isPending && !progressQuery.error && timeline.length > 0 ? (
          <View>
            <Text accessibilityRole="header" style={[statusStyles.sectionTitle, statusCopyStyle(language, 16), { fontFamily: getFontFamily(language, "bold") }]}>{t("journeyMobilizationProcessTitle")}</Text>
            {journey.steps.map((step, index) => {
              const isLast = index === journey.steps.length - 1;
              const startedLabel = formatStageDate(step.startedAt, language);
              const completedLabel = formatStageDate(step.completedAt, language);
              const outcomeTone = qvcOutcome ? QVC_TONE_COLORS[QVC_OUTCOME_TONES[qvcOutcome.code]] : null;
              const visaOutcomeTone = latestVisaDecision ? QVC_TONE_COLORS[VISA_OUTCOME_TONES[latestVisaDecision.outcomeCode]] : null;

              return (
                <JourneyStepCard key={step.code} step={step} isLast={isLast} language={language} t={t} dateLabel={completedLabel ? `${t("workflowStageCompletedPrefix")} ${completedLabel}` : startedLabel ? `${t("workflowStageStartedPrefix")} ${startedLabel}` : null}>
                    {step.code === QVC_OUTCOME_STEP && qvcOutcome ? (
                      <View
                        style={{
                          backgroundColor: outcomeTone.bg,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          marginTop: 8,
                          alignSelf: isStartSide(language === "ur" ? "right" : "left") ? "flex-start" : "flex-end",
                        }}
                      >
                        <Text style={[statusStyles.outcomeText, statusCopyStyle(language), { color: outcomeTone.text }]}>
                          {t("qvcOutcome")}: {t(QVC_OUTCOME_KEYS[qvcOutcome.code])}
                          {formatStageDate(qvcOutcome.date, language) ? ` • ${formatStageDate(qvcOutcome.date, language)}` : ""}
                        </Text>
                      </View>
                    ) : null}
                    {step.code === VISA_OUTCOME_STEP && latestVisaDecision ? (
                      <View>
                        <View
                          style={{
                            backgroundColor: visaOutcomeTone.bg,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            marginTop: 8,
                            alignSelf: isStartSide(language === "ur" ? "right" : "left") ? "flex-start" : "flex-end",
                          }}
                        >
                          <Text style={[statusStyles.outcomeText, statusCopyStyle(language), { color: visaOutcomeTone.text }]}>
                            {t("visaOutcome")}: {t(VISA_OUTCOME_KEYS[latestVisaDecision.outcomeCode])}
                            {formatStageDate(latestVisaDecision.decisionDate, language)
                              ? ` • ${formatStageDate(latestVisaDecision.decisionDate, language)}`
                              : ""}
                          </Text>
                        </View>
                        {latestVisaDecision.visaCopyAttached ? (
                          <View style={{ marginTop: 8 }}>
                            <Button
                              variant="outline"
                              size="sm"
                              style={[statusStyles.download, { alignSelf: isStartSide(language === "ur" ? "right" : "left") ? "flex-start" : "flex-end" }]}
                              labelStyle={[statusStyles.downloadText, language === "ur" && statusStyles.downloadTextUrdu]}
                              leadingIcon={<Download size={14} color="#087443" />}
                              onPress={() => visaCopyAccess.downloadVisaCopy(latestVisaDecision.id)}
                              disabled={visaCopyAccess.isRequesting}
                              language={language}
                            >
                              {t("candidateVisaDownloadCopyAction")}
                            </Button>
                            {visaCopyAccess.error ? (
                              <View style={{ marginTop: 4 }}>
                                <ValidationMessage tone="error" language={language}>
                                  {visaCopyAccess.error.message || t(CANDIDATE_VISA_DECISIONS_ERROR_KEYS[visaCopyAccess.error.code])}
                                </ValidationMessage>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    {step.code === FLIGHT_TICKET_STEP && step.status !== "upcoming" && flightDetailQuery.data?.ticketAttached ? (
                      <View style={{ marginTop: 8 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          style={[statusStyles.download, { alignSelf: isStartSide(language === "ur" ? "right" : "left") ? "flex-start" : "flex-end" }]}
                          labelStyle={[statusStyles.downloadText, language === "ur" && statusStyles.downloadTextUrdu]}
                          leadingIcon={<Download size={14} color="#087443" />}
                          onPress={ticketAccess.downloadTicket}
                          disabled={ticketAccess.isRequesting}
                          language={language}
                        >
                          {t("candidateFlightDownloadTicketAction")}
                        </Button>
                        {ticketAccess.error ? (
                          <View style={{ marginTop: 4 }}>
                            <ValidationMessage tone="error" language={language}>
                              {ticketAccess.error.message || t(CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS[ticketAccess.error.code])}
                            </ValidationMessage>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                </JourneyStepCard>
              );
            })}
          </View>
        ) : null}

      </ScrollView>
    </View>
    </ButtonHeightContext.Provider>
  );
}
