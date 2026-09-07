import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Landmark, ChevronRight, ChevronLeft, CheckCircle } from "lucide-react";
import {
  Button,
  ErrorState,
  HelperText,
  Input,
  Label,
  LoadingState,
  ValidationMessage,
} from "../../../../design-system";
import { CANDIDATE_BANK_DETAILS_ERROR_KEYS } from "../../../../../../shared/candidateBankDetails/errorMessages";
import { describeFileType } from "../../../../../../shared/candidateDocuments/fileDescription";
import { formatFileSize } from "../../../../../../shared/candidateDocuments/formatting";
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from "../../../../../../shared/candidateDocuments/errorMessages";
import { useBankDetail } from "../hooks/useBankDetail";
import { useBankDetailUpload } from "../hooks/useBankDetailUpload";

const FILE_VALIDATION_ERROR_KEYS = {
  FILE_REQUIRED: "candidateDocumentsFileRequiredError",
  EMPTY_FILE: "candidateDocumentsEmptyFileError",
  FILE_TOO_LARGE: "candidateDocumentsFileTooLargeError",
  INVALID_TYPE: "candidateDocumentsInvalidFileTypeError",
};

const FIELD_ERROR_KEYS = {
  accountTitle: { REQUIRED: "candidateBankDetailsAccountTitleRequiredError" },
  accountNumber: {
    REQUIRED: "candidateBankDetailsAccountNumberRequiredError",
    INVALID_ACCOUNT_NUMBER: "candidateBankDetailsAccountNumberInvalidError",
  },
  bankName: { REQUIRED: "candidateBankDetailsBankNameRequiredError" },
};

/**
 * A standalone "Bank Details" section on the Documents screen, alongside
 * (not inside) the generic document checklist -- the dedicated structured
 * CandidateBankDetail resource, not a document-checklist row (the two
 * generic document uploads this replaced, 'bank_details'/'cheque_image',
 * are retired server-side). Same row + inline-expand visual language as
 * DocumentRow/DocumentUploadPanel. `onSessionEnd` centralizes the
 * SESSION_EXPIRED/INACTIVE_ACCOUNT sign-out behavior in the parent page,
 * matching its existing single `useEffect` for the checklist/upload/submit
 * mutations -- this panel owns its own query/mutation, so it reports the
 * same two error codes up rather than duplicating the sign-out logic here.
 */
