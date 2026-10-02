import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Upload, CheckCircle, XCircle, Clock, ChevronRight, ChevronLeft, Eye } from "lucide-react";
import UserShell from "../components/user-shell";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCandidateDocuments } from "../../features/candidate/documents/hooks/useCandidateDocuments";
import { useDocumentUpload } from "../../features/candidate/documents/hooks/useDocumentUpload";
import { useDocumentAccess } from "../../features/candidate/documents/hooks/useDocumentAccess";
import { useApplicationProgress } from "../../features/candidate/progress/hooks/useApplicationProgress";
import { useSubmitDocuments } from "../../features/candidate/progress/hooks/useSubmitDocuments";
import { DocumentUploadPanel } from "../../features/candidate/documents/components/DocumentUploadPanel";
import { BankDetailsPanel } from "../../features/candidate/documents/components/BankDetailsPanel";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  LoadingState,
  ErrorState,
  OfflineState,
  SessionExpiredState,
  ForbiddenState,
  StatTile,
  ValidationMessage,
} from "../../design-system";
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from "../../../../shared/candidateDocuments/errorMessages";
import { DOCUMENT_ACCESS_ERROR_KEYS } from "../../../../shared/candidateDocuments/documentAccessErrorMessages";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../shared/applicationProgress/errorMessages";
import { PCC_COMPLIANCE_STATUS_KEYS } from "../../../../shared/candidateDocuments/statusLabels";
import { SIDE_CODE_LABEL_KEYS } from "../../../../shared/candidateDocuments/fileSet";
import { resolveDocumentAccessUrl } from "../../lib/resolveDocumentAccessUrl";

const RETRYABLE_ERROR_CODES = new Set(["OFFLINE", "NETWORK_ERROR", "SERVER_ERROR", "RATE_LIMITED", "IN_PROGRESS", "CONFLICT"]);

const STATUS_CONFIG = {
  verified: { icon: CheckCircle, className: "bg-[#E6F9F0] text-[#10B981]", textClassName: "text-[#10B981]", labelKey: "verified" },
  pending_review: { icon: Clock, className: "bg-[#FFF7E6] text-[#F59E0B]", textClassName: "text-[#F59E0B]", labelKey: "candidateDocumentsStatusPendingReview" },
  uploaded: { icon: Upload, className: "bg-[#E6F2FF] text-[#0066CC]", textClassName: "text-[#0066CC]", labelKey: "uploaded" },
  rejected: { icon: XCircle, className: "bg-[#FEF2F2] text-[#EF4444]", textClassName: "text-[#EF4444]", labelKey: "rejected" },
  missing: { icon: Upload, className: "bg-[#F6F6F6] text-[#6B7280]", textClassName: "text-[#6B7280]", labelKey: "pending" },
  unknown: { icon: Upload, className: "bg-[#F6F6F6] text-[#6B7280]", textClassName: "text-[#6B7280]", labelKey: "candidateDocumentsStatusUnknown" },
};

export default function DocumentsPage() {
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const checklistQuery = useCandidateDocuments();
  const progressQuery = useApplicationProgress();
  const upload = useDocumentUpload();
  const submit = useSubmitDocuments();
  const documentAccess = useDocumentAccess();

  const returnToSignIn = () => {
    logout("expired");
    navigate("/login", { replace: true });
  };

  // Only the upload, submit and document-access requests auto-end the
  // session here -- their errors have no dedicated confirmation screen of
  // their own (they surface inline in the upload panel / confirm dialog /
  // document row). The checklist query's own SESSION_EXPIRED/INACTIVE_ACCOUNT
  // render their dedicated SessionExpiredState/ForbiddenState below, which
  // end the session only once the candidate confirms via that screen's own
  // action -- never silently out from under them.
  useEffect(() => {
    const code = upload.mutation.error?.code ?? submit.mutation.error?.code ?? documentAccess.error?.code;
    if (code === "SESSION_EXPIRED" || code === "INACTIVE_ACCOUNT") {
      returnToSignIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload.mutation.error, submit.mutation.error, documentAccess.error]);

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

    // Already in the backend's display order -- never re-sorted here.
    const checklist = checklistQuery.data ?? [];

    if (checklist.length === 0) {
      return (
        <>
          <BankDetailsPanel t={t} language={language} onSessionEnd={returnToSignIn} />
          <EmptyState title={t("candidateDocumentsEmptyTitle")} description={t("candidateDocumentsEmptyDescription")} />
        </>
      );
    }

    return (
      <>
        <div className="mb-5 flex gap-2">
          <StatTile
            value={stats.verified}
            label={t("verified")}
            className="bg-[#E6F9F0] text-[#10B981]"
            labelClassName="text-[#10B981]"
          />
          <StatTile
            value={stats.pendingReview}
            label={t("candidateDocumentsStatusPendingReview")}
            className="bg-[#FFF7E6] text-[#F59E0B]"
            labelClassName="text-[#F59E0B]"
          />
          <StatTile value={stats.missing} label={t("pending")} className="bg-[#F6F6F6] text-[#6B7280]" />
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
              documentAccess={documentAccess}
            />
          ))}
        </div>

        <BankDetailsPanel t={t} language={language} onSessionEnd={returnToSignIn} />
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


