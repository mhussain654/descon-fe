import { useLanguage } from '../../../../contexts/LanguageContext';
import { TrainingSettingForm } from './TrainingSettingForm';

/** Page chrome (title/subtitle) around TrainingSettingForm -- mirrors AiCallOperationalSettingsPage.tsx's identical outer structure. */
export function TrainingSettingPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminTrainingSettingTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('adminTrainingSettingSubtitle')}</p>
      </div>

      <TrainingSettingForm />
    </div>
  );
}
