import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Upload, CheckCircle, XCircle, Clock, ChevronRight, ChevronLeft } from "lucide-react";
import UserShell from "../components/user-shell";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCandidateDocuments } from "../../features/candidate/documents/hooks/useCandidateDocuments";
import { useDocumentUpload } from "../../features/candidate/documents/hooks/useDocumentUpload";
import { useApplicationProgress } from "../../features/candidate/progress/hooks/useApplicationProgress";
import { useSubmitDocuments } from "../../features/candidate/progress/hooks/useSubmitDocuments";
import { DocumentUploadPanel } from "../../features/candidate/documents/components/DocumentUploadPanel";
import {
  Button,
  ConfirmDialog,
  LoadingState,
  ErrorState,
  OfflineState,
  SessionExpiredState,
  ForbiddenState,
  ValidationMessage,
} from "../../design-system";
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from "../../../../shared/candidateDocuments/errorMessages";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../shared/applicationProgress/errorMessages";
import { PCC_COMPLIANCE_STATUS_KEYS } from "../../../../shared/candidateDocuments/statusLabels";
import { sortByPrototypeOrder } from "../../../../shared/candidateDocuments/checklistOrder";

const RETRYABLE_ERROR_CODES = new Set(["OFFLINE", "NETWORK_ERROR", "SERVER_ERROR", "RATE_LIMITED", "IN_PROGRESS", "CONFLICT"]);

const STATUS_CONFIG = {
  verified: { icon: CheckCircle, className: "bg-[#E6F9F0] text-[#10B981]", labelKey: "verified" },
  pending_review: { icon: Clock, className: "bg-[#FFF7E6] text-[#F59E0B]", labelKey: "candidateDocumentsStatusPendingReview" },
  uploaded: { icon: Upload, className: "bg-[#E6F2FF] text-[#0066CC]", labelKey: "uploaded" },
  rejected: { icon: XCircle, className: "bg-[#FEF2F2] text-[#EF4444]", labelKey: "rejected" },
  missing: { icon: Upload, className: "bg-[#F6F6F6] text-[#6B7280]", labelKey: "pending" },
  unknown: { icon: Upload, className: "bg-[#F6F6F6] text-[#6B7280]", labelKey: "candidateDocumentsStatusUnknown" },
};

