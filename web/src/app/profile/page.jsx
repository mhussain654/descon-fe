import { useNavigate } from "react-router";
import UserShell from "../components/user-shell";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCandidateProfile } from "../../features/candidate/profile/hooks/useCandidateProfile";
import { CandidateProfileView } from "../../features/candidate/profile/components/CandidateProfileView";

export default function ProfilePage() {
  const { t, language, toggleLanguage } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useCandidateProfile();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const returnToSignIn = () => {
    logout("expired");
    navigate("/login", { replace: true });
  };

  return (
    <UserShell activeTab="/profile">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">{t("profile")}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <CandidateProfileView
          isLoading={profileQuery.isLoading}
          error={profileQuery.error ?? null}
          profile={profileQuery.data}
          t={t}
          onRetry={() => profileQuery.refetch()}
          onReturnToSignIn={returnToSignIn}
        />

        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex w-full items-center justify-between rounded-xl px-4 py-4 text-left transition hover:bg-[#F6F6F6]"
          >
            <div>
              <div className="text-sm font-medium text-black">{t("language")}</div>
              <div className="mt-1 text-sm text-gray-500">
                {language === "en" ? t("englishLabel") : t("urduLabel")}
              </div>
            </div>
            <div className="text-gray-400">›</div>
          </button>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] px-6 py-4 text-base font-semibold text-[#EF4444]"
        >
          {t("logout")}
        </button>
      </div>
    </UserShell>
  );
}
