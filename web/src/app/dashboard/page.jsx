import { Link } from "react-router";
import UserShell from "../components/user-shell";
import { useLanguage } from "../../contexts/LanguageContext";

export default function DashboardPage() {
  const { t } = useLanguage();

  const candidateData = {
    name: "Ahmed Khan",
    regNumber: "DES-2026-001",
    currentStageKey: "documentsUploaded",
    progress: 30,
  };

  const quickActions = [
    {
      titleKey: "uploadDocuments",
      descriptionKey: "uploadDocumentsDesc",
      color: "bg-[#E6F2FF] text-[#0066CC]",
      href: "/documents",
    },
    {
      titleKey: "viewStatus",
      descriptionKey: "viewStatusDesc",
      color: "bg-[#FFF7E6] text-[#F59E0B]",
      href: "/status",
    },
    {
      titleKey: "makePayment",
      descriptionKey: "makePaymentDesc",
      color: "bg-[#E6F9F0] text-[#10B981]",
      href: "/payment",
    },
  ];

  return (
    <UserShell activeTab="/dashboard">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <p className="mb-1 text-sm text-gray-500">{t("welcome")}</p>
          <h1 className="text-3xl font-semibold text-black">
            {candidateData.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{candidateData.regNumber}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-black">{t("currentStatus")}</h2>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F2FF] text-[#0066CC]">
              ✓
            </div>
            <div className="text-base font-medium text-black">
              {t(candidateData.currentStageKey)}
            </div>
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#0066CC]"
              style={{ width: `${candidateData.progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">
            {candidateData.progress}% {t("complete")}
          </p>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-black">{t("nextSteps")}</h2>
          <div className="rounded-xl bg-[#FFF7E6] px-4 py-3 text-sm text-gray-700">
            {t("waitingForVerification")}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-black">{t("quickActions")}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.titleKey}
                to={action.href}
                className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm"
              >
                <div
                  className={`mb-4 inline-flex rounded-xl px-3 py-2 text-sm font-semibold ${action.color}`}
                >
                  {t(action.titleKey)}
                </div>
                <p className="text-sm leading-6 text-gray-600">
                  {t(action.descriptionKey)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </UserShell>
  );
}
