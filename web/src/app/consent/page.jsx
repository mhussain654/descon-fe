import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { Button, ValidationMessage } from "../../design-system";
import { useAcceptConsent } from "../../features/candidate/consent/hooks/useAcceptConsent";

// MPS-204: candidates must accept the current policy version before using
// any other part of the app. RequireAuth (web/src/features/auth/RequireAuth.tsx)
// redirects every other protected screen here whenever the authenticated
// session's consent hasn't been accepted yet, mirroring the backend's own
// ProtectedController#ensure_consent_given! gate.
export default function ConsentPage() {
  const { t } = useLanguage();
  const { status, session, logout } = useAuth();
  const navigate = useNavigate();
  const { accept, isPending, isError, reset } = useAcceptConsent();

  useEffect(() => {
    if (session?.consent?.accepted) {
      navigate("/dashboard", { replace: true });
    }
  }, [session?.consent?.accepted, navigate]);

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 pb-8 pt-16">
        <div className="mb-10">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066CC]">
            <ShieldCheck size={32} color="#FFFFFF" strokeWidth={2} />
          </div>
          <h1 className="mb-2 text-3xl font-semibold text-text-primary">{t("consentTitle")}</h1>
          <p className="text-base leading-7 text-text-secondary">{t("consentMessage")}</p>
        </div>

        <div className="space-y-5">
          {isError ? <ValidationMessage tone="error">{t("consentErrorMessage")}</ValidationMessage> : null}

          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            loading={isPending}
            onClick={() => {
              reset();
              accept();
            }}
          >
            {t("consentAcceptAction")}
          </Button>

          <Button type="button" variant="text" size="sm" fullWidth onClick={() => logout()}>
            {t("consentDeclineAction")}
          </Button>
        </div>
      </div>
    </main>
  );
}
