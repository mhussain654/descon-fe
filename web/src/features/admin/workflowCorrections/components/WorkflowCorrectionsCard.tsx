import { useEffect, useState, type ReactNode } from 'react';
import { CalendarClock, FileCheck2, Pencil, Plane, Stethoscope } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Button, Card, ConfirmDialog, ErrorState, Input, LoadingState, Textarea, ValidationMessage } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type {
  AppointmentValues,
  FlightValues,
  VisaCopyValues,
  WorkflowCorrectionBlockedReason,
  WorkflowCorrectionBox,
  WorkflowCorrectionKind,
} from '../../../../lib/admin-workflow-corrections-client';
import { useSubmitWorkflowCorrection, useWorkflowCorrections } from '../hooks/useWorkflowCorrections';

const BLOCKED_KEYS: Record<WorkflowCorrectionBlockedReason, TranslationKey> = {
  not_recorded: 'adminWorkflowCorrectionBlockedNotRecorded',
  past_medical: 'adminWorkflowCorrectionBlockedPastMedical',
  qvc_result_recorded: 'adminWorkflowCorrectionBlockedQvcResultRecorded',
  mobilized: 'adminWorkflowCorrectionBlockedMobilized',
  visa_rejected: 'adminWorkflowCorrectionBlockedVisaRejected',
};

const DIALOG_TITLE_KEYS: Record<WorkflowCorrectionKind, TranslationKey> = {
  medicalAppointment: 'adminWorkflowCorrectionDialogMedicalTitle',
  qvcAppointment: 'adminWorkflowCorrectionDialogQvcTitle',
  flightDetail: 'adminWorkflowCorrectionDialogFlightTitle',
  visaCopy: 'adminWorkflowCorrectionDialogVisaTitle',
};

const RECENT_CHANGES_SHOWN = 3;

/**
 * Developer-only boxes on the candidate Overview tab for correcting the
 * recorded medical appointment, QVC appointment and flight details, and
 * replacing the visa copy, without moving the candidate. A box's Change button
 * stays visible but disabled once the candidate is past that step (medically
 * fit, QVC result recorded, mobilized, visa rejected), with the reason shown.
 * Renders nothing for other roles.
 */
export function WorkflowCorrectionsCard({ candidateId }: { candidateId: string }) {
  const { t } = useLanguage();
  const { hasPermission } = useStaffAuth();
  const canCorrect = hasPermission('correct_workflow_details');
  const query = useWorkflowCorrections(candidateId, canCorrect);
  const [editing, setEditing] = useState<WorkflowCorrectionKind | null>(null);

  if (!canCorrect) return null;

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary">{t('adminWorkflowCorrectionsTitle')}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t('adminWorkflowCorrectionsDescription')}</p>
      </div>
      {query.isLoading ? <LoadingState message={t('loading')} /> : null}
      {query.isError ? (
        <ErrorState message={query.error?.message || t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
      ) : null}
      {query.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <CorrectionBox
              icon={<Stethoscope className="h-4 w-4" aria-hidden="true" />}
              title={t('adminWorkflowCorrectionMedicalTitle')}
              box={query.data.medicalAppointment}
              onChange={() => setEditing('medicalAppointment')}
            >
              <AppointmentLines values={query.data.medicalAppointment.values} />
            </CorrectionBox>
            <CorrectionBox
              icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
              title={t('adminWorkflowCorrectionQvcTitle')}
              box={query.data.qvcAppointment}
              onChange={() => setEditing('qvcAppointment')}
            >
              <AppointmentLines values={query.data.qvcAppointment.values} />
            </CorrectionBox>
            <CorrectionBox
              icon={<Plane className="h-4 w-4" aria-hidden="true" />}
              title={t('adminWorkflowCorrectionFlightTitle')}
              box={query.data.flightDetail}
              onChange={() => setEditing('flightDetail')}
            >
              <FlightLines values={query.data.flightDetail.values} />
            </CorrectionBox>
            <CorrectionBox
              icon={<FileCheck2 className="h-4 w-4" aria-hidden="true" />}
              title={t('adminWorkflowCorrectionVisaTitle')}
              box={query.data.visaCopy}
              onChange={() => setEditing('visaCopy')}
            >
              <VisaCopyLines values={query.data.visaCopy.values} />
            </CorrectionBox>
          </div>
          <CorrectionDialog
            candidateId={candidateId}
            kind={editing}
            appointment={
              editing === 'qvcAppointment' ? query.data.qvcAppointment.values : query.data.medicalAppointment.values
            }
            flight={query.data.flightDetail.values}
            onClose={() => setEditing(null)}
          />
        </>
      ) : null}
    </Card>
  );
}