export function BankDetailsPanel({ t, language, onSessionEnd }) {
  const query = useBankDetail();
  const upload = useBankDetailUpload();
  const [isOpen, setIsOpen] = useState(false);
  // Declared before any conditional return below (Rules of Hooks) even
  // though it's only ever passed down to BankDetailsForm, which only
  // renders once the loading/error early returns below have already
  // passed.
  const handleDone = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const code = query.error?.code ?? upload.mutation.error?.code;
    if (code === "SESSION_EXPIRED" || code === "INACTIVE_ACCOUNT") {
      onSessionEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.error, upload.mutation.error]);

  if (query.isLoading) {
    return <LoadingState message={t("loading")} />;
  }

  if (query.error) {
    const key = CANDIDATE_BANK_DETAILS_ERROR_KEYS[query.error.code];
    return (
      <div className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
        <ErrorState message={query.error.message ?? t(key)} retryLabel={t("retry")} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const bankDetail = query.data?.bankDetail ?? null;
  const isComplete = bankDetail !== null;

  const handleToggle = () => {
    if (upload.mutation.isPending) return;
    setIsOpen((open) => !open);
  };

  const Chevron = language === "ur" ? ChevronLeft : ChevronRight;

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      <button
        type="button"
        onClick={handleToggle}
        disabled={upload.mutation.isPending}
        aria-label={t(isComplete ? "candidateBankDetailsReplaceAction" : "candidateBankDetailsAddAction")}
        className="flex w-full items-center text-start disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isComplete ? "bg-[#E6F9F0] text-[#10B981]" : "bg-[#F6F6F6] text-[#6B7280]"
          }`}
        >
          {isComplete ? <CheckCircle size={20} /> : <Landmark size={20} />}
        </div>
        <div className="ms-3 flex-1">
          <div className="mb-0.5 text-[15px] font-medium text-black">{t("candidateBankDetailsTitle")}</div>
          <div className={`text-[13px] ${isComplete ? "text-[#10B981]" : "text-[#6B7280]"}`}>
            {t(isComplete ? "candidateBankDetailsComplete" : "candidateBankDetailsIncomplete")}
          </div>
        </div>
        <Chevron size={20} className="text-gray-400" />
      </button>

      {isOpen ? <BankDetailsForm t={t} language={language} upload={upload} onDone={handleDone} /> : null}
    </div>
  );
}

function BankDetailsForm({ t, language, upload, onDone }) {
  const inputRef = useRef(null);
  const fieldId = useId();
  const helperId = `${fieldId}-helper`;

  // Collapses the panel once the submission succeeds -- an effect, not a
  // render-time call, since calling a parent's state setter directly while
  // this component renders is unsafe (React warns: "Cannot update a
  // component while rendering a different component").
  useEffect(() => {
    if (upload.mutation.isSuccess) onDone();
  }, [upload.mutation.isSuccess, onDone]);

  if (upload.mutation.isPending) {
    return <LoadingState message={t("candidateBankDetailsSubmitting")} />;
  }

  if (upload.mutation.isSuccess) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-sunken p-4">
      <div className="mb-3">
        <Input
          label={t("candidateBankDetailsAccountTitleLabel")}
          value={upload.accountTitle}
          onChange={(event) => upload.setAccountTitle(event.currentTarget.value)}
          errorMessage={upload.fieldErrors.accountTitle ? t(FIELD_ERROR_KEYS.accountTitle[upload.fieldErrors.accountTitle]) : undefined}
        />
      </div>
      <div className="mb-3">
        <Input
          label={t("candidateBankDetailsAccountNumberLabel")}
          value={upload.accountNumber}
          onChange={(event) => upload.setAccountNumber(event.currentTarget.value)}
          errorMessage={
            upload.fieldErrors.accountNumber ? t(FIELD_ERROR_KEYS.accountNumber[upload.fieldErrors.accountNumber]) : undefined
          }
          helperText={upload.fieldErrors.accountNumber ? undefined : t("candidateBankDetailsAccountNumberHelper")}
        />
      </div>
      <div className="mb-3">
        <Input
          label={t("candidateBankDetailsBankNameLabel")}
          value={upload.bankName}
          onChange={(event) => upload.setBankName(event.currentTarget.value)}
          errorMessage={upload.fieldErrors.bankName ? t(FIELD_ERROR_KEYS.bankName[upload.fieldErrors.bankName]) : undefined}
        />
      </div>

      <Label htmlFor={fieldId}>{t("candidateBankDetailsProofLabel")}</Label>
      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="sr-only"
        aria-describedby={helperId}
        onChange={(event) => upload.selectProof(event.currentTarget.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          {t("candidateDocumentsChooseFile")}
        </Button>
        <span className="text-sm text-text-secondary">
          {upload.proof
            ? `${t("candidateDocumentsSelectedFilePrefix")}: ${upload.proof.name} • ${describeFileType({ name: upload.proof.name, size: upload.proof.size, type: upload.proof.type })} • ${formatFileSize(upload.proof.size, language)}`
            : t("candidateDocumentsNoFileChosen")}
        </span>
      </div>
      <HelperText id={helperId}>{t("candidateBankDetailsProofHelper")}</HelperText>
      {upload.proofError ? <ValidationMessage tone="error">{t(FILE_VALIDATION_ERROR_KEYS[upload.proofError])}</ValidationMessage> : null}

      {upload.mutation.error ? <BankDetailErrorNotice error={upload.mutation.error} t={t} /> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" onClick={upload.submit}>
          {upload.mutation.error ? t("retry") : t("candidateBankDetailsSubmitAction")}
        </Button>
        <Button type="button" variant="text" size="sm" onClick={onDone}>
          {t("candidateDocumentsCancel")}
        </Button>
      </div>
    </div>
  );
}

function BankDetailErrorNotice({ error, t }) {
  if (error.code === "SESSION_EXPIRED" || error.code === "INACTIVE_ACCOUNT") {
    // The parent Documents page signs the candidate out and replaces the
    // whole screen for these -- nothing to render here in the meantime.
    return null;
  }

  const key = CANDIDATE_BANK_DETAILS_ERROR_KEYS[error.code] ?? CANDIDATE_DOCUMENTS_ERROR_KEYS.UNKNOWN;
  return (
    <div className="mt-3">
      <ErrorState message={error.message ?? t(key)} />
    </div>
  );
}
