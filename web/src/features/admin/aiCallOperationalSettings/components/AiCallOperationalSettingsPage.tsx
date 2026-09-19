import { useLanguage } from '../../../../contexts/LanguageContext';
import { AiCallOperationalSettingsForm } from './AiCallOperationalSettingsForm';

/** Page chrome (title/subtitle) around AiCallOperationalSettingsForm -- mirrors CommunicationList.tsx/WorkflowStageCallScriptList.tsx's identical outer structure. */
export function AiCallOperationalSettingsPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminAiCallSettingsTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('adminAiCallSettingsSubtitle')}</p>
      </div>

      <AiCallOperationalSettingsForm />
    </div>
  );
}
