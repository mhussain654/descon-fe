import { CheckCircle } from "lucide-react";
import { useLanguage } from "../../../contexts/LanguageContext";

// The candidate's browser lands here after the hosted checkout page
// redirects back through the backend (see descon-be's
// HostedCheckoutReturnsController / FRONTEND_PAYMENT_RETURN_URL) --
// deliberately unauthenticated and API-free. Checkout is opened in a new
// tab (PaymentPanel.tsx) specifically so the original tab's session stays
// alive and keeps polling for the authoritative outcome; this tab never
// calls the payment API and never reads a status from its own URL, so
// there is nothing here to trust or distrust -- it only tells the
// candidate to go back to where they were.
export default function PaymentPendingPage() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E6F9F0] text-[#10B981]">
        <CheckCircle size={28} />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-black">{t("paymentPendingReturnTitle")}</h1>
      <p className="max-w-sm text-sm text-gray-600">{t("paymentPendingReturnDescription")}</p>
    </div>
  );
}
