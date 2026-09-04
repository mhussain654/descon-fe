import { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Landmark, ChevronRight, ChevronLeft, CheckCircle } from "lucide-react-native";
import {
  Button,
  ErrorState,
  HelperText,
  Label,
  LoadingState,
  TextField,
  ValidationMessage,
} from "../../../../design-system";
import { colors, spacing } from "../../../../design-system/tokens";
import { CANDIDATE_BANK_DETAILS_ERROR_KEYS } from "../../../../../../shared/candidateBankDetails/errorMessages";
import type { CandidateBankDetailsError, CandidateBankDetailsErrorCode } from "../../../../../../shared/candidateBankDetails/types";
import type { BankDetailFieldError } from "../../../../../../shared/candidateBankDetails/formValidation";
import { describeFileType, isPreviewableImageType } from "../../../../../../shared/candidateDocuments/fileDescription";
import type { FileValidationError } from "../../../../../../shared/candidateDocuments/fileValidation";
import { formatFileSize } from "../../../../../../shared/candidateDocuments/formatting";
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from "../../../../../../shared/candidateDocuments/errorMessages";
import type { Language, TranslationKey } from "../../../../../../shared/i18n/translations";
import { useBankDetail } from "../hooks/useBankDetail";
import { useBankDetailUpload } from "../hooks/useBankDetailUpload";

const PERMISSION_NOTICE_KEYS: Record<string, TranslationKey> = {
  "camera:denied": "candidateDocumentsCameraPermissionDeniedError",
  "camera:blocked": "candidateDocumentsCameraPermissionBlockedError",
  "gallery:denied": "candidateDocumentsGalleryPermissionDeniedError",
  "gallery:blocked": "candidateDocumentsGalleryPermissionBlockedError",
};

const FILE_VALIDATION_ERROR_KEYS: Record<FileValidationError, TranslationKey> = {
  FILE_REQUIRED: "candidateDocumentsFileRequiredError",
  EMPTY_FILE: "candidateDocumentsEmptyFileError",
  FILE_TOO_LARGE: "candidateDocumentsFileTooLargeError",
  INVALID_TYPE: "candidateDocumentsInvalidFileTypeError",
};

const FIELD_ERROR_KEYS: Record<'accountTitle' | 'accountNumber' | 'bankName', Record<BankDetailFieldError, TranslationKey>> = {
  accountTitle: { REQUIRED: "candidateBankDetailsAccountTitleRequiredError", INVALID_ACCOUNT_NUMBER: "candidateBankDetailsAccountTitleRequiredError" },
  accountNumber: {
    REQUIRED: "candidateBankDetailsAccountNumberRequiredError",
    INVALID_ACCOUNT_NUMBER: "candidateBankDetailsAccountNumberInvalidError",
  },
  bankName: { REQUIRED: "candidateBankDetailsBankNameRequiredError", INVALID_ACCOUNT_NUMBER: "candidateBankDetailsBankNameRequiredError" },
};

interface BankDetailsPanelProps {
  isDark: boolean;
  t: (key: TranslationKey) => string;
  language: Language;
  onSessionEnd: () => void;
}

type BankDetailUpload = ReturnType<typeof useBankDetailUpload>;

interface BankDetailsFormProps {
  t: (key: TranslationKey) => string;
  language: Language;
  upload: BankDetailUpload;
  onDone: () => void;
}

/**
 * A standalone "Bank Details" section on the Documents screen, alongside
 * (not inside) the generic document checklist -- mirrors web's
 * BankDetailsPanel.tsx exactly, swapping the browser `File`/hidden input
 * for the native document-picker/camera/gallery flow, same as
 * DocumentUploadPanel does for the regular checklist.
 */
