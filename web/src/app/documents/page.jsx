import { useNavigate } from "react-router";
import UserShell from "../components/user-shell";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCandidateDocuments } from "../../features/candidate/documents/hooks/useCandidateDocuments";
import { DocumentChecklistView } from "../../features/candidate/documents/components/DocumentChecklistView";
import { ApplicationProgressSummary } from "../../features/candidate/progress/components/ApplicationProgressSummary";

export default function DocumentsPage() {
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const checklistQuery = useCandidateDocuments();

  const returnToSignIn = () => {
    logout("expired");
    navigate("/login", { replace: true });
  };

  return (
    <UserShell activeTab="/documents">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">{t("documents")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("candidateDocumentsSubtitle")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <ApplicationProgressSummary onReturnToSignIn={returnToSignIn} />

        <DocumentChecklistView
          isLoading={checklistQuery.isLoading}
          error={checklistQuery.error ?? null}
          checklist={checklistQuery.data}
          language={language}
          t={t}
          onRetry={() => checklistQuery.refetch()}
          onReturnToSignIn={returnToSignIn}
        />
      </div>
    </UserShell>
  );
}
