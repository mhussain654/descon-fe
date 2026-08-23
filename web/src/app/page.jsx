import { Check } from "lucide-react";
import { useNavigate } from "react-router";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../design-system";

function LanguageOptionCard({ active, flag, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center justify-between rounded-xl border-2 px-5 py-4 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        active ? "border-brand bg-brand-subtle" : "border-border bg-surface-sunken hover:border-borderStrong"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl" aria-hidden="true">
          {flag}
        </div>
        <div>
          <div className="text-base font-semibold text-text-primary">{label}</div>
          <div className="text-sm text-text-secondary">{hint}</div>
        </div>
      </div>
      {active ? (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-on">
          <Check className="h-4 w-4" aria-hidden="true" />
        </div>
      ) : null}
    </button>
  );
}

export default function WelcomePage() {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 pb-8 pt-16">
        <div className="mb-12 flex justify-center">
          <img
            src="https://ucarecdn.com/26b1d36a-12cf-4efa-853d-08da75f95d7e/-/format/auto/"
            alt="Descon"
            className="h-16 w-44 object-contain"
          />
        </div>

        <section className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-semibold text-text-primary">{t("welcomeTitle")}</h1>
          <p className="text-base leading-7 text-text-secondary">{t("welcomeMessage")}</p>
        </section>

        <section className="mb-12">
          <p className="mb-4 text-center text-sm font-medium text-text-primary">{t("selectLanguage")}</p>
          <div className="space-y-3">
            <LanguageOptionCard
              active={language === "en"}
              flag="🇬🇧"
              label={t("englishLabel")}
              hint={t("englishHint")}
              onClick={() => setLanguage("en")}
            />
            <LanguageOptionCard
              active={language === "ur"}
              flag="🇵🇰"
              label={t("urduLabel")}
              hint={t("urduHint")}
              onClick={() => setLanguage("ur")}
            />
          </div>
        </section>

        <div className="flex-1" />

        <Button variant="primary" size="lg" fullWidth onClick={() => navigate("/login")}>
          {t("continue")}
        </Button>

        <p className="mt-6 text-center text-xs text-text-tertiary">{t("companyFooter")}</p>
      </div>
    </main>
  );
}
