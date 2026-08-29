import { useNavigate } from "react-router";
import UserShell from "../components/user-shell";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { ApplicationProgressSummary } from "../../features/candidate/progress/components/ApplicationProgressSummary";

export default function StatusPage() {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const returnToSignIn = () => {
    logout("expired");
    navigate("/login", { replace: true });
  };

  return (
    <UserShell activeTab="/status">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">{t("status")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("mobilizationProgress")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <ApplicationProgressSummary onReturnToSignIn={returnToSignIn} />
      </div>
    </UserShell>
  );
}
