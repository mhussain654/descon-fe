import { useNavigate } from "react-router";
import UserShell from "../components/user-shell";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useApplicationProgress } from "../../features/candidate/progress/hooks/useApplicationProgress";
import { useCandidateWorkflowHistory } from "../../features/candidate/workflow/hooks/useCandidateWorkflowHistory";
import { useCandidateFlightDetail } from "../../features/candidate/workflow/hooks/useCandidateFlightDetail";
import { useFlightTicketAccess } from "../../features/candidate/workflow/hooks/useFlightTicketAccess";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState, Button, ValidationMessage } from "../../design-system";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../shared/applicationProgress/errorMessages";
import { WORKFLOW_HISTORY_ERROR_KEYS } from "../../../../shared/candidateWorkflow/errorMessages";
import { findLatestQvcOutcome, QVC_OUTCOME_KEYS, QVC_OUTCOME_TONES } from "../../../../shared/candidateWorkflow/qvcOutcome";
import { CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS } from "../../../../shared/candidateFlightDetail/errorMessages";
import { resolveDocumentAccessUrl } from "../../lib/resolveDocumentAccessUrl";

const QVC_OUTCOME_STAGE_CODE = "qvc_completed_outcome_received";
const FLIGHT_TICKET_STAGE_CODES = new Set(["flight_details_uploaded", "mobilized"]);

const QVC_TONE_CLASSES = {
  success: "bg-[#E6F9F0] text-[#10B981]",
  warning: "bg-[#FFF7E6] text-[#F59E0B]",
  danger: "bg-[#FEF2F2] text-[#EF4444]",
};

function stageConfig(status) {
  switch (status) {
    case "completed":
      return { className: "bg-[#E6F9F0] text-[#10B981]", lineClassName: "bg-[#10B981]", textClassName: "text-black", symbol: "✓" };
    case "current":
      return { className: "bg-[#E6F2FF] text-[#0066CC]", lineClassName: "bg-gray-200", textClassName: "text-black", symbol: "•" };
    default:
      return { className: "bg-white text-[#9CA3AF] ring-2 ring-gray-200", lineClassName: "bg-gray-200", textClassName: "text-gray-400", symbol: "" };
  }
}

function formatStageDate(iso, language) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(language === "ur" ? "ur-PK" : "en-GB");
}