function DocumentRow({ item, language, t, isActive, isAnyUploadPending, upload, documentAccess }) {
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.unknown;
  const StatusIcon = config.icon;
  const canUpload = item.status === "missing";
  const canReplace = item.document !== null && item.replacementAllowed;
  const hasAction = canUpload || canReplace;
  const canView = item.document !== null;
  const complianceStatus = item.document?.complianceStatus;
  // A multi-file document lists each file with its own View link; a
  // single-file one keeps the one View action beside the row.
  const files = item.document?.files ?? [];
  const isMultiFile = files.length > 1;

  const rowAccessError =
    documentAccess.error && documentAccess.lastRequestedDocumentId === item.document?.id ? documentAccess.error : null;

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
    upload.startUpload(item);
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
        <div className={`text-[13px] ${config.textClassName}`}>{statusLine}</div>
        {item.document?.rejectionReason ? <div className="mt-1 text-xs text-[#EF4444]">{item.document.rejectionReason}</div> : null}
      </div>
    </>
  );

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex w-full items-center">
        {hasAction ? (
          <button
            type="button"
            onClick={handleClick}
            disabled={isAnyUploadPending && !isActive}
            aria-label={actionLabel}
            className="flex min-w-0 flex-1 items-center text-start disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rowContent}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center">{rowContent}</div>
        )}

        {canView && !isMultiFile ? (
          <FileViewAction documentId={item.document.id} fileId={files[0]?.id} documentAccess={documentAccess} t={t} />
        ) : null}

        {hasAction ? <Chevron size={20} className="shrink-0 text-gray-400" /> : null}
      </div>

      {canView && isMultiFile ? (
        <ul className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-3" aria-label={t("candidateDocumentsFilesLabel")}>
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2 text-sm text-gray-600">
              <span className="min-w-0 truncate">
                {file.sideCode ? `${t(SIDE_CODE_LABEL_KEYS[file.sideCode])} • ` : ""}
                {file.fileName}
              </span>
              <FileViewAction documentId={item.document.id} fileId={file.id} documentAccess={documentAccess} t={t} />
            </li>
          ))}
        </ul>
      ) : null}

      {rowAccessError ? (
        <ValidationMessage tone="error">
          {rowAccessError.message || t(DOCUMENT_ACCESS_ERROR_KEYS[rowAccessError.code])}
        </ValidationMessage>
      ) : null}

      {isActive ? (
        <DocumentUploadPanel
          labelText={t(canUpload ? "candidateDocumentsUploadAction" : "candidateDocumentsReplaceAction")}
          instructions={item.instructions}
          upload={upload}
          t={t}
          language={language}
        />
      ) : null}
    </div>
  );
}

/**
 * View action for one file of a document: requests a short-lived access link
 * on demand, then becomes a real link to it. `fileId` is omitted only for a
 * document whose file list didn't come back (the backend then serves its
 * representative file).
 */
function FileViewAction({ documentId, fileId, documentAccess, t }) {
  const isThisFile =
    documentAccess.lastRequestedDocumentId === documentId && documentAccess.lastRequestedFileId === (fileId ?? null);
  const isRequesting = documentAccess.isRequesting && isThisFile;
  const hasResolvedAccess = isThisFile && documentAccess.access?.documentId === documentId && !documentAccess.isExpired;
  const viewLabel = t("candidateDocumentsViewAction");
  const openLabel = t("candidateDocumentsOpenAction");

  if (hasResolvedAccess) {
    return (
      <a
        href={resolveDocumentAccessUrl(documentAccess.access.url, import.meta.env.VITE_API_BASE_URL ?? "")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={openLabel}
        title={openLabel}
        className="ms-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#0066CC] hover:bg-gray-100"
      >
        <Eye size={18} />
      </a>
    );
  }

  return (
    <span className="ms-2 shrink-0">
      <IconButton
        icon={<Eye size={18} />}
        label={viewLabel}
        variant="ghost"
        size="sm"
        loading={isRequesting}
        onClick={() => documentAccess.requestDocumentAccess(documentId, fileId)}
      />
    </span>
  );
}
