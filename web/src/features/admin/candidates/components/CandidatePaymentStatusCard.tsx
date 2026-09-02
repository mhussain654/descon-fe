import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Card } from '../../../../design-system';
import { paymentStatusFromTimeline } from '../../../../../../shared/adminWorkflow/paymentStatusFromTimeline';
import type { CandidatePaymentStatus } from '../../../../../../shared/adminWorkflow/paymentStatusFromTimeline';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useWorkflowState } from '../../workflow/hooks/useWorkflowState';

const STATUS_LABEL_KEYS: Record<CandidatePaymentStatus, TranslationKey> = {
  paid: 'adminCandidatePaymentStatusPaid',
  pending: 'adminCandidatePaymentStatusPending',
  not_reached: 'adminCandidatePaymentStatusNotReached',
};

/** Badge already ships its own tone-appropriate icon (design-system convention: "Status is never conveyed by color alone"), so the tone/label pair here is the entire visual, no separate icon row needed. */
const STATUS_TONES: Record<CandidatePaymentStatus, 'success' | 'warning' | 'neutral'> = {
  paid: 'success',
  pending: 'warning',
  not_reached: 'neutral',
};

interface CandidatePaymentStatusCardProps {
  candidateId: string;
}

/**
 * "Payment status ... using the existing payment APIs" (MPS-F303) -- there
 * is no admin/staff payment endpoint (GET/POST /api/v1/candidate/payment is
 * candidate-self-service only, authenticated as the candidate's own
 * session), so this derives status from the real, already-fetched workflow
 * timeline instead of a payment API call: the backend only ever transitions
 * a candidate into `fee_paid` after a confirmed payment
 * (Payments::EligibilityService), so the stage itself is a genuine signal,
 * not a guess. No separate "payment-related navigation" link, since there
 * is no real admin payment destination to navigate to.
 */
export function CandidatePaymentStatusCard({ candidateId }: CandidatePaymentStatusCardProps) {
  const { t } = useLanguage();
  const query = useWorkflowState(candidateId);

  // WorkflowPanel (rendered alongside this card) already surfaces a real
  // error state for this same underlying query -- a second banner here
  // would just be noise, so this section quietly omits itself instead.
  if (query.isLoading || query.isError || !query.data) {
    return null;
  }

  const status = paymentStatusFromTimeline(query.data.timeline);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">{t('adminCandidatePaymentSectionTitle')}</h2>
        <Badge tone={STATUS_TONES[status]}>{t(STATUS_LABEL_KEYS[status])}</Badge>
      </div>
    </Card>
  );
}
