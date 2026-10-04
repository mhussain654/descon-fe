import { useEffect } from "react";
import { useStaffAuth } from "../../../../contexts/StaffAuthContext";
import { useAdminFee } from "../../payments/hooks/useAdminFee";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { Badge, Button, Card } from "../../../../design-system";
import { paymentStatusFromTimeline } from "../../../../../../shared/adminWorkflow/paymentStatusFromTimeline";
import type { CandidatePaymentStatus } from "../../../../../../shared/adminWorkflow/paymentStatusFromTimeline";
import type { TranslationKey } from "../../../../../../shared/i18n/translations";
import { useWorkflowState } from "../../workflow/hooks/useWorkflowState";

const STATUS_LABEL_KEYS: Record<CandidatePaymentStatus, TranslationKey> = {
  paid: "adminCandidatePaymentStatusPaid",
  pending: "adminCandidatePaymentStatusPending",
  not_reached: "adminCandidatePaymentStatusNotReached",
};

/** Badge already ships its own tone-appropriate icon (design-system convention: "Status is never conveyed by color alone"), so the tone/label pair here is the entire visual, no separate icon row needed. */
const STATUS_TONES: Record<
  CandidatePaymentStatus,
  "success" | "warning" | "neutral"
> = {
  paid: "success",
  pending: "warning",
  not_reached: "neutral",
};

interface CandidatePaymentStatusCardProps {
  candidateId: string;
}

/** Payment stage comes from workflow; the amount comes from the authorized fee API. */
export function CandidatePaymentStatusCard({
  candidateId,
}: CandidatePaymentStatusCardProps) {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const feeQuery = useAdminFee(candidateId);
  useEffect(() => {
    if (
      feeQuery.error?.code === "SESSION_EXPIRED" ||
      feeQuery.error?.code === "INACTIVE_ACCOUNT"
    ) {
      signOut(feeQuery.error.code === "SESSION_EXPIRED" ? "expired" : "manual");
    }
  }, [feeQuery.error, signOut]);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">
          {t("adminCandidatePaymentSectionTitle")}
        </h2>
        <Badge tone={STATUS_TONES[status]}>
          {feeQuery.data?.assignmentId ? (
            <span dir="ltr">
              {new Intl.NumberFormat(language === "ur" ? "ur-PK" : "en-PK", {
                style: "currency",
                currency: feeQuery.data.currencyCode,
              }).format(Number(feeQuery.data.effectiveAmount))}
            </span>
          ) : null}
          <span>{t(STATUS_LABEL_KEYS[status])}</span>
        </Badge>
      </div>
      {feeQuery.error &&
      feeQuery.error.code !== "FORBIDDEN" &&
      !feeQuery.data ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-secondary"
          role="status"
        >
          <span>{t("adminFeeLoadError")}</span>
          <Button variant="text" size="sm" onClick={() => feeQuery.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
