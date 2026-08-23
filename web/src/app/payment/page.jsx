import { Link } from "react-router";
import { formatCurrency } from "../../../../shared/i18n/locale";
import { RequireAuth } from "../../features/auth/RequireAuth";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PaymentPage() {
  return (
    <RequireAuth>
      <PaymentPageContent />
    </RequireAuth>
  );
}

function PaymentPageContent() {
  const { t, language } = useLanguage();

  const payment = {
    amount: 25000,
    statusKey: "pending",
    reference: "PAY-2026-001",
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA]">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Link to="/dashboard" className="mb-3 inline-block text-sm font-medium text-gray-500 hover:text-black">
            {t("back")}
          </Link>
          <h1 className="text-3xl font-semibold text-black">{t("payment")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("completeOnboardingPayment")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">{t("reference")}</div>
              <div className="mt-1 text-base font-medium text-black">{payment.reference}</div>
            </div>
            <div className="rounded-xl bg-[#FFF7E6] px-3 py-2 text-sm font-semibold text-[#F59E0B]">
              {t(payment.statusKey)}
            </div>
          </div>

          <div className="mb-8 rounded-2xl bg-[#F8F9FA] p-5">
            <div className="text-sm text-gray-500">{t("amountDue")}</div>
            <div className="mt-2 text-4xl font-semibold text-black">
              {formatCurrency(payment.amount, language)}
            </div>
          </div>

          <button
            type="button"
            className="w-full rounded-xl bg-[#0066CC] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#0057AD]"
          >
            {t("payNow")}
          </button>
        </div>
      </div>
    </main>
  );
}
