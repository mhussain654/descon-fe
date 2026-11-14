import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminWorkflowCorrectionsClient } from '../../../../lib/admin-workflow-corrections-client';
import type {
  AppointmentCorrectionInput,
  FlightCorrectionInput,
  WorkflowCorrectionError,
  WorkflowCorrections,
} from '../../../../lib/admin-workflow-corrections-client';
import { adminWorkflowCorrectionQueries } from '../../../../../../shared/queryKeys/adminWorkflowCorrectionQueries';

/** The candidate's three correction boxes. Only fetched for staff who may correct (developers). */
export function useWorkflowCorrections(candidateId: string, enabled: boolean) {
  const { language } = useLanguage();
  return useQuery<WorkflowCorrections, WorkflowCorrectionError>({
    queryKey: adminWorkflowCorrectionQueries.get(candidateId, language),
    queryFn: () => adminWorkflowCorrectionsClient.getCorrections(candidateId),
    enabled,
  });
}

export type CorrectionSubmission =
  | { kind: 'medicalAppointment'; input: AppointmentCorrectionInput }
  | { kind: 'qvcAppointment'; input: AppointmentCorrectionInput }
  | { kind: 'flightDetail'; input: FlightCorrectionInput };

/**
 * Saves one correction, then refreshes the boxes and everything else on the
 * page that shows these details (workflow panel, QVC attempts, flight).
 */
export function useSubmitWorkflowCorrection(candidateId: string) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<WorkflowCorrections, WorkflowCorrectionError, CorrectionSubmission>({
    mutationFn: (submission) => {
      if (submission.kind === 'medicalAppointment') return adminWorkflowCorrectionsClient.correctMedicalAppointment(submission.input);
      if (submission.kind === 'qvcAppointment') return adminWorkflowCorrectionsClient.correctQvcAppointment(submission.input);
      return adminWorkflowCorrectionsClient.correctFlightDetail(submission.input);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(adminWorkflowCorrectionQueries.get(candidateId, language), data);
      queryClient.invalidateQueries({ queryKey: ['workflow'] });
      toast.success(t('adminWorkflowCorrectionSuccessToast'));
    },
  });
}
