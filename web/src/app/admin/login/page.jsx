import { useCallback, useEffect } from "react";
import { Navigate, useNavigate } from "react-router";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useStaffAuth } from "../../../contexts/StaffAuthContext";
import { Button, Input, ValidationMessage, toast } from "../../../design-system";
import { STAFF_AUTH_ERROR_KEYS } from "../../../../../shared/auth/staffErrorMessages";
import { useStaffSignIn } from "../../../../../shared/auth/useStaffSignIn";
import { staffAuthClient } from "../../../lib/staff-auth-client";

export default function StaffLoginPage() {
  const { t } = useLanguage();
  const { status, login, sessionExpired, acknowledgeSessionExpired } = useStaffAuth();
  const navigate = useNavigate();

  const onAuthenticated = useCallback(
    (session) => {
      login(session);
      navigate("/admin", { replace: true });
    },
    [login, navigate]
  );

  const { email, password, fieldErrors, error, isSubmitting, setEmail, setPassword, submit } = useStaffSignIn({
    client: staffAuthClient,
    onAuthenticated,
  });

  useEffect(() => {
    if (sessionExpired) {
      toast.info(t("dsSessionExpiredTitle"), { description: t("dsSessionExpiredDescription") });
      acknowledgeSessionExpired();
    }
  }, [sessionExpired, acknowledgeSessionExpired, t]);

  // An already-signed-in staff member landing on /admin/login (e.g. via a
  // stale bookmark) goes straight to the portal rather than being asked to
  // sign in again.
  if (status === "authenticated") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <main className="admin-typography relative isolate flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-brand-emphasis via-brand to-info">
      <div aria-hidden="true" className="pointer-events-none absolute -start-24 -top-24 -z-10 h-80 w-80 rounded-full bg-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -end-20 -z-10 h-96 w-96 rounded-full bg-white/10" />

      <header className="w-full px-6 py-6 sm:px-10 sm:py-8">
        <div className="inline-flex items-center rounded-2xl bg-white px-6 py-3 shadow-lg sm:px-8 sm:py-4">
          <img src="/descon-logo.png" alt="Descon" className="h-20 w-auto object-contain sm:h-28" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16 pt-4">
        <div className="rounded-2xl border border-border bg-surface-raised p-8 shadow-xl">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-semibold text-text-primary">{t("staffAuthSignInTitle")}</h1>
            <p className="text-base leading-7 text-text-secondary">{t("staffAuthSignInMessage")}</p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Input
              type="email"
              autoComplete="username"
              label={t("email")}
              placeholder={t("staffAuthEnterEmail")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              errorMessage={fieldErrors.email ? t("staffAuthEmailRequiredError") : undefined}
              disabled={isSubmitting}
              autoFocus
            />
            <Input
              type="password"
              autoComplete="current-password"
              label={t("password")}
              placeholder={t("staffAuthEnterPassword")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              errorMessage={fieldErrors.password ? t("staffAuthPasswordRequiredError") : undefined}
              disabled={isSubmitting}
            />

            {error ? <ValidationMessage tone="error">{t(STAFF_AUTH_ERROR_KEYS[error.code])}</ValidationMessage> : null}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting}>
              {t("staffAuthSignIn")}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
