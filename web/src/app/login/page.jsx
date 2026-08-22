import { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

export default function LoginPage() {
  const { language, setLanguage, t } = useLanguage();
  const [step, setStep] = useState(1);
  const [mobileNumber, setMobileNumber] = useState("");
  const [cnic, setCnic] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = () => {
    if (!mobileNumber || !cnic) return;
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 800);
  };

  const handleVerifyOtp = () => {
    if (!otp) return;
    setLoading(true);
    window.setTimeout(() => {
      window.location.href = "/dashboard";
    }, 800);
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 pb-8 pt-16">
        <div className="mb-10 flex items-center justify-between">
          <a href="/" className="text-sm font-medium text-gray-500 hover:text-black">
            {t("back")}
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                language === "en" ? "bg-[#0066CC] text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("ur")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                language === "ur" ? "bg-[#0066CC] text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              اردو
            </button>
          </div>
        </div>

        <div className="mb-10">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066CC] text-3xl text-white">
            🛡
          </div>
          <h1 className="mb-2 text-3xl font-semibold text-black">
            {step === 1 ? t("login") : t("verifyOTP")}
          </h1>
          <p className="text-base leading-7 text-gray-500">
            {step === 1 ? t("loginMessage") : `${t("otpSentMessage")} ${mobileNumber}`}
          </p>
        </div>

        {step === 1 ? (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-black">
                {t("mobileNumber")}
              </label>
              <input
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
                placeholder={t("enterMobileNumber")}
                className="w-full rounded-xl border border-gray-200 bg-[#F6F6F6] px-4 py-3 text-base text-black"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-black">
                {t("cnic")}
              </label>
              <input
                value={cnic}
                onChange={(event) => setCnic(event.target.value)}
                placeholder={t("enterCNIC")}
                className="w-full rounded-xl border border-gray-200 bg-[#F6F6F6] px-4 py-3 text-base text-black"
              />
            </div>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading || !mobileNumber || !cnic}
              className="w-full rounded-xl bg-[#0066CC] px-6 py-4 text-base font-semibold text-white disabled:bg-gray-400"
            >
              {loading ? "..." : t("sendOTP")}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-black">
                {t("enterOTP")}
              </label>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder="123456"
                className="w-full rounded-xl border border-gray-200 bg-[#F6F6F6] px-4 py-3 text-base text-black"
              />
            </div>
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={loading || !otp}
              className="w-full rounded-xl bg-[#0066CC] px-6 py-4 text-base font-semibold text-white disabled:bg-gray-400"
            >
              {loading ? "..." : t("verifyAndLogin")}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full rounded-xl border border-gray-200 px-6 py-4 text-base font-semibold text-gray-700"
            >
              {t("resendOTP")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
