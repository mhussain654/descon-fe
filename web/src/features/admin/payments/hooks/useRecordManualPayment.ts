import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import {
  adminPaymentsClient,
  type AdminPaymentError,
  type ManualPaymentRequest,
  type PaymentSummary,
} from '../../../../lib/admin-payments-client';
import { adminCandidateQueries } from '../../../../../../shared/queryKeys/adminCandidateQueries';
import { adminFeeQueries } from '../../../../../../shared/queryKeys/adminFeeQueries';
import { workflowQueries } from '../../../../../../shared/queryKeys/workflowQueries';

/**
 * Developers only: marks the candidate's fee paid (POST .../manual_payment).
 * The backend moves them to Fee Paid, so the candidate, their workflow, fee
 * and the payment lists are all refreshed. A second submission of the same
 * form is refused by the backend (the candidate has already paid), so it can
 * never record the fee twice.
 */
export function useRecordManualPayment(candidateId: string, onRecorded: () => void) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  return useMutation<PaymentSummary, AdminPaymentError, ManualPaymentRequest>({
    mutationFn: (payment) => adminPaymentsClient.recordManualPayment(candidateId, payment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCandidateQueries.detail(candidateId, language) });
      queryClient.invalidateQueries({ queryKey: workflowQueries.adminState(candidateId, language) });
      queryClient.invalidateQueries({ queryKey: workflowQueries.adminTransitions(candidateId, language) });
      queryClient.invalidateQueries({ queryKey: workflowQueries.adminHistory(candidateId, language) });
      queryClient.invalidateQueries({ queryKey: adminFeeQueries.detail(candidateId, language) });
      queryClient.invalidateQueries({ queryKey: ['adminPayments', 'list'] });
      toast.success(t('adminManualPaymentSuccessToast'));
      onRecorded();
    },
  });
}
