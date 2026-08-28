import { StyleSheet, Text, View } from 'react-native';
import {
  Button,
  ErrorState,
  HelperText,
  Label,
  LoadingState,
  OfflineState,
  TextField,
  ValidationMessage,
} from '../../../../design-system';
import { colors, spacing } from '../../../../design-system/tokens';
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from '../../../../../../shared/candidateDocuments/errorMessages';
import type { FileValidationError } from '../../../../../../shared/candidateDocuments/fileValidation';
import type { PccIssueDateError } from '../../../../../../shared/candidateDocuments/pccIssueDate';
import type { CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { PickedDocument } from '../hooks/useDocumentUpload';

const FILE_VALIDATION_ERROR_KEYS: Record<FileValidationError, TranslationKey> = {
  FILE_REQUIRED: 'candidateDocumentsFileRequiredError',
  EMPTY_FILE: 'candidateDocumentsEmptyFileError',
  FILE_TOO_LARGE: 'candidateDocumentsFileTooLargeError',
  INVALID_TYPE: 'candidateDocumentsInvalidFileTypeError',
};

const PCC_ISSUE_DATE_ERROR_KEYS: Record<PccIssueDateError, TranslationKey> = {
  REQUIRED: 'candidateDocumentsPccIssueDateRequiredError',
  INVALID_FORMAT: 'candidateDocumentsPccIssueDateInvalidError',
  IN_FUTURE: 'candidateDocumentsPccIssueDateInFutureError',
};

export interface DocumentUploadPanelProps {
  labelText: string;
  document: PickedDocument | null;
  validationError: FileValidationError | null;
  uploadError: CandidateDocumentsError | null;
  isUploading: boolean;
  isPccRequirement: boolean;
  issuedOn: string;
  onIssuedOnChange: (value: string) => void;
  issuedOnError: PccIssueDateError | null;
  onPickDocument: () => void;
  onRemoveDocument: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  t: (key: TranslationKey) => string;
}

/** Inline upload/replace panel for one checklist requirement. Mirrors web's DocumentUploadPanel.tsx; opens the native picker directly (there's no RN equivalent of a hidden file input). */
export function DocumentUploadPanel({
  labelText,
  document,
  validationError,
  uploadError,
  isUploading,
  isPccRequirement,
  issuedOn,
  onIssuedOnChange,
  issuedOnError,
  onPickDocument,
  onRemoveDocument,
  onCancel,
  onSubmit,
  t,
}: DocumentUploadPanelProps) {
  if (isUploading) {
    return <LoadingState message={t('candidateDocumentsUploading')} />;
  }

  return (
    <View style={styles.container}>
      <Label>{labelText}</Label>
      {isPccRequirement ? (
        <View style={styles.pccField}>
          <TextField
            label={t('candidateDocumentsPccIssueDateFieldLabel')}
            helperText={issuedOnError ? undefined : t('candidateDocumentsPccIssueDateFieldHelper')}
            errorMessage={issuedOnError ? t(PCC_ISSUE_DATE_ERROR_KEYS[issuedOnError]) : undefined}
            value={issuedOn}
            onChangeText={onIssuedOnChange}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      ) : null}
      <View style={styles.row}>
        <Button variant="outline" size="sm" onPress={onPickDocument}>
          {t('candidateDocumentsChooseFile')}
        </Button>
        <Text style={styles.fileText}>
          {document ? `${t('candidateDocumentsSelectedFilePrefix')}: ${document.name}` : t('candidateDocumentsNoFileChosen')}
        </Text>
      </View>
      {document ? (
        <Button variant="text" size="sm" onPress={onRemoveDocument}>
          {t('candidateDocumentsRemoveFile')}
        </Button>
      ) : null}
      <HelperText>{t('candidateDocumentsFileFieldHelper')}</HelperText>
      {validationError ? <ValidationMessage tone="error">{t(FILE_VALIDATION_ERROR_KEYS[validationError])}</ValidationMessage> : null}

      {uploadError ? <DocumentUploadErrorNotice error={uploadError} t={t} /> : null}

      <View style={styles.actions}>
        <Button variant="primary" size="sm" onPress={onSubmit} disabled={!document || !!validationError}>
          {uploadError ? t('retry') : t('candidateDocumentsSubmitUpload')}
        </Button>
        <Button variant="text" size="sm" onPress={onCancel}>
          {t('candidateDocumentsCancel')}
        </Button>
      </View>
    </View>
  );
}

function DocumentUploadErrorNotice({ error, t }: { error: CandidateDocumentsError; t: (key: TranslationKey) => string }) {
  if (error.code === 'SESSION_EXPIRED' || error.code === 'INACTIVE_ACCOUNT') {
    return null;
  }

  if (error.code === 'OFFLINE') {
    return (
      <View style={styles.errorNotice}>
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} />
      </View>
    );
  }

  const key = CANDIDATE_DOCUMENTS_ERROR_KEYS[error.code] as TranslationKey;
  const message = error.message ?? t(key);
  return (
    <View style={styles.errorNotice}>
      <ErrorState message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[3],
    borderRadius: 12,
    backgroundColor: colors.surface.sunken,
    padding: spacing[4],
  },
  pccField: { marginBottom: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' },
  fileText: { fontSize: 14, color: colors.text.secondary, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  errorNotice: { marginTop: spacing[3] },
});
