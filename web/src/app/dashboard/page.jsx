import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { FileText, CreditCard, Clock } from "lucide-react";
import UserShell from "../components/user-shell";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCandidateProfile } from "../../features/candidate/profile/hooks/useCandidateProfile";
import { useCandidateDocuments } from "../../features/candidate/documents/hooks/useCandidateDocuments";
import { useApplicationProgress } from "../../features/candidate/progress/hooks/useApplicationProgress";
import { resolveNextAction, NEXT_ACTION_KEYS } from "../../../../shared/applicationProgress/nextAction";
import { currentDashboardStage } from "../../../../shared/applicationProgress/currentDashboardStage";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState } from "../../design-system";
import { CANDIDATE_PROFILE_ERROR_KEYS } from "../../../../shared/candidateProfile/errorMessages";
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from "../../../../shared/candidateDocuments/errorMessages";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../shared/applicationProgress/errorMessages";

const quickActions = [
  {
    titleKey: "uploadDocuments",
    icon: FileText,
    color: "#0066CC",
    bgColor: "#E6F2FF",
    href: "/documents",
  },
  {
    titleKey: "viewStatus",
    icon: Clock,
    color: "#F59E0B",
    bgColor: "#FFF7E6",
    href: "/status",
  },
  {
    titleKey: "makePayment",
    subLabelKey: "makePaymentComingSoon",
    icon: CreditCard,
    color: "#10B981",
    bgColor: "#E6F9F0",
    disabled: true,
  },
];

