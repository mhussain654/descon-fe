import { Image, Linking, StyleSheet, Text, View } from 'react-native';
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
import { describeFileType, isPreviewableImageType } from '../../../../../../shared/candidateDocuments/fileDescription';
import type { FileValidationError } from '../../../../../../shared/candidateDocuments/fileValidation';
import { formatFileSize } from '../../../../../../shared/candidateDocuments/formatting';
import type { PccIssueDateError } from '../../../../../../shared/candidateDocuments/pccIssueDate';
import type { CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import type { CapturePermissionNotice, PickedDocument } from '../hooks/useDocumentUpload';

const PERMISSION_NOTICE_KEYS: Record<string, TranslationKey> = {
  'camera:denied': 'candidateDocumentsCameraPermissionDeniedError',
  'camera:blocked': 'candidateDocumentsCameraPermissionBlockedError',
  'gallery:denied': 'candidateDocumentsGalleryPermissionDeniedError',
  'gallery:blocked': 'candidateDocumentsGalleryPermissionBlockedError',
};

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
  permissionNotice: CapturePermissionNotice | null;
  onPickDocument: () => void;
  onPickFromCamera: () => void;
  onPickFromGallery: () => void;
  onRemoveDocument: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  t: (key: TranslationKey) => string;
  language: Language;
}

/** Inline upload/replace panel for one checklist requirement. Mirrors web's DocumentUploadPanel.tsx; opens the native picker/camera/gallery directly (there's no RN equivalent of a hidden file input). */
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
  permissionNotice,
  onPickDocument,
  onPickFromCamera,
  onPickFromGallery,
  onRemoveDocument,
  onCancel,
  onSubmit,
  t,
  language,
}: DocumentUploadPanelProps) {
  if (isUploading) {
    return <LoadingState message={t('candidateDocumentsUploading')} />;
  }

  const isImage = document ? isPreviewableImageType({ name: document.name, size: document.size, type: document.mimeType }) : false;

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
      {/* Capture guidance, not automated validation -- the app never analyzes
          the image itself, this is just plain instruction text (ticket: "Do
          not claim to analyze image quality ... Provide capture guidance ...
          without presenting it as automated validation."). */}
      <HelperText>{t('candidateDocumentsCaptureGuidance')}</HelperText>
      <View style={styles.row}>
        <Button variant="outline" size="sm" onPress={onPickFromCamera}>
          {t('candidateDocumentsTakePhoto')}
        </Button>
        <Button variant="outline" size="sm" onPress={onPickFromGallery}>
          {t('candidateDocumentsChooseFromGallery')}
        </Button>
        <Button variant="outline" size="sm" onPress={onPickDocument}>
          {t('candidateDocumentsChooseFile')}
        </Button>
      </View>
      {permissionNotice ? (
        <View style={styles.permissionNotice}>
          <ValidationMessage tone="error">{t(PERMISSION_NOTICE_KEYS[`${permissionNotice.source}:${permissionNotice.blocked ? 'blocked' : 'denied'}`])}</ValidationMessage>
          {permissionNotice.blocked ? (
            <Button variant="text" size="sm" onPress={() => Linking.openSettings()}>
              {t('candidateDocumentsOpenSettings')}
            </Button>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.fileText}>
        {document
          ? `${t('candidateDocumentsSelectedFilePrefix')}: ${document.name} • ${describeFileType({ name: document.name, size: document.size, type: document.mimeType })}${
              typeof document.size === 'number' ? ` • ${formatFileSize(document.size, language)}` : ''
            }`
          : t('candidateDocumentsNoFileChosen')}
      </Text>
      {document && isImage ? (
        <Image source={{ uri: document.uri }} style={styles.previewImage} resizeMode="cover" accessibilityLabel={document.name} />
      ) : null}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap', marginTop: spacing[2] },
  fileText: { fontSize: 14, color: colors.text.secondary, flexShrink: 1, marginTop: spacing[2] },
  previewImage: { width: 96, height: 96, borderRadius: 8, marginTop: spacing[2] },
  permissionNotice: { marginTop: spacing[2] },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  errorNotice: { marginTop: spacing[3] },
});