export default function DocumentsPage() {
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const checklistQuery = useCandidateDocuments();
  const progressQuery = useApplicationProgress();
  const upload = useDocumentUpload();
  const submit = useSubmitDocuments();

  const returnToSignIn = () => {
    logout("expired");
    navigate("/login", { replace: true });
  };

  // Only the upload and submit mutations auto-end the session here -- their
  // errors have no dedicated confirmation screen of their own (they surface
  // inline in the upload panel / confirm dialog). The checklist query's own
  // SESSION_EXPIRED/INACTIVE_ACCOUNT render their dedicated
  // SessionExpiredState/ForbiddenState below, which end the session only
  // once the candidate confirms via that screen's own action -- never
  // silently out from under them.
  useEffect(() => {
    const code = upload.mutation.error?.code ?? submit.mutation.error?.code;
    if (code === "SESSION_EXPIRED" || code === "INACTIVE_ACCOUNT") {
      returnToSignIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload.mutation.error, submit.mutation.error]);

  const documents = progressQuery.data?.documents;
  const stats = {
    verified: documents?.verified ?? 0,
    pendingReview: documents?.pendingReview ?? 0,
    missing: documents?.missing ?? 0,
  };

  const renderBody = () => {
    if (checklistQuery.isLoading) {
      return <LoadingState message={t("loading")} />;
    }
    const error = checklistQuery.error;
    if (error?.code === "SESSION_EXPIRED") {
      return (
        <SessionExpiredState
          title={t("dsSessionExpiredTitle")}
          description={t("dsSessionExpiredDescription")}
          actionLabel={t("dsSessionExpiredAction")}
          onAction={returnToSignIn}
        />
      );
    }
    if (error?.code === "INACTIVE_ACCOUNT") {
      return (
        <ForbiddenState
          title={t("candidateProfileInactiveAccountTitle")}
          description={t("candidateProfileInactiveAccountDescription")}
          actionLabel={t("candidateProfileInactiveAccountAction")}
          onAction={returnToSignIn}
        />
      );
    }
    if (error?.code === "OFFLINE") {
      return (
        <OfflineState
          title={t("dsOfflineTitle")}
          description={t("dsOfflineDescription")}
          retryLabel={t("retry")}
          onRetry={() => checklistQuery.refetch()}
        />
      );
    }
    if (error) {
      return (
        <ErrorState
          message={t(CANDIDATE_DOCUMENTS_ERROR_KEYS[error.code])}
          retryLabel={t("retry")}
          onRetry={() => checklistQuery.refetch()}
        />
      );
    }

    const checklist = sortByPrototypeOrder(checklistQuery.data ?? []);

    return (
      <>
        <div className="mb-5 flex gap-2">
          <StatTile
            value={stats.verified}
            labelKey="verified"
            className="bg-[#E6F9F0] text-[#10B981]"
            labelClassName="text-[#10B981]"
          />
          <StatTile
            value={stats.pendingReview}
            labelKey="candidateDocumentsStatusPendingReview"
            className="bg-[#FFF7E6] text-[#F59E0B]"
            labelClassName="text-[#F59E0B]"
          />
          <StatTile value={stats.missing} labelKey="pending" className="bg-[#F6F6F6] text-[#6B7280]" />
        </div>

        {documents?.canSubmit ? (
          <div className="mb-5">
            <Button onClick={submit.openConfirm} disabled={submit.mutation.isPending}>
              {t("applicationProgressSubmitAction")}
            </Button>
          </div>
        ) : null}

        <div>
          {checklist.map((item) => (
            <DocumentRow
              key={item.requirementCode}
              item={item}
              language={language}
              t={t}
              isActive={upload.activeRequirementCode === item.requirementCode}
              isAnyUploadPending={upload.mutation.isPending}
              upload={upload}
            />
          ))}
        </div>
      </>
    );
  };

  return (
    <UserShell activeTab="/documents">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">{t("documents")}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">{renderBody()}</div>

      <ConfirmDialog
        open={submit.confirmOpen}
        onOpenChange={(open) => (!open ? submit.closeConfirm() : undefined)}
        title={t("applicationProgressConfirmTitle")}
        description={t("applicationProgressConfirmDescription")}
        confirmLabel={submit.mutation.isPending ? t("applicationProgressSubmitting") : t("applicationProgressConfirmAction")}
        cancelLabel={t("applicationProgressConfirmCancel")}
        onConfirm={submit.confirm}
        isConfirming={submit.mutation.isPending}
      >
        {submit.mutation.error && RETRYABLE_ERROR_CODES.has(submit.mutation.error.code) ? (
          <ValidationMessage tone="error">
            {submit.mutation.error.message ?? t(APPLICATION_PROGRESS_ERROR_KEYS[submit.mutation.error.code])}
          </ValidationMessage>
        ) : null}
      </ConfirmDialog>
    </UserShell>
  );
}

function StatTile({ value, labelKey, className, labelClassName = "text-black" }) {
  const { t } = useLanguage();
  return (
    <div className={`flex-1 rounded-xl p-3 text-center ${className}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className={`text-[11px] ${labelClassName}`}>{t(labelKey)}</div>
    </div>
  );
}

function DocumentRow({ item, language, t, isActive, isAnyUploadPending, upload }) {
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.unknown;
  const StatusIcon = config.icon;
  const canUpload = item.status === "missing";
  const canReplace = item.document !== null && item.replacementAllowed;
  const hasAction = canUpload || canReplace;
  const complianceStatus = item.document?.complianceStatus;

  const statusLine = [
    t(config.labelKey),
    item.document?.uploadedAt ? new Date(item.document.uploadedAt).toLocaleDateString(language === "ur" ? "ur-PK" : "en-GB") : null,
    item.required ? t("candidateDocumentsRequiredLabel") : null,
    complianceStatus && complianceStatus !== "current" && complianceStatus !== "not_applicable" ? t(PCC_COMPLIANCE_STATUS_KEYS[complianceStatus]) : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const handleClick = () => {
    if (isAnyUploadPending && !isActive) return;
    if (isActive) {
      upload.cancelUpload();
      return;
    }
    upload.startUpload(item.requirementCode);
  };

  const actionLabel = t(canUpload ? "candidateDocumentsUploadAction" : "candidateDocumentsReplaceAction");
  const Chevron = language === "ur" ? ChevronLeft : ChevronRight;

  const rowContent = (
    <>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.className}`}>
        <StatusIcon size={20} />
      </div>
      <div className="ms-3 flex-1">
        <div className="mb-0.5 text-[15px] font-medium text-black">{item.name}</div>
        <div className="text-[13px]">{statusLine}</div>
        {item.document?.rejectionReason ? <div className="mt-1 text-xs text-[#EF4444]">{item.document.rejectionReason}</div> : null}
      </div>
    </>
  );

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      {hasAction ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={isAnyUploadPending && !isActive}
          aria-label={actionLabel}
          className="flex w-full items-center text-start disabled:cursor-not-allowed disabled:opacity-60"
        >
          {rowContent}
          <Chevron size={20} className="text-gray-400" />
        </button>
      ) : (
        <div className="flex w-full items-center">{rowContent}</div>
      )}

      {isActive ? (
        <DocumentUploadPanel
          labelText={t(canUpload ? "candidateDocumentsUploadAction" : "candidateDocumentsReplaceAction")}
          file={upload.file}
          validationError={upload.validationError}
          uploadError={upload.mutation.error ?? null}
          isUploading={upload.mutation.isPending}
          isPccRequirement={upload.isPccRequirement}
          issuedOn={upload.issuedOn}
          onIssuedOnChange={upload.setIssuedOn}
          issuedOnError={upload.issuedOnError}
          onSelect={upload.selectFile}
          onCancel={upload.cancelUpload}
          onSubmit={upload.submit}
          t={t}
        />
      ) : null}
    </div>
  );
}
