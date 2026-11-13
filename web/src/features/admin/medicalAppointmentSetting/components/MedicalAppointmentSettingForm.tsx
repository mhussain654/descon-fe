import { useEffect, useState } from 'react';
import { Save, Stethoscope } from 'lucide-react';
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
  Textarea,
  ValidationMessage,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { AdminMedicalAppointmentSettingUpdateInput } from '../../../../lib/admin-medical-appointment-setting-client';
import { useMedicalAppointmentSetting } from '../hooks/useMedicalAppointmentSetting';
import { useUpdateMedicalAppointmentSetting } from '../hooks/useUpdateMedicalAppointmentSetting';

/**
 * The default medical appointment (centre, address, date, time) filled in when
 * staff move a candidate into a medical appointment stage. Staff can still change
 * them for that candidate, and each move keeps its own copy -- so saving here only
 * affects candidates moved afterwards. Always directly editable, like SupportSettingForm.
 */
export function MedicalAppointmentSettingForm() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useMedicalAppointmentSetting();
  const mutation = useUpdateMedicalAppointmentSetting();
  const [values, setValues] = useState<AdminMedicalAppointmentSettingUpdateInput | null>(null);

  useEffect(() => {
    if (query.data && values === null) {
      setValues({
        centerName: query.data.centerName ?? '',
        centerAddress: query.data.centerAddress ?? '',
        appointmentOn: query.data.appointmentOn ?? '',
        appointmentTime: query.data.appointmentTime ?? '',
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
  const update = (field: keyof AdminMedicalAppointmentSettingUpdateInput) => (value: string) =>
    setValues((current) => (current ? { ...current, [field]: value } : current));
  const errorMessage = mutation.isError && mutation.error.code === 'VALIDATION_FAILED' ? mutation.error.message : undefined;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-border-subtle bg-surface-sunken px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
          <Stethoscope className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-text-primary">{t('adminMedicalAppointmentSettingCardTitle')}</h2>
          <p className="text-xs text-text-secondary">{t('adminMedicalAppointmentSettingCardDescription')}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <Input
          label={t('adminWorkflowMedicalCenterNameLabel')}
          value={values.centerName}
          maxLength={150}
          onChange={(event) => update('centerName')(event.target.value)}
        />
        <Textarea
          label={t('adminWorkflowMedicalCenterAddressLabel')}
          value={values.centerAddress}
          maxLength={500}
          rows={2}
          onChange={(event) => update('centerAddress')(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label={t('adminWorkflowMedicalAppointmentDateLabel')}
            value={values.appointmentOn}
            onChange={(event) => update('appointmentOn')(event.target.value)}
          />
          <Input
            type="time"
            label={t('adminWorkflowMedicalAppointmentTimeLabel')}
            value={values.appointmentTime}
            onChange={(event) => update('appointmentTime')(event.target.value)}
          />
        </div>
        <HelperText>{t('adminMedicalAppointmentSettingHelper')}</HelperText>

        {errorMessage ? <ValidationMessage>{errorMessage}</ValidationMessage> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <HelperText>
            {t('adminAiCallSettingsUpdatedBy')}:{' '}
            {settings.updatedBy ? `${settings.updatedBy.role} (${settings.updatedBy.id})` : t('adminCommunicationSystemActor')} ·{' '}
            {formatDate(settings.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
          </HelperText>
          <Button onClick={() => mutation.mutate(values)} loading={mutation.isPending}>
            <Save className="me-1.5 h-4 w-4" aria-hidden="true" />
            {t('adminMedicalAppointmentSettingSaveAction')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
