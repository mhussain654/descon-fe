import type { RegisteredDateRange } from '../../../../../shared/adminCandidates/registeredDates';
import type { TranslationKey } from '../../../../../shared/i18n/translations';
import { DateRangeField } from './DateRangeField';

interface RegisteredDateRangeInputsProps {
  value: RegisteredDateRange;
  onChange: (patch: RegisteredDateRange) => void;
  t: (key: TranslationKey) => string;
}

/**
 * "Registration date": the day candidates were added or imported, in
 * Pakistan time. Candidates arrive in import batches, so this picks out one
 * batch on any admin list, dashboard or report. One field holding both dates.
 */
export function RegisteredDateRangeInputs({ value, onChange, t }: RegisteredDateRangeInputsProps) {
  return (
    <DateRangeField
      label={t('adminRegisteredDateLabel')}
      fromLabel={t('adminRegisteredFromLabel')}
      toLabel={t('adminRegisteredToLabel')}
      value={{ from: value.registeredFrom, to: value.registeredTo }}
      onChange={(patch) =>
        onChange('from' in patch ? { registeredFrom: patch.from } : { registeredTo: patch.to })
      }
    />
  );
}
