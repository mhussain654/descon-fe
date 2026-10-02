import { useLanguage } from '../../../../contexts/LanguageContext';
import { SupportSettingForm } from './SupportSettingForm';
import { Headphones } from 'lucide-react';

/** Page chrome (title/subtitle) around SupportSettingForm -- mirrors AiCallOperationalSettingsPage.tsx's identical outer structure. */
export function SupportSettingPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md"><div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" /><div className="relative flex items-center gap-4 px-6 py-7 lg:px-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white"><Headphones className="h-5 w-5" /></div><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminSupportSettingEyebrow')}</p><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminSupportSettingTitle')}</h1><p className="mt-1 text-sm text-white/80">{t('adminSupportSettingSubtitle')}</p></div></div></div>

      <SupportSettingForm />
    </div>
  );
}
