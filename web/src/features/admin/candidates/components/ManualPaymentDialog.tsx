import { useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { ConfirmDialog, Input, Textarea, ValidationMessage } from '../../../../design-system';
import { ADMIN_PAYMENT_ERROR_KEYS } from '../../../../../../shared/adminPayments/errorMessages';
import { flightDateToday as pakistanToday } from '../../../../../../shared/adminCandidates/flightDate';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useRecordManualPayment } from '../../payments/hooks/useRecordManualPayment';

interface ManualPaymentDialogProps {
  candidateId: string;
  /** From a payment's own page: the open payment to mark. */
  paymentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FieldErrors = Partial<Record<'reference' | 'paidOn' | 'reason', string>>;

/**
 * Developers only: records a fee the candidate paid at KuickPay that the
 * system never picked up, with the KuickPay reference, the paid day and why.
 */
export function ManualPaymentDialog({ candidateId, paymentId, open, onOpenChange }: ManualPaymentDialogProps) {
  const { t } = useLanguage();
  const today = pakistanToday();
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const reset = () => {
    setReference('');
    setPaidOn(pakistanToday());
    setReason('');
    setErrors({});
    mutation.reset();
  };
  const mutation = useRecordManualPayment(candidateId, () => {
    onOpenChange(false);
    reset();
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    onOpenChange(false);
    reset();
  };

  const handleConfirm = () => {
    const nextErrors: FieldErrors = {};
    if (!reference.trim()) nextErrors.reference = t('adminManualPaymentReferenceRequired');
    if (!paidOn || paidOn > today) nextErrors.paidOn = t('adminManualPaymentPaidOnInvalid');
    if (!reason.trim()) nextErrors.reason = t('adminManualPaymentReasonRequired');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || mutation.isPending) return;
    mutation.mutate({ reference: reference.trim(), paidOn, reason: reason.trim(), ...(paymentId ? { paymentId } : {}) });
  };

  const serverError = mutation.error;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('adminManualPaymentDialogTitle')}
      description={t('adminManualPaymentDialogDescription')}
      confirmLabel={t('adminManualPaymentConfirm')}
      cancelLabel={t('adminWorkflowCancelAction')}
      closeLabel={t('dsClose')}
      onConfirm={handleConfirm}
      isConfirming={mutation.isPending}
    >
      <div className="space-y-4">
        <Input
          label={t('adminManualPaymentReferenceLabel')}
          helperText={t('adminManualPaymentReferenceHelp')}
          value={reference}
          maxLength={100}
          dir="ltr"
          onChange={(event) => setReference(event.target.value)}
          errorMessage={errors.reference}
        />
        <Input
          type="date"
          label={t('adminManualPaymentPaidOnLabel')}
          value={paidOn}
          max={today}
          onChange={(event) => setPaidOn(event.target.value)}
          errorMessage={errors.paidOn}
        />
        <Textarea
          label={t('adminManualPaymentReasonLabel')}
          value={reason}
          rows={3}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          errorMessage={errors.reason}
        />
        {serverError ? (
          <ValidationMessage tone="error">
            {serverError.message || t(ADMIN_PAYMENT_ERROR_KEYS[serverError.code] as TranslationKey)}
          </ValidationMessage>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
