import { useMemo, useState } from 'react';
import type { AllowedWorkflowTransition, WorkflowTransitionField } from '../../../../../../shared/adminWorkflow/types';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Button, ConfirmDialog, Input, ValidationMessage } from '../../../../design-system';
import { toWorkflowBlockingReason, WORKFLOW_BLOCKING_REASON_KEYS } from '../../../../../../shared/adminWorkflow/blockingReasons';

const FIELD_LABEL_KEYS: Record<string, TranslationKey> = {
  medical_appointment_date: 'adminWorkflowMedicalAppointmentDateLabel',
  medical_outcome_code: 'adminWorkflowMedicalOutcomeLabel',
  medical_result_date: 'adminWorkflowMedicalResultDateLabel',
  e_number: 'adminWorkflowENumberLabel',
  e_number_received_on: 'adminWorkflowENumberReceivedOnLabel',
  biometric_completed_on: 'adminWorkflowBiometricCompletedOnLabel',
  protection_call_status: 'adminWorkflowProtectionCallStatusLabel',
  protection_call_on: 'adminWorkflowProtectionCallOnLabel',
  ticket_handed_over_on: 'adminWorkflowTicketHandedOverOnLabel',
  ticket_reference: 'adminWorkflowTicketReferenceLabel',
};

const ENUM_VALUE_KEYS: Record<string, TranslationKey> = {
  fit: 'adminWorkflowMedicalFitOption',
  unfit: 'adminWorkflowMedicalUnfitOption',
  scheduled: 'adminWorkflowProtectionCallScheduledOption',
  completed: 'adminWorkflowProtectionCallCompletedOption',
};

interface GenericTransitionCardProps {
  transition: AllowedWorkflowTransition;
  canTransition: boolean;
  currentStageCode: string | undefined;
  isSubmitting: boolean;
  conflictMessage?: string;
  nonFieldError?: string;
  onSubmit: (toStageCode: string, currentStageCode: string | undefined, evidence: Record<string, string>) => void;
}

function inputType(field: WorkflowTransitionField): 'date' | 'datetime-local' | 'text' {
  if (field.type === 'iso_date') return 'date';
  if (field.type === 'iso_datetime') return 'datetime-local';
  return 'text';
}

function fieldLabelKey(fieldName: string): TranslationKey {
  return FIELD_LABEL_KEYS[fieldName] ?? 'adminWorkflowUnsupportedAction';
}

function enumValueLabel(value: string, t: (key: TranslationKey) => string): string {
  const key = ENUM_VALUE_KEYS[value];
  return key ? t(key) : value;
}

export function GenericTransitionCard({
  transition,
  canTransition,
  currentStageCode,
  isSubmitting,
  conflictMessage,
  nonFieldError,
  onSubmit,
}: GenericTransitionCardProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const supportedFields = transition.fields.every((field) => field.type !== 'unknown' && FIELD_LABEL_KEYS[field.name]);
  const ownEvidenceReasons = useMemo(
    () => new Set(transition.fields.filter((field) => field.required).map((field) => `${field.name}_required`)),
    [transition.fields]
  );
  const genuineBlockingReasons = transition.blockingReasons.filter((reason) => !ownEvidenceReasons.has(reason));
  const canAttempt = supportedFields && (transition.allowed || genuineBlockingReasons.length === 0);

  const close = () => {
    setOpen(false);
    setValues({});
    setMissingFields([]);
  };

  const confirm = () => {
    const missing = transition.fields
      .filter((field) => field.required && !values[field.name]?.trim())
      .map((field) => field.name);
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    setMissingFields([]);
    onSubmit(transition.code, currentStageCode, values);
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-text-primary">{transition.name}</div>
          <p className="mt-1 text-sm text-text-secondary">{t('adminWorkflowGenericTransitionDescription')}</p>
        </div>
        {canAttempt && canTransition ? (
          <Button type="button" onClick={() => setOpen(true)}>
            {t('adminWorkflowGenericTransitionAction')}
          </Button>
        ) : null}
      </div>

      {genuineBlockingReasons.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {genuineBlockingReasons.map((reason) => (
            <li key={reason}>
              <ValidationMessage tone="error">
                {t(WORKFLOW_BLOCKING_REASON_KEYS[toWorkflowBlockingReason(reason)] as TranslationKey)}
              </ValidationMessage>
            </li>
          ))}
        </ul>
      ) : null}
      {!supportedFields ? <ValidationMessage tone="error">{t('adminWorkflowUnsupportedAction')}</ValidationMessage> : null}
      {canAttempt && !canTransition ? (
        <p className="mt-3 text-xs text-text-tertiary">{t('adminWorkflowViewOnlyNotice')}</p>
      ) : null}

      <ConfirmDialog
        open={open}
        onOpenChange={(nextOpen) => (!nextOpen ? close() : undefined)}
        title={transition.name}
        description={t('adminWorkflowGenericTransitionConfirmDescription')}
        confirmLabel={t('adminWorkflowGenericTransitionAction')}
        cancelLabel={t('adminWorkflowCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={confirm}
        isConfirming={isSubmitting}
      >
        <div className="space-y-4">
          {transition.fields.map((field) =>
            field.type === 'enum' ? (
              <label key={field.name} className="block text-sm text-text-primary">
                <span className="mb-1 block">{t(fieldLabelKey(field.name))}</span>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={values[field.name] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                >
                  <option value="">{t('adminWorkflowSelectOption')}</option>
                  {field.values.map((value) => (
                    <option key={value} value={value}>
                      {enumValueLabel(value, t)}
                    </option>
                  ))}
                </select>
                {missingFields.includes(field.name) ? (
                  <span className="mt-1 block text-xs text-danger">{t('adminWorkflowRequiredFieldError')}</span>
                ) : null}
              </label>
            ) : (
              <Input
                key={field.name}
                type={inputType(field)}
                label={t(fieldLabelKey(field.name))}
                value={values[field.name] ?? ''}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                errorMessage={missingFields.includes(field.name) ? t('adminWorkflowRequiredFieldError') : undefined}
              />
            )
          )}
          {conflictMessage ? <ValidationMessage tone="error">{conflictMessage}</ValidationMessage> : null}
          {nonFieldError ? <ValidationMessage tone="error">{nonFieldError}</ValidationMessage> : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
