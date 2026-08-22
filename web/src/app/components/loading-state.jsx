import { useLanguage } from "../../contexts/LanguageContext";

export default function LoadingState({ message }) {
  const { t } = useLanguage();
  const text = message ?? t("loading");

  return (
    <div className="flex items-center justify-center py-12 text-sm text-gray-500">
      <div
        className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
        role="status"
        aria-label={text}
      />
      {text}
    </div>
  );
}