function CorrectionBox<Values>({
  icon,
  title,
  box,
  onChange,
  children,
}: {
  icon: ReactNode;
  title: string;
  box: WorkflowCorrectionBox<Values>;
  onChange: () => void;
  children: ReactNode;
}) {
  const { t, language } = useLanguage();
  const hintId = `${title.replace(/\W+/g, '-').toLowerCase()}-blocked`;

  return (
    <section aria-label={title} className="flex flex-col rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-subtle text-brand">{icon}</span>
        <h3 className="font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="flex-1 space-y-1 text-sm text-text-primary">
        {box.blockedReason === 'not_recorded' ? <p className="text-text-secondary">{t('adminWorkflowCorrectionNothingRecorded')}</p> : children}
      </div>
      <div className="mt-4">
        <Button type="button" variant="outline" size="sm" disabled={!box.editable} onClick={onChange} aria-describedby={box.blockedReason ? hintId : undefined}>
          <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('adminWorkflowCorrectionChangeAction')}
        </Button>
        {box.blockedReason ? (
          <p id={hintId} className="mt-2 text-xs text-text-tertiary">
            {t(BLOCKED_KEYS[box.blockedReason])}
          </p>
        ) : null}
      </div>
      {box.recentChanges.length > 0 ? (
        <div className="mt-4 border-t border-border-subtle pt-3">
          <p className="mb-1 text-xs font-medium text-text-tertiary">{t('adminWorkflowCorrectionRecentTitle')}</p>
          <ul className="space-y-1">
            {box.recentChanges.slice(0, RECENT_CHANGES_SHOWN).map((change) => (
              <li key={change.occurredAt} className="text-xs text-text-secondary">
                {formatDate(change.occurredAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
                {change.reason ? ` · ${change.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p>
      <span className="text-text-secondary">{label}: </span>
      {value}
    </p>
  );
}

function AppointmentLines({ values }: { values: AppointmentValues }) {
  const { t, language } = useLanguage();
  return (
    <>
      <Line label={t('adminWorkflowCorrectionCentreLabel')} value={values.centerName} />
      <Line label={t('adminWorkflowCorrectionAddressLabel')} value={values.centerAddress} />
      <Line label={t('adminWorkflowCorrectionDateLabel')} value={values.appointmentDate ? formatDate(values.appointmentDate, language, { dateStyle: 'medium' }) : null} />
      <Line label={t('adminWorkflowCorrectionTimeLabel')} value={values.appointmentTime} />
    </>
  );
}

/** The departure as the Pakistan date and time it was entered in (the value carries +05:00). */
function pakistanLocal(value: string | null): string {
  return value ? value.slice(0, 16) : '';
}

function FlightLines({ values }: { values: FlightValues }) {
  const { t, language } = useLanguage();
  const local = pakistanLocal(values.flightDate);
  return (
    <>
      <Line label={t('adminWorkflowFlightAirlineLabel')} value={[values.airline, values.flightNumber].filter(Boolean).join(' ') || null} />
      <Line label={t('adminWorkflowFlightSectorLabel')} value={values.sector} />
      <Line
        label={t('adminWorkflowFlightDepartureLabel')}
        value={local ? `${formatDate(local.slice(0, 10), language, { dateStyle: 'medium' })} ${local.slice(11)}` : null}
      />
    </>
  );
}

function VisaCopyLines({ values }: { values: VisaCopyValues }) {
  const { t, language } = useLanguage();
  const missing = values.hasVisaCopy && values.visaCopyStored === false;
  let copy = t('adminWorkflowCorrectionVisaCopyNone');
  if (values.hasVisaCopy) copy = missing ? t('adminWorkflowCorrectionVisaCopyMissing') : t('adminWorkflowCorrectionVisaCopyStored');
  return (
    <>
      <Line label={t('adminWorkflowCorrectionDateLabel')} value={values.decisionDate ? formatDate(values.decisionDate, language, { dateStyle: 'medium' }) : null} />
      <p className={missing ? 'font-medium text-danger' : undefined}>
        <span className="text-text-secondary">{t('adminWorkflowCorrectionVisaCopyLabel')}: </span>
        {copy}
      </p>
    </>
  );
}

interface FormValues {
  centerName: string;
  centerAddress: string;
  appointmentDate: string;
  appointmentTime: string;
  airline: string;
  flightNumber: string;
  sector: string;
  flightDate: string;
}

function initialValues(appointment: AppointmentValues, flight: FlightValues): FormValues {
  return {
    centerName: appointment.centerName ?? '',
    centerAddress: appointment.centerAddress ?? '',
    appointmentDate: appointment.appointmentDate ?? '',
    appointmentTime: appointment.appointmentTime ?? '',
    airline: flight.airline ?? '',
    flightNumber: flight.flightNumber ?? '',
    sector: flight.sector ?? '',
    flightDate: pakistanLocal(flight.flightDate),
  };
}

function CorrectionDialog({
  candidateId,
  kind,
  appointment,
  flight,
  onClose,
}: {
  candidateId: string;
  kind: WorkflowCorrectionKind | null;
  appointment: AppointmentValues;
  flight: FlightValues;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const mutation = useSubmitWorkflowCorrection(candidateId);
  const [values, setValues] = useState<FormValues>(() => initialValues(appointment, flight));
  const [reason, setReason] = useState('');
  const [notifyCandidate, setNotifyCandidate] = useState(true);
  const [ticket, setTicket] = useState<File | null>(null);
  const [visaCopy, setVisaCopy] = useState<File | null>(null);
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  const [visaCopyError, setVisaCopyError] = useState<string | undefined>(undefined);

  // Fresh form each time a box is opened, filled in with its current values.
  useEffect(() => {
    if (!kind) return;
    setValues(initialValues(appointment, flight));
    setReason('');
    setNotifyCandidate(true);
    setTicket(null);
    setVisaCopy(null);
    setReasonError(undefined);
    setVisaCopyError(undefined);
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when a box opens
  }, [kind]);

  const set = (field: keyof FormValues) => (value: string) => setValues((current) => ({ ...current, [field]: value }));

  const close = (open: boolean) => {
    if (!open && !mutation.isPending) onClose();
  };

  const submit = () => {
    if (!kind) return;
    const missingReason = !reason.trim();
    const missingVisaCopy = kind === 'visaCopy' && !visaCopy;
    setReasonError(missingReason ? t('adminWorkflowCorrectionReasonRequired') : undefined);
    setVisaCopyError(missingVisaCopy ? t('adminWorkflowCorrectionVisaFileRequired') : undefined);
    if (missingReason || missingVisaCopy) return;
    const common = { candidateId, reason, notifyCandidate };
    const options = { onSuccess: () => onClose() };
    if (kind === 'visaCopy') {
      if (visaCopy) mutation.mutate({ kind, input: { candidateId, reason, visaCopy } }, options);
    } else if (kind === 'flightDetail') {
      mutation.mutate(
        { kind, input: { ...common, airline: values.airline, flightNumber: values.flightNumber, sector: values.sector, flightDate: values.flightDate, ticket } },
        options
      );
    } else {
      mutation.mutate(
        { kind, input: { ...common, centerName: values.centerName, centerAddress: values.centerAddress, appointmentDate: values.appointmentDate, appointmentTime: values.appointmentTime } },
        options
      );
    }
  };

  const error = mutation.error;
  const errorMessage = error ? error.message || t('somethingWentWrong') : undefined;

  return (
    <ConfirmDialog
      open={kind !== null}
      onOpenChange={close}
      title={kind ? t(DIALOG_TITLE_KEYS[kind]) : ''}
      description={t('adminWorkflowCorrectionDialogDescription')}
      confirmLabel={t('adminWorkflowCorrectionSaveAction')}
      cancelLabel={t('adminWorkflowCancelAction')}
      closeLabel={t('dsClose')}
      onConfirm={submit}
      isConfirming={mutation.isPending}
    >
      <div className="space-y-4">
        {kind === 'visaCopy' ? (
          <Input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            label={t('adminWorkflowCorrectionVisaFileLabel')}
            onChange={(event) => setVisaCopy(event.target.files?.[0] ?? null)}
            errorMessage={visaCopyError}
          />
        ) : null}
        {kind === 'flightDetail' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t('adminWorkflowFlightAirlineLabel')} value={values.airline} maxLength={100} onChange={(event) => set('airline')(event.target.value)} />
              <Input label={t('adminWorkflowFlightNumberLabel')} value={values.flightNumber} maxLength={100} onChange={(event) => set('flightNumber')(event.target.value)} />
            </div>
            <Input
              label={t('adminWorkflowFlightSectorLabel')}
              placeholder={t('adminWorkflowFlightSectorPlaceholder')}
              value={values.sector}
              maxLength={100}
              onChange={(event) => set('sector')(event.target.value)}
            />
            <Input type="datetime-local" label={t('adminWorkflowFlightDepartureLabel')} value={values.flightDate} onChange={(event) => set('flightDate')(event.target.value)} />
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              label={t('adminWorkflowCorrectionTicketLabel')}
              onChange={(event) => setTicket(event.target.files?.[0] ?? null)}
            />
          </>
        ) : null}
        {kind === 'medicalAppointment' || kind === 'qvcAppointment' ? (
          <>
            <Input label={t('adminWorkflowCorrectionCentreLabel')} value={values.centerName} maxLength={150} onChange={(event) => set('centerName')(event.target.value)} />
            <Textarea
              label={t('adminWorkflowCorrectionAddressLabel')}
              value={values.centerAddress}
              maxLength={500}
              rows={2}
              onChange={(event) => set('centerAddress')(event.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input type="date" label={t('adminWorkflowCorrectionDateLabel')} value={values.appointmentDate} onChange={(event) => set('appointmentDate')(event.target.value)} />
              <Input type="time" label={t('adminWorkflowCorrectionTimeLabel')} value={values.appointmentTime} onChange={(event) => set('appointmentTime')(event.target.value)} />
            </div>
          </>
        ) : null}
        <Textarea
          label={t('adminWorkflowCorrectionReasonLabel')}
          placeholder={t('adminWorkflowCorrectionReasonPlaceholder')}
          value={reason}
          maxLength={500}
          rows={2}
          onChange={(event) => setReason(event.target.value)}
          errorMessage={reasonError}
        />
        {kind === 'visaCopy' ? (
          <p className="text-sm text-text-secondary">{t('adminWorkflowCorrectionVisaNoSms')}</p>
        ) : (
          <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
            <input type="checkbox" checked={notifyCandidate} onChange={(event) => setNotifyCandidate(event.target.checked)} className="h-4 w-4 accent-brand" />
            {t('adminWorkflowCorrectionNotifyLabel')}
          </label>
        )}
        {errorMessage ? <ValidationMessage tone="error">{errorMessage}</ValidationMessage> : null}
      </div>
    </ConfirmDialog>
  );
}
