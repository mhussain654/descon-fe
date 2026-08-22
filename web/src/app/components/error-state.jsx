import { useLanguage } from "../../contexts/LanguageContext";

export default function ErrorState({ message, onRetry }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm text-gray-600">{message ?? t("somethingWentWrong")}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}
