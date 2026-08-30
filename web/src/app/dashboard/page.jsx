import { useEffect } from "react";
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
    icon: CreditCard,
    color: "#10B981",
    bgColor: "#E6F9F0",
    href: "/payment",
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

  // Dashboard composes 3 independent queries with no dedicated error layout
  // of its own (the prototype has none) -- a session-ending error from any
  // of them still has to end the session, matching every other candidate
  // screen's behavior, even though a transient network/server error here
  // just leaves that section showing its loading fallback rather than a
  // full error card (Documents/Status/Profile each already own that).
  useEffect(() => {
    const code = profileQuery.error?.code ?? checklistQuery.error?.code ?? progressQuery.error?.code;
    if (code === "SESSION_EXPIRED" || code === "INACTIVE_ACCOUNT") {
      returnToSignIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.error, checklistQuery.error, progressQuery.error]);

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
          <h1 className="text-3xl font-semibold text-black">{profileQuery.data?.fullName ?? " "}</h1>
          <p className="mt-1 text-sm text-gray-500">{profileQuery.data?.referenceNumber ?? ""}</p>
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
              return (
                <Link
                  key={action.titleKey}
                  to={action.href}
                  className="flex w-[calc(50%-0.5rem)] flex-col items-center rounded-xl p-5 transition hover:-translate-y-0.5"
                  style={{ backgroundColor: action.bgColor }}
                >
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: action.color }}
                  >
                    <Icon size={24} color="#FFFFFF" />
                  </div>
                  <span className="text-center text-[13px] font-medium text-black">{t(action.titleKey)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </UserShell>
  );
}