export default function StatusPage() {
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const progressQuery = useApplicationProgress();
  const historyQuery = useCandidateWorkflowHistory();
  const flightDetailQuery = useCandidateFlightDetail();
  const ticketAccess = useFlightTicketAccess();

  const returnToSignIn = () => {
    logout("expired");
    navigate("/login", { replace: true });
  };

  const renderBody = () => {
    if (progressQuery.isLoading) {
      return <LoadingState message={t("loading")} />;
    }
    const error = progressQuery.error;
    if (error?.code === "SESSION_EXPIRED") {
      return (
        <SessionExpiredState
          title={t("dsSessionExpiredTitle")}
          description={t("dsSessionExpiredDescription")}
          actionLabel={t("dsSessionExpiredAction")}
          onAction={returnToSignIn}
        />
      );
    }
    if (error?.code === "INACTIVE_ACCOUNT") {
      return (
        <ForbiddenState
          title={t("candidateProfileInactiveAccountTitle")}
          description={t("candidateProfileInactiveAccountDescription")}
          actionLabel={t("candidateProfileInactiveAccountAction")}
          onAction={returnToSignIn}
        />
      );
    }
    if (error?.code === "OFFLINE") {
      return (
        <OfflineState
          title={t("dsOfflineTitle")}
          description={t("dsOfflineDescription")}
          retryLabel={t("retry")}
          onRetry={() => progressQuery.refetch()}
        />
      );
    }
    if (error) {
      return (
        <ErrorState
          message={t(APPLICATION_PROGRESS_ERROR_KEYS[error.code])}
          retryLabel={t("retry")}
          onRetry={() => progressQuery.refetch()}
        />
      );
    }

    const workflow = progressQuery.data?.workflow;
    const timeline = workflow?.timeline ?? [];
    if (timeline.length === 0) return null;

    const qvcOutcome = findLatestQvcOutcome(historyQuery.data?.items ?? []);
    const lastUpdatedLabel = formatStageDate(workflow.updatedAt, language);

    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
          <span>
            {t("workflowStagesCompletedPrefix")}: {workflow.completedCount}/{workflow.totalCount}
          </span>
          {lastUpdatedLabel ? (
            <span>
              {t("workflowLastUpdatedPrefix")}: {lastUpdatedLabel}
            </span>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          {timeline.map((stage, index) => {
            const config = stageConfig(stage.status);
            const startedLabel = formatStageDate(stage.startedAt, language);
            const completedLabel = formatStageDate(stage.completedAt, language);
            return (
              <div key={stage.code} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${config.className}`}>
                    {config.symbol}
                  </div>
                  {index < timeline.length - 1 ? <div className={`min-h-12 w-0.5 ${config.lineClassName}`} /> : null}
                </div>
                <div className="pb-6">
                  <div className={`text-base ${stage.status === "current" ? "font-semibold" : "font-medium"} ${config.textClassName}`}>
                    {stage.name}
                  </div>
                  {completedLabel ? (
                    <div className="mt-1 text-xs text-gray-500">
                      {t("workflowStageCompletedPrefix")} {completedLabel}
                    </div>
                  ) : startedLabel ? (
                    <div className="mt-1 text-xs text-gray-500">
                      {t("workflowStageStartedPrefix")} {startedLabel}
                    </div>
                  ) : null}
                  {stage.status === "current" ? (
                    <div className="mt-3 inline-flex rounded-lg bg-[#E6F2FF] px-3 py-2 text-xs font-medium text-[#0066CC]">
                      {t("inProgress")}
                    </div>
                  ) : null}
                  {stage.code === QVC_OUTCOME_STAGE_CODE && qvcOutcome ? (
                    <div
                      className={`mt-3 inline-flex rounded-lg px-3 py-2 text-xs font-medium ${QVC_TONE_CLASSES[QVC_OUTCOME_TONES[qvcOutcome.code]]}`}
                    >
                      {t("qvcOutcome")}: {t(QVC_OUTCOME_KEYS[qvcOutcome.code])}
                      {formatStageDate(qvcOutcome.date, language) ? ` • ${formatStageDate(qvcOutcome.date, language)}` : ""}
                    </div>
                  ) : null}
                  {FLIGHT_TICKET_STAGE_CODES.has(stage.code) && stage.status !== "pending" && flightDetailQuery.data?.ticketAttached ? (
                    <div className="mt-3">
                      {ticketAccess.access && !ticketAccess.isExpired ? (
                        <a
                          href={resolveDocumentAccessUrl(ticketAccess.access.url, import.meta.env.VITE_API_BASE_URL ?? "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[#0066CC] underline"
                        >
                          {t("candidateFlightOpenTicketAction")}
                        </a>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={ticketAccess.requestTicketAccess}
                          disabled={ticketAccess.isRequesting}
                        >
                          {t("candidateFlightDownloadTicketAction")}
                        </Button>
                      )}
                      {ticketAccess.isExpired ? (
                        <p className="mt-1 text-xs text-gray-500">{t("candidateFlightAccessExpiredMessage")}</p>
                      ) : null}
                      {ticketAccess.error ? (
                        <ValidationMessage tone="error">
                          {ticketAccess.error.message || t(CANDIDATE_FLIGHT_DETAIL_ERROR_KEYS[ticketAccess.error.code])}
                        </ValidationMessage>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-black">{t("workflowHistoryTitle")}</h2>
          {historyQuery.isLoading ? (
            <p className="text-sm text-gray-500">{t("loading")}</p>
          ) : historyQuery.error ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">{t(WORKFLOW_HISTORY_ERROR_KEYS[historyQuery.error.code])}</p>
              <button type="button" onClick={() => historyQuery.refetch()} className="text-sm font-medium text-[#0066CC]">
                {t("retry")}
              </button>
            </div>
          ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">{t("workflowHistoryEmpty")}</p>
          ) : (
            <ul className="space-y-3">
              {[...historyQuery.data.items].reverse().map((item) => (
                <li key={`${item.toStage.code}-${item.occurredAt}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-black">{item.toStage.name}</span>
                  <span className="text-gray-500">{formatStageDate(item.occurredAt, language)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    );
  };

  return (
    <UserShell activeTab="/status">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">{t("status")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("mobilizationProgress")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">{renderBody()}</div>
    </UserShell>
  );
}
