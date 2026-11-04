// The translated name of each SMS message (e.g. `visa_issued` ->
// adminAppSettingsSmsVisaIssued), shared by the SMS settings tab and the
// candidate page's SMS tab.
import type { TranslationKey } from '../i18n/translations';

export function smsMessageLabelKey(code: string): TranslationKey {
  const camel = code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return `adminAppSettingsSms${camel.charAt(0).toUpperCase()}${camel.slice(1)}` as TranslationKey;
}

/** The translated name of a template value (e.g. `country`), falling back to the raw name. */
export function smsVariableLabelKey(variable: string): TranslationKey {
  const camel = variable.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return `adminCandidateSmsValue${camel.charAt(0).toUpperCase()}${camel.slice(1)}` as TranslationKey;
}
