import { Input } from '../../../design-system';
import type { RegisteredDateRange } from '../../../../../shared/adminCandidates/registeredDates';
import type { TranslationKey } from '../../../../../shared/i18n/translations';

interface RegisteredDateRangeInputsProps {
  value: RegisteredDateRange;
  onChange: (patch: RegisteredDateRange) => void;
  t: (key: TranslationKey) => string;
}

/**
 * "Registered from / to": the day candidates were added or imported, in
 * Pakistan time. Candidates arrive in import batches, so this picks out one
 * batch on any admin list, dashboard or report. Two grid cells, so it lines up
 * with the page's other filter fields.
 */
export function RegisteredDateRangeInputs({ value, onChange, t }: RegisteredDateRangeInputsProps) {
  return (
    <>
      <Input
        type="date"
        label={t('adminRegisteredFromLabel')}
        value={value.registeredFrom ?? ''}
        max={value.registeredTo}
        onChange={(event) => onChange({ registeredFrom: event.target.value || undefined })}
      />
      <Input
        type="date"
        label={t('adminRegisteredToLabel')}
        value={value.registeredTo ?? ''}
        min={value.registeredFrom}
        onChange={(event) => onChange({ registeredTo: event.target.value || undefined })}
      />
    </>
  );
}
