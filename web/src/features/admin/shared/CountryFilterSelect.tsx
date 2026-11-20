import { Select } from '../../../design-system';
import { useCountries } from '../candidates/hooks/useReferenceData';
import type { TranslationKey } from '../../../../../shared/i18n/translations';

interface CountryFilterSelectProps {
  value?: string;
  onChange: (countryCode: string | undefined) => void;
  t: (key: TranslationKey) => string;
}

/** The destination-country filter, alongside the registered date range: each import batch goes to one country. */
export function CountryFilterSelect({ value, onChange, t }: CountryFilterSelectProps) {
  const countriesQuery = useCountries();
  return (
    <Select
      label={t('adminCandidateListFilterCountryLabel')}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || undefined)}
      options={[
        { value: '', label: t('adminCandidateListFilterAllCountries') },
        ...(countriesQuery.data ?? []).map((item) => ({ value: item.code, label: item.name })),
      ]}
    />
  );
}
