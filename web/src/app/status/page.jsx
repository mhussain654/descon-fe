import { useNavigate } from "react-router";
import UserShell from "../components/user-shell";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useApplicationProgress } from "../../features/candidate/progress/hooks/useApplicationProgress";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState } from "../../design-system";
import { buildStatusTimeline } from "../../../../shared/applicationProgress/statusTimeline";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../shared/applicationProgress/errorMessages";

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

export default function StatusPage() {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const progressQuery = useApplicationProgress();

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

    const timeline = progressQuery.data ? buildStatusTimeline(progressQuery.data) : null;
    if (!timeline) return null;

    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        {timeline.map((item, index) => {
          const config = stageConfig(item.status);
          return (
            <div key={item.labelKey} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${config.className}`}>
                  {config.symbol}
                </div>
                {index < timeline.length - 1 ? <div className={`min-h-12 w-0.5 ${config.lineClassName}`} /> : null}
              </div>
              <div className="pb-6">
                <div className={`text-base ${item.status === "current" ? "font-semibold" : "font-medium"} ${config.textClassName}`}>
                  {t(item.labelKey)}
                </div>
                {item.status === "current" ? (
                  <div className="mt-3 inline-flex rounded-lg bg-[#E6F2FF] px-3 py-2 text-xs font-medium text-[#0066CC]">
                    {t("inProgress")}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
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
