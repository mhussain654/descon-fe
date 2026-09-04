import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Button, Card, ConfirmDialog, Input, Select, Textarea, ValidationMessage } from '../../../../design-system';
import { ADMIN_PAYMENT_ERROR_KEYS } from '../../../../../../shared/adminPayments/errorMessages';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type {
  PaymentCorrectionField,
  PaymentCorrectionRequest,
  PaymentDetail,
  ReconciliationFindingCode,
} from '../../../../lib/admin-payments-client';
import { useCorrectPayment } from '../hooks/useCorrectPayment';

/**
 * Which correction fields make sense for a given finding -- mirrors
 * Admin::Payments::CorrectionService's own allowlist exactly (never offer a
 * choice the backend will reject). `workflow_payment_mismatch` has no safe
 * field-level fix at the payment layer, so only a note-only resolution is
 * offered for it.
 */
const FIELDS_BY_FINDING: Partial<Record<ReconciliationFindingCode, PaymentCorrectionField[]>> = {
  paid_at_missing: ['paid_at'],
  external_reference_missing: ['external_reference'],
  duplicate_external_reference: ['external_reference'],
  terminal_event_conflict: ['status_code'],
  workflow_payment_mismatch: [],
};

const FIELD_LABEL_KEYS: Record<PaymentCorrectionField, TranslationKey> = {
  external_reference: 'adminFinancePaymentCorrectionFieldExternalReference',
  paid_at: 'adminFinancePaymentCorrectionFieldPaidAt',
  status_code: 'adminFinancePaymentCorrectionFieldStatusCode',
};

/** Status values offered depend on context -- 'paid' is only ever offered when correcting a terminal_event_conflict finding (evidence-backed), matching Admin::Payments::CorrectionService::EVIDENCE_BACKED_STATUS_TRANSITIONS/ALLOWED_STATUS_TRANSITIONS exactly. */
function statusValueOptions(findingCode: ReconciliationFindingCode | undefined, t: (key: TranslationKey) => string) {
  if (findingCode === 'terminal_event_conflict') {
    return [{ value: 'paid', label: t('adminFinancePaymentCorrectionStatusValuePaid') }];
  }
  return [
    { value: 'failed', label: t('adminFinancePaymentCorrectionStatusValueFailed') },
    { value: 'cancelled', label: t('adminFinancePaymentCorrectionStatusValueCancelled') },
  ];
}

export interface PaymentCorrectionFormProps {
  payment: PaymentDetail;
  /** Set when this form was opened from a specific finding's action -- ties the resulting correction to that finding, and narrows which fields make sense. */
  findingId?: string;
  findingCode?: ReconciliationFindingCode;
  onDone: () => void;
  onCancel: () => void;
}

export function PaymentCorrectionForm({ payment, findingId, findingCode, onDone, onCancel }: PaymentCorrectionFormProps) {
  const { t } = useLanguage();
  const { correct, resetForNewAttempt, mutation } = useCorrectPayment(payment.id);

  const allowedFields = findingId ? (FIELDS_BY_FINDING[findingCode as ReconciliationFindingCode] ?? []) : (['external_reference', 'paid_at', 'status_code'] as PaymentCorrectionField[]);
  const canNoteOnly = Boolean(findingId);

  const [reason, setReason] = useState('');
  const [field, setField] = useState<PaymentCorrectionField | ''>(allowedFields[0] ?? '');
  const [value, setValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingCorrection, setPendingCorrection] = useState<PaymentCorrectionRequest | null>(null);

  const handleFieldChange = (nextField: PaymentCorrectionField | '') => {
    setField(nextField);
    setValue('');
  };

  const handleReview = () => {
    setFormError(null);
    if (!reason.trim()) {
      setFormError(t('adminFinancePaymentCorrectionReasonRequired'));
      return;
    }
    if (field && !value.trim()) {
      setFormError(t('adminFinancePaymentCorrectionValueRequired'));
      return;
    }

    const normalizedValue = field === 'paid_at' && value ? new Date(value).toISOString() : value || undefined;
    setPendingCorrection({
      reason: reason.trim(),
      expectedUpdatedAt: payment.updatedAt,
      findingId,
      field: field || undefined,
      value: normalizedValue,
    });
  };

  const handleConfirm = () => {
    if (!pendingCorrection) return;
    correct(pendingCorrection);
  };

  // ConfirmDialog only calls onOpenChange for a user-driven close (ESC,
  // overlay click, its own Cancel/X) -- a successful mutation doesn't close
  // it by itself, so this closes the dialog and hands control back to the
  // caller (refreshed data is already visible behind it) the moment the
  // correction actually succeeds.
  useEffect(() => {
    if (!mutation.isSuccess || !pendingCorrection) return;
    setPendingCorrection(null);
    resetForNewAttempt();
    onDone();
  }, [mutation.isSuccess, pendingCorrection, resetForNewAttempt, onDone]);

  const handleDialogOpenChange = (open: boolean) => {
    if (open) return;
    setPendingCorrection(null);
  };

  const correctionErrorMessage = mutation.error
    ? mutation.error.message ?? t(ADMIN_PAYMENT_ERROR_KEYS[mutation.error.code] as TranslationKey)
    : null;

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('adminFinancePaymentCorrectionFormTitle')}</h2>

      <div className="space-y-4">
        <Textarea
          label={t('adminFinancePaymentCorrectionReasonLabel')}
          placeholder={t('adminFinancePaymentCorrectionReasonPlaceholder')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />

        <Select
          label={t('adminFinancePaymentCorrectionFieldLabel')}
          value={field}
          onChange={(event) => handleFieldChange(event.target.value as PaymentCorrectionField | '')}
          options={[
            ...(canNoteOnly ? [{ value: '', label: t('adminFinancePaymentCorrectionFieldNone') }] : []),
            ...allowedFields.map((option) => ({ value: option, label: t(FIELD_LABEL_KEYS[option]) })),
          ]}
        />

        {field === 'external_reference' ? (
          <Input label={t('adminFinancePaymentCorrectionValueLabel')} value={value} onChange={(event) => setValue(event.target.value)} />
        ) : null}
        {field === 'paid_at' ? (
          <Input
            type="datetime-local"
            label={t('adminFinancePaymentCorrectionValueLabel')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : null}
        {field === 'status_code' ? (
          <Select
            label={t('adminFinancePaymentCorrectionValueLabel')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            options={[{ value: '', label: '' }, ...statusValueOptions(findingCode, t)]}
          />
        ) : null}

        {formError ? <ValidationMessage tone="error">{formError}</ValidationMessage> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="primary" onClick={handleReview}>
            {t('adminFinancePaymentCorrectionSubmit')}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('adminFinancePaymentCorrectionCancelAction')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingCorrection)}
        onOpenChange={handleDialogOpenChange}
        title={t('adminFinancePaymentCorrectionConfirmTitle')}
        description={t('adminFinancePaymentCorrectionConfirmDescription')}
        confirmLabel={t('adminFinancePaymentCorrectionConfirmAction')}
        cancelLabel={t('adminFinancePaymentCorrectionCancelAction')}
        closeLabel={t('dsClose')}
        isConfirming={mutation.isPending}
        onConfirm={handleConfirm}
      >
        {correctionErrorMessage ? <ValidationMessage tone="error">{correctionErrorMessage}</ValidationMessage> : null}
      </ConfirmDialog>
    </Card>
  );
}
