import { useLanguage } from '../../../../contexts/LanguageContext';
import { AiCallOperationalSettingsForm } from './AiCallOperationalSettingsForm';
import { Settings2 } from 'lucide-react';

/** Page chrome (title/subtitle) around AiCallOperationalSettingsForm -- mirrors CommunicationList.tsx/WorkflowStageCallScriptList.tsx's identical outer structure. */
export function AiCallOperationalSettingsPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4 px-6 py-7 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <Settings2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="max-w-3xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminAiCallSettingsEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminAiCallSettingsTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('adminAiCallSettingsSubtitle')}</p>
          </div>
        </div>
      </div>

      <AiCallOperationalSettingsForm />
    </div>
  );
}