export function BankDetailsPanel({ isDark, t, language, onSessionEnd }: BankDetailsPanelProps) {
  const query = useBankDetail();
  const upload = useBankDetailUpload();
  const [isOpen, setIsOpen] = useState(false);
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
    const key = CANDIDATE_BANK_DETAILS_ERROR_KEYS[query.error.code] as TranslationKey;
    return (
      <View style={[styles.row, { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF", borderColor: isDark ? "#333333" : "#E5E7EB" }]}>
        <ErrorState message={query.error.message ?? t(key)} retryLabel={t("retry")} onRetry={() => query.refetch()} />
      </View>
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
    <View style={[styles.row, { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF", borderColor: isDark ? "#333333" : "#E5E7EB" }]}>
      <Pressable
        onPress={handleToggle}
        disabled={upload.mutation.isPending}
        accessibilityRole="button"
        accessibilityLabel={t(isComplete ? "candidateBankDetailsReplaceAction" : "candidateBankDetailsAddAction")}
      >
        <View style={styles.rowContent}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isComplete ? (isDark ? "#1A2E1A" : "#E6F9F0") : isDark ? "#1E1E1E" : "#F6F6F6" },
            ]}
          >
            {isComplete ? <CheckCircle size={20} color="#10B981" /> : <Landmark size={20} color="#6B7280" />}
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.title, { color: isDark ? "#FFFFFF" : "#000000" }]}>{t("candidateBankDetailsTitle")}</Text>
            <Text style={[styles.subtitle, { color: isComplete ? "#10B981" : "#6B7280" }]}>
              {t(isComplete ? "candidateBankDetailsComplete" : "candidateBankDetailsIncomplete")}
            </Text>
          </View>
          <Chevron size={20} color={isDark ? "#6B7280" : "#9CA3AF"} />
        </View>
      </Pressable>

      {isOpen ? <BankDetailsForm t={t} language={language} upload={upload} onDone={handleDone} /> : null}
    </View>
  );
}

function BankDetailsForm({ t, language, upload, onDone }: BankDetailsFormProps) {
  useEffect(() => {
    if (upload.mutation.isSuccess) onDone();
  }, [upload.mutation.isSuccess, onDone]);

  if (upload.mutation.isPending) {
    return <LoadingState message={t("candidateBankDetailsSubmitting")} />;
  }

  if (upload.mutation.isSuccess) {
    return null;
  }

  const isImage = upload.proof
    ? isPreviewableImageType({ name: upload.proof.name, size: upload.proof.size, type: upload.proof.mimeType })
    : false;

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <TextField
          label={t("candidateBankDetailsAccountTitleLabel")}
          value={upload.accountTitle}
          onChangeText={upload.setAccountTitle}
          errorMessage={upload.fieldErrors.accountTitle ? t(FIELD_ERROR_KEYS.accountTitle[upload.fieldErrors.accountTitle]) : undefined}
        />
      </View>
      <View style={styles.field}>
        <TextField
          label={t("candidateBankDetailsAccountNumberLabel")}
          value={upload.accountNumber}
          onChangeText={upload.setAccountNumber}
          errorMessage={
            upload.fieldErrors.accountNumber ? t(FIELD_ERROR_KEYS.accountNumber[upload.fieldErrors.accountNumber]) : undefined
          }
          helperText={upload.fieldErrors.accountNumber ? undefined : t("candidateBankDetailsAccountNumberHelper")}
        />
      </View>
      <View style={styles.field}>
        <TextField
          label={t("candidateBankDetailsBankNameLabel")}
          value={upload.bankName}
          onChangeText={upload.setBankName}
          errorMessage={upload.fieldErrors.bankName ? t(FIELD_ERROR_KEYS.bankName[upload.fieldErrors.bankName]) : undefined}
        />
      </View>

      <Label>{t("candidateBankDetailsProofLabel")}</Label>
      <View style={styles.pickerRow}>
        <Button variant="outline" size="sm" onPress={upload.pickFromCamera}>
          {t("candidateDocumentsTakePhoto")}
        </Button>
        <Button variant="outline" size="sm" onPress={upload.pickFromGallery}>
          {t("candidateDocumentsChooseFromGallery")}
        </Button>
        <Button variant="outline" size="sm" onPress={upload.pickDocument}>
          {t("candidateDocumentsChooseFile")}
        </Button>
      </View>
      {upload.permissionNotice ? (
        <View style={styles.permissionNotice}>
          <ValidationMessage tone="error">
            {t(PERMISSION_NOTICE_KEYS[`${upload.permissionNotice.source}:${upload.permissionNotice.blocked ? "blocked" : "denied"}`])}
          </ValidationMessage>
          {upload.permissionNotice.blocked ? (
            <Button variant="text" size="sm" onPress={() => Linking.openSettings()}>
              {t("candidateDocumentsOpenSettings")}
            </Button>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.fileText}>
        {upload.proof
          ? `${t("candidateDocumentsSelectedFilePrefix")}: ${upload.proof.name} • ${describeFileType({ name: upload.proof.name, size: upload.proof.size, type: upload.proof.mimeType })}${
              typeof upload.proof.size === "number" ? ` • ${formatFileSize(upload.proof.size, language)}` : ""
            }`
          : t("candidateDocumentsNoFileChosen")}
      </Text>
      {upload.proof && isImage ? (
        <Image source={{ uri: upload.proof.uri }} style={styles.previewImage} resizeMode="cover" accessibilityLabel={upload.proof.name} />
      ) : null}
      {upload.proof ? (
        <Button variant="text" size="sm" onPress={upload.removeProof}>
          {t("candidateDocumentsRemoveFile")}
        </Button>
      ) : null}
      <HelperText>{t("candidateBankDetailsProofHelper")}</HelperText>
      {upload.proofError ? <ValidationMessage tone="error">{t(FILE_VALIDATION_ERROR_KEYS[upload.proofError])}</ValidationMessage> : null}

      {upload.mutation.error ? <BankDetailErrorNotice error={upload.mutation.error} t={t} /> : null}

      <View style={styles.actions}>
        <Button variant="primary" size="sm" onPress={upload.submit}>
          {upload.mutation.error ? t("retry") : t("candidateBankDetailsSubmitAction")}
        </Button>
        <Button variant="text" size="sm" onPress={onDone}>
          {t("candidateDocumentsCancel")}
        </Button>
      </View>
    </View>
  );
}

function BankDetailErrorNotice({ error, t }: { error: CandidateBankDetailsError; t: (key: TranslationKey) => string }) {
  if (error.code === "SESSION_EXPIRED" || error.code === "INACTIVE_ACCOUNT") {
    return null;
  }

  const key = (CANDIDATE_BANK_DETAILS_ERROR_KEYS[error.code] ?? CANDIDATE_DOCUMENTS_ERROR_KEYS.UNKNOWN) as TranslationKey;
  return (
    <View style={styles.errorNotice}>
      <ErrorState message={error.message ?? t(key)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  rowContent: { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  rowText: { flex: 1, marginStart: 12 },
  title: { fontSize: 15, fontFamily: "Inter_500Medium", marginBottom: 2 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  form: { marginTop: spacing[3], borderRadius: 12, backgroundColor: colors.surface.sunken, padding: spacing[4] },
  field: { marginBottom: spacing[3] },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[3], flexWrap: "wrap", marginTop: spacing[2] },
  fileText: { fontSize: 14, color: colors.text.secondary, flexShrink: 1, marginTop: spacing[2] },
  previewImage: { width: 96, height: 96, borderRadius: 8, marginTop: spacing[2] },
  permissionNotice: { marginTop: spacing[2] },
  actions: { flexDirection: "row", gap: spacing[2], marginTop: spacing[4] },
  errorNotice: { marginTop: spacing[3] },
});