export default function DashboardPage() {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useCandidateProfile();
  const checklistQuery = useCandidateDocuments();
  // Shares its query cache with nothing extra fetched here -- both hooks are
  // already used elsewhere in the candidate app, this page just composes
  // their already-cached data.
  const progressQuery = useApplicationProgress();

  const returnToSignIn = () => {
    logout("expired");
    navigate("/login", { replace: true });
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([profileQuery.refetch(), checklistQuery.refetch(), progressQuery.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefreshing, profileQuery.refetch, checklistQuery.refetch, progressQuery.refetch]);

  // Dashboard composes 3 independent queries (profile, checklist, progress)
  // -- pick the first real error in this priority order (profile identity
  // first, since nothing else can render meaningfully without it) so a
  // transient failure gets its own dedicated Session/Forbidden/Offline/Error
  // state, matching Documents/Status/Profile, instead of silently leaving the
  // header blank or the status card stuck at "0%" (indistinguishable from
  // valid empty data).
  const primaryError = profileQuery.error ?? checklistQuery.error ?? progressQuery.error;
  const primaryErrorKeys = profileQuery.error
    ? CANDIDATE_PROFILE_ERROR_KEYS
    : checklistQuery.error
      ? CANDIDATE_DOCUMENTS_ERROR_KEYS
      : APPLICATION_PROGRESS_ERROR_KEYS;
  const isLoading = profileQuery.isLoading || checklistQuery.isLoading || progressQuery.isLoading;

  if (isLoading) {
    return (
      <UserShell activeTab="/dashboard">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <LoadingState message={t("loading")} />
        </div>
      </UserShell>
    );
  }
  if (primaryError?.code === "SESSION_EXPIRED") {
    return (
      <UserShell activeTab="/dashboard">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <SessionExpiredState
            title={t("dsSessionExpiredTitle")}
            description={t("dsSessionExpiredDescription")}
            actionLabel={t("dsSessionExpiredAction")}
            onAction={returnToSignIn}
          />
        </div>
      </UserShell>
    );
  }
  if (primaryError?.code === "INACTIVE_ACCOUNT") {
    return (
      <UserShell activeTab="/dashboard">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <ForbiddenState
            title={t("candidateProfileInactiveAccountTitle")}
            description={t("candidateProfileInactiveAccountDescription")}
            actionLabel={t("candidateProfileInactiveAccountAction")}
            onAction={returnToSignIn}
          />
        </div>
      </UserShell>
    );
  }
  if (primaryError?.code === "OFFLINE") {
    return (
      <UserShell activeTab="/dashboard">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <OfflineState
            title={t("dsOfflineTitle")}
            description={t("dsOfflineDescription")}
            retryLabel={t("retry")}
            onRetry={handleRefresh}
          />
        </div>
      </UserShell>
    );
  }
  if (primaryError) {
    return (
      <UserShell activeTab="/dashboard">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <ErrorState message={t(primaryErrorKeys[primaryError.code])} retryLabel={t("retry")} onRetry={handleRefresh} />
        </div>
      </UserShell>
    );
  }
  if (!profileQuery.data || !progressQuery.data) {
    return (
      <UserShell activeTab="/dashboard">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <ErrorState message={t("somethingWentWrong")} retryLabel={t("retry")} onRetry={handleRefresh} />
        </div>
      </UserShell>
    );
  }

  const documents = progressQuery.data?.documents;
  const workflow = progressQuery.data?.workflow;
  const isVerified = documents?.submissionState === "verified";
  // The real, backend-authoritative workflow (MPS-501) -- `currentWorkflowStage`
  // is a separate, HR-advanced pipeline position that can legitimately lag
  // behind it, so summarizing "current status" here from the same timeline
  // Status renders keeps the two screens telling the same story.
  const currentStage = workflow ? currentDashboardStage(workflow.timeline) : null;
  const currentStageName = currentStage
    ? `${currentStage.name}${currentStage.inProgress ? ` (${t("inProgress")})` : ""}`
    : null;
  const nextAction =
    progressQuery.data && checklistQuery.data ? resolveNextAction(progressQuery.data, checklistQuery.data) : null;
  const nextActionMessage = nextAction
    ? `${t(NEXT_ACTION_KEYS[nextAction.kind])}${nextAction.requirementName ? `: ${nextAction.requirementName}` : ""}`
    : t("waitingForVerification");

  return (
    <UserShell activeTab="/dashboard">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <p className="mb-1 text-sm text-gray-500">{t("welcome")}</p>
          <h1 className="text-3xl font-semibold text-black">{profileQuery.data.fullName}</h1>
          <p className="mt-1 text-sm text-gray-500">{profileQuery.data.referenceNumber ?? t("candidateProfileNotAssignedYet")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-black">{t("currentStatus")}</h2>
            {isVerified ? (
              <span className="rounded-lg bg-[#E6F9F0] px-2.5 py-1 text-xs font-medium text-[#10B981]">{t("verified")}</span>
            ) : null}
          </div>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F2FF] text-[#0066CC]">
              ✓
            </div>
            <div className="text-base font-medium text-black">{currentStageName ?? t("registered")}</div>
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#0066CC]"
              style={{ width: `${workflow?.progressPercentage ?? 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">
            {workflow?.progressPercentage ?? 0}% {t("complete")}
          </p>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-black">{t("nextSteps")}</h2>
          <div className="rounded-xl bg-[#FFF7E6] px-4 py-3 text-sm text-gray-700">{nextActionMessage}</div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-black">{t("quickActions")}</h2>
          <div className="flex flex-wrap gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const content = (
                <>
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: action.color }}
                  >
                    <Icon size={24} color="#FFFFFF" />
                  </div>
                  <span className="text-center text-[13px] font-medium text-black">{t(action.titleKey)}</span>
                  {action.subLabelKey ? (
                    <span className="mt-0.5 text-center text-[11px] text-gray-500">{t(action.subLabelKey)}</span>
                  ) : null}
                </>
              );

              if (action.disabled) {
                return (
                  <div
                    key={action.titleKey}
                    aria-disabled="true"
                    className="flex w-[calc(50%-0.5rem)] cursor-not-allowed flex-col items-center rounded-xl p-5 opacity-50"
                    style={{ backgroundColor: action.bgColor }}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={action.titleKey}
                  to={action.href}
                  className="flex w-[calc(50%-0.5rem)] flex-col items-center rounded-xl p-5 transition hover:-translate-y-0.5"
                  style={{ backgroundColor: action.bgColor }}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </UserShell>
  );
}
