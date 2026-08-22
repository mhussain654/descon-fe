import { useLanguage } from "../../contexts/LanguageContext";

export default function NotFoundPage() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <h1 className="text-2xl font-semibold text-black">{t("notFoundTitle")}</h1>
      <p className="text-base text-gray-500">{t("notFoundMessage")}</p>
      <a
        href="/"
        className="rounded-xl bg-[#0066CC] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#0057AD]"
      >
        {t("goHome")}
      </a>
    </main>
  );
}
