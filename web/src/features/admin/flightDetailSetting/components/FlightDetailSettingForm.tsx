import { useEffect, useState } from 'react';
import { Plane, Save } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import {
  Button,
  Card,
  ErrorState,
  ForbiddenState,
  HelperText,
  Input,
  LoadingState,
  OfflineState,
  ValidationMessage,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { AdminFlightDetailSettingUpdateInput } from '../../../../lib/admin-flight-detail-setting-client';
import { useFlightDetailSetting } from '../hooks/useFlightDetailSetting';
import { useUpdateFlightDetailSetting } from '../hooks/useUpdateFlightDetailSetting';

/**
 * The default flight details (airline, flight number, sector, departure date and
 * time) filled in when staff add a candidate's flight details. Staff can still
 * change them for that candidate, and each candidate keeps their own copy -- so
 * saving here only affects flight details added afterwards. Same shape as
 * MedicalAppointmentSettingForm.
 */
export function FlightDetailSettingForm() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useFlightDetailSetting();
  const mutation = useUpdateFlightDetailSetting();
  const [values, setValues] = useState<AdminFlightDetailSettingUpdateInput | null>(null);

  useEffect(() => {
    if (query.data && values === null) {
      setValues({
        airline: query.data.airline ?? '',
        flightNumber: query.data.flightNumber ?? '',
        sector: query.data.sector ?? '',
        departureOn: query.data.departureOn ?? '',
        departureTime: query.data.departureTime ?? '',
      });
    }
  }, [query.data, values]);

  useEffect(() => {
    const code = query.error?.code ?? mutation.error?.code;
    if (code === 'SESSION_EXPIRED') signOut('expired');
    else if (code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, mutation.error, signOut]);

  if (query.isLoading) return <LoadingState message={t('loading')} />;

  if (query.isError) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
    }
    if (error?.code === 'FORBIDDEN') return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') return null;
    return <ErrorState message={error?.message || t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  if (values === null || !query.data) return null;

  const settings = query.data;
  const update = (field: keyof AdminFlightDetailSettingUpdateInput) => (value: string) =>
    setValues((current) => (current ? { ...current, [field]: value } : current));
  const errorMessage = mutation.isError && mutation.error.code === 'VALIDATION_FAILED' ? mutation.error.message : undefined;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-border-subtle bg-surface-sunken px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
          <Plane className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-text-primary">{t('adminFlightDetailSettingCardTitle')}</h2>
          <p className="text-xs text-text-secondary">{t('adminFlightDetailSettingCardDescription')}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <Input
          label={t('adminWorkflowFlightAirlineLabel')}
          value={values.airline}
          maxLength={100}
          onChange={(event) => update('airline')(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('adminWorkflowFlightNumberLabel')}
            value={values.flightNumber}
            maxLength={100}
            onChange={(event) => update('flightNumber')(event.target.value)}
          />
          <Input
            label={t('adminWorkflowFlightSectorLabel')}
            placeholder={t('adminWorkflowFlightSectorPlaceholder')}
            value={values.sector}
            maxLength={100}
            onChange={(event) => update('sector')(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label={t('adminFlightDetailSettingDepartureDateLabel')}
            value={values.departureOn}
            onChange={(event) => update('departureOn')(event.target.value)}
          />
          <Input
            type="time"
            label={t('adminFlightDetailSettingDepartureTimeLabel')}
            value={values.departureTime}
            onChange={(event) => update('departureTime')(event.target.value)}
          />
        </div>
        <HelperText>{t('adminFlightDetailSettingHelper')}</HelperText>

        {errorMessage ? <ValidationMessage>{errorMessage}</ValidationMessage> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <HelperText>
            {t('adminAiCallSettingsUpdatedBy')}:{' '}
            {settings.updatedBy ? `${settings.updatedBy.role} (${settings.updatedBy.id})` : t('adminCommunicationSystemActor')} ·{' '}
            {formatDate(settings.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
          </HelperText>
          <Button onClick={() => mutation.mutate(values)} loading={mutation.isPending}>
            <Save className="me-1.5 h-4 w-4" aria-hidden="true" />
            {t('adminFlightDetailSettingSaveAction')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
