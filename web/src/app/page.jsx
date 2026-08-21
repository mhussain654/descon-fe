import { useState } from "react";

const translations = {
  en: {
    welcomeTitle: "Welcome",
    welcomeMessage: "Descon Engineering Manpower Onboarding Portal",
    selectLanguage: "Select Your Preferred Language",
    continue: "Continue",
    englishLabel: "English",
    englishHint: "Continue in English",
    urduLabel: "Urdu",
    urduHint: "اردو میں جاری رکھیں",
  },
  ur: {
    welcomeTitle: "خوش آمدید",
    welcomeMessage: "ڈیسکون انجینئرنگ مین پاور آن بورڈنگ پورٹل",
    selectLanguage: "اپنی پسندیدہ زبان منتخب کریں",
    continue: "جاری رکھیں",
    englishLabel: "English",
    englishHint: "Continue in English",
    urduLabel: "اردو",
    urduHint: "اردو میں جاری رکھیں",
  },
};

function LanguageCard({ active, flag, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border-2 px-5 py-4 text-left transition ${
        active
          ? "border-[#0066CC] bg-[#F0F9FF]"
          : "border-gray-200 bg-[#F6F6F6] hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl">{flag}</div>
        <div>
          <div className="text-base font-semibold text-black">{label}</div>
          <div className="text-sm text-gray-500">{hint}</div>
        </div>
      </div>
      {active ? (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066CC] text-sm font-bold text-white">
          ✓
        </div>
      ) : null}
    </button>
  );
}

export default function Page() {
  const [language, setLanguage] = useState("en");
  const t = translations[language];

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 pb-8 pt-16">
        <div className="mb-12 flex justify-center">
          <img
            src="https://ucarecdn.com/26b1d36a-12cf-4efa-853d-08da75f95d7e/-/format/auto/"
            alt="Descon"
            className="h-16 w-44 object-contain"
          />
        </div>

        <section className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-semibold text-black">
            {t.welcomeTitle}
          </h1>
          <p className="text-base leading-7 text-gray-500">
            {t.welcomeMessage}
          </p>
        </section>

        <section className="mb-12">
          <p className="mb-4 text-center text-sm font-medium text-black">
            {t.selectLanguage}
          </p>
          <div className="space-y-3">
            <LanguageCard
              active={language === "en"}
              flag="🇬🇧"
              label={t.englishLabel}
              hint={t.englishHint}
              onClick={() => setLanguage("en")}
            />
            <LanguageCard
              active={language === "ur"}
              flag="🇵🇰"
              label={t.urduLabel}
              hint={t.urduHint}
              onClick={() => setLanguage("ur")}
            />
          </div>
        </section>

        <div className="flex-1" />

        <a
          href="/login"
          className="rounded-xl bg-[#0066CC] px-6 py-4 text-center text-base font-semibold text-white shadow-[0_10px_30px_rgba(0,102,204,0.18)] transition hover:bg-[#0057AD]"
        >
          {t.continue}
        </a>

        <p className="mt-6 text-center text-xs text-gray-400">
          Descon Engineering Limited
        </p>
      </div>
    </main>
  );
}
