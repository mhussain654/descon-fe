import { useNavigate } from "react-router";
import { User, FileText, CheckCircle, Flag, Globe, LogOut, ChevronRight, ChevronLeft } from "lucide-react";
import UserShell from "../components/user-shell";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCandidateProfile } from "../../features/candidate/profile/hooks/useCandidateProfile";
import { useApplicationProgress } from "../../features/candidate/progress/hooks/useApplicationProgress";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState } from "../../design-system";
import { humanizeStatusCode } from "../../../../shared/candidateProfile/formatting";
import { CANDIDATE_PROFILE_ERROR_KEYS } from "../../../../shared/candidateProfile/errorMessages";
import { APPLICATION_SUBMISSION_STATE_KEYS, APPLICATION_SUBMISSION_STATE_TONES } from "../../../../shared/applicationProgress/statusLabels";

const TONE_COLORS = {
  success: "text-[#10B981]",
  warning: "text-[#F59E0B]",
  danger: "text-[#EF4444]",
  info: "text-[#0066CC]",
  neutral: "text-[#6B7280]",
};

function InfoRow({ icon: Icon, iconClassName, label, value }) {
  return (
    <div className="flex items-center border-b border-[#F0F0F0] py-4 last:border-b-0">
      <div className="me-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6F6F6]">
        <Icon size={20} className={iconClassName ?? "text-gray-500"} />
      </div>
      <div className="flex-1">
        <div className="mb-0.5 text-[13px] text-gray-500">{label}</div>
        <div className="text-[15px] font-medium text-black">{value}</div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { t, language, toggleLanguage } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useCandidateProfile();
  const progressQuery = useApplicationProgress();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // No page-level auto-redirect on SESSION_EXPIRED/INACTIVE_ACCOUNT here --
  // renderBody() below already shows a dedicated SessionExpiredState/
  // ForbiddenState for the profile query's own error, and that screen's own
  // action button is what ends the session (never silently out from under
  // the candidate before they see it).
  const returnToSignIn = () => {
    logout("expired");
    navigate("/login", { replace: true });
  };

  const profile = profileQuery.data;
  const notAssignedYet = t("candidateProfileNotAssignedYet");
  const documents = progressQuery.data?.documents;

  const renderBody = () => {
    if (profileQuery.isLoading) {
      return <LoadingState message={t("loading")} />;
    }
    const error = profileQuery.error;
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
          onRetry={() => profileQuery.refetch()}
        />
      );
    }
    if (error) {
      return (
        <ErrorState message={t(CANDIDATE_PROFILE_ERROR_KEYS[error.code])} retryLabel={t("retry")} onRetry={() => profileQuery.refetch()} />
      );
    }
    if (!profile) {
      return <ErrorState message={t("somethingWentWrong")} retryLabel={t("retry")} onRetry={() => profileQuery.refetch()} />;
    }

    return (
      <>
        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#0066CC] text-3xl font-semibold text-white">
            {profile.fullName.charAt(0)}
          </div>
          <div className="text-xl font-semibold text-black">{profile.fullName}</div>
          <div className="mt-1 text-sm text-gray-500">{profile.referenceNumber ?? notAssignedYet}</div>
        </section>

        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-black">{t("personalInfo")}</h2>
          <InfoRow icon={User} label={t("candidateProfileMaskedCnicLabel")} value={profile.maskedCnic} />
          <InfoRow icon={FileText} label={t("candidateProfileReferenceNumberLabel")} value={profile.referenceNumber ?? notAssignedYet} />
          <InfoRow icon={CheckCircle} label={t("candidateProfileStatusLabel")} value={humanizeStatusCode(profile.candidateStatus)} />
          <InfoRow
            icon={Flag}
            label={t("candidateProfileWorkflowStageLabel")}
            value={profile.currentWorkflowStage?.name ?? notAssignedYet}
          />
          {documents ? (
            <InfoRow
              icon={CheckCircle}
              iconClassName={TONE_COLORS[APPLICATION_SUBMISSION_STATE_TONES[documents.submissionState]]}
              label={t("candidateProfileDocumentsSectionTitle")}
              value={t(APPLICATION_SUBMISSION_STATE_KEYS[documents.submissionState])}
            />
          ) : null}
        </section>
      </>
    );
  };

  return (
    <UserShell activeTab="/profile">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">{t("profile")}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {renderBody()}

        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex w-full items-center justify-between rounded-xl px-4 py-4 text-start transition hover:bg-[#F6F6F6]"
          >
            <div className="flex items-center">
              <div className="me-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F2FF]">
                <Globe size={20} className="text-[#0066CC]" />
              </div>
              <div>
                <div className="text-sm font-medium text-black">{t("language")}</div>
                <div className="mt-1 text-sm text-gray-500">{language === "en" ? t("englishLabel") : t("urduLabel")}</div>
              </div>
            </div>
            {language === "ur" ? (
              <ChevronLeft size={20} className="text-gray-400" />
            ) : (
              <ChevronRight size={20} className="text-gray-400" />
            )}
          </button>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] px-6 py-4 text-base font-semibold text-[#EF4444] transition hover:bg-[#FEE2E2]"
        >
          <LogOut size={20} />
          <span className="ms-2">{t("logout")}</span>
        </button>
      </div>
    </UserShell>
  );
}
