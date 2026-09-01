import UserShell from "../components/user-shell";
import { useLanguage } from "../../contexts/LanguageContext";
import { PaymentPanel } from "../../features/candidate/payments/components/PaymentPanel";

export default function PaymentPage() {
  const { t } = useLanguage();

  return (
    <UserShell activeTab="/payment">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">{t("makePayment")}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <PaymentPanel />
      </div>
    </UserShell>
  );
}
