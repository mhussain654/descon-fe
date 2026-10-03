import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import {
  Button,
  ErrorState,
  HelperText,
  IconButton,
  Label,
  LoadingState,
  OfflineState,
  TextField,
  ValidationMessage,
} from '../../../../design-system';
import { colors, spacing } from '../../../../design-system/tokens';
import { getFontFamily } from '../../../../design-system/fonts';
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from '../../../../../../shared/candidateDocuments/errorMessages';
import { describeFileType, isPreviewableImageType } from '../../../../../../shared/candidateDocuments/fileDescription';
import {
  acceptsImages,
  FILE_SET_REASON_KEYS,
  SIDE_CODE_LABEL_KEYS,
  slotFile,
} from '../../../../../../shared/candidateDocuments/fileSet';
import { formatFileSize } from '../../../../../../shared/candidateDocuments/formatting';
import type { PccIssueDateError } from '../../../../../../shared/candidateDocuments/pccIssueDate';
import type { DocumentSideCode } from '../../../../../../shared/candidateDocuments/types';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import type { CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import type { DocumentUploadController, PickedFile } from '../hooks/useDocumentUpload';

const PERMISSION_NOTICE_KEYS: Record<string, TranslationKey> = {
  'camera:denied': 'candidateDocumentsCameraPermissionDeniedError',
  'camera:blocked': 'candidateDocumentsCameraPermissionBlockedError',
  'gallery:denied': 'candidateDocumentsGalleryPermissionDeniedError',
  'gallery:blocked': 'candidateDocumentsGalleryPermissionBlockedError',
};

const FILE_ERROR_KEYS: Record<'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'INVALID_TYPE', TranslationKey> = {
  EMPTY_FILE: 'candidateDocumentsEmptyFileError',
  FILE_TOO_LARGE: 'candidateDocumentsFileTooLargeError',
  INVALID_TYPE: 'candidateDocumentsInvalidFileTypeError',
};

const PCC_ISSUE_DATE_ERROR_KEYS: Record<PccIssueDateError, TranslationKey> = {
  REQUIRED: 'candidateDocumentsPccIssueDateRequiredError',
  INVALID_FORMAT: 'candidateDocumentsPccIssueDateInvalidError',
  IN_FUTURE: 'candidateDocumentsPccIssueDateInFutureError',
};

type Translate = (key: TranslationKey) => string;

export interface DocumentUploadPanelProps {
  labelText: string;
  /** Backend-provided, already localized. */
  instructions: string | null;
  upload: DocumentUploadController;
  t: Translate;
  language: Language;
}

/**
 * Inline upload/replace panel for one checklist requirement -- mirrors web's
 * DocumentUploadPanel.tsx, shaped entirely by the requirement's backend upload
 * rules: one file, a pair of parts (optionally one combined PDF instead), or
 * several files. Photo capture is offered only where the requirement accepts images.
 */
export function DocumentUploadPanel({ labelText, instructions, upload, t, language }: DocumentUploadPanelProps) {
  const { layout, rules, entries, validation, showSetError, mutation, permissionNotice } = upload;
  if (!layout || !rules) return null;

  if (mutation.isPending) {
    return <LoadingState message={t('candidateDocumentsUploading')} language={language} />;
  }

  const combinedMode = layout.kind === 'pair' && layout.combinedAllowed && upload.mode === 'combined';
  const canCapture = acceptsImages(rules);
  const isPassportPair = layout.kind === 'pair' && upload.activeRequirementCode === 'passport';
  const guidanceKey = isPassportPair
    ? combinedMode ? 'candidateDocumentsPassportPdfGuidance' : 'candidateDocumentsPassportPartsGuidance'
    : combinedMode ? 'candidateDocumentsCombinedGuidance' : 'candidateDocumentsPartsGuidance';
  const acceptedTypes = combinedMode ? ['application/pdf'] : rules.acceptedContentTypes;
  const typeNames = acceptedTypes.map(type => type === 'application/pdf' ? 'PDF' : type === 'image/jpeg' ? 'JPEG' : type === 'image/png' ? 'PNG' : type).join(', ');
  const fileErrorFor = (file: PickedFile | null) => {
    if (!file || validation?.kind !== 'file' || entries[validation.index]?.file !== file) return null;
    return t(FILE_ERROR_KEYS[validation.code]);
  };
  const slot = (sideCode: DocumentSideCode | null, label: string | null) => {
    const file = slotFile(entries, sideCode);
    return (
      <FileSlot
        key={sideCode ?? 'single'}
        label={label}
        file={file}
        error={fileErrorFor(file)}
        // A combined upload is one PDF -- never a photo.
        showCapture={canCapture && sideCode !== 'combined'}
        onPick={(source) => upload.pick(source, sideCode)}
        onRemove={() => upload.removeSlot(sideCode)}
        t={t}
        language={language}
      />
    );
  };

  return (
    <View style={styles.container}>
      {layout.kind === 'pair' && layout.combinedAllowed ? (
        <View style={styles.modeRow} accessibilityLabel={t('candidateDocumentsUploadModeLabel')}>
          {(['parts', 'combined'] as const).map(mode => (
            <Pressable key={mode} accessibilityRole="button" accessibilityLabel={t(mode === 'parts' ? 'candidateDocumentsUploadModeParts' : 'candidateDocumentsUploadModeCombined')} accessibilityState={{ selected: upload.mode === mode }} onPress={() => upload.setMode(mode)} style={[styles.modeButton, upload.mode === mode && styles.modeSelected]}>
              <Text style={[styles.modeText, { fontFamily: getFontFamily(language, 'medium') }, upload.mode === mode && styles.modeTextSelected, language === 'ur' && styles.modeTextUrdu]}>{t(mode === 'parts' ? 'candidateDocumentsUploadModeParts' : 'candidateDocumentsOnePdf')}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {layout.kind === 'pair' ? <HelperText language={language}>{t(guidanceKey)}</HelperText> : null}
      <Label language={language}>{labelText}</Label>
      {instructions && !isPassportPair ? (
        <Text style={[styles.instructions, { fontFamily: getFontFamily(language, 'regular') }]}>{instructions}</Text>
      ) : null}

      {upload.isPccRequirement ? (
        <View style={styles.section}>
          <TextField
            label={t('candidateDocumentsPccIssueDateFieldLabel')}
            helperText={upload.issuedOnError ? undefined : t('candidateDocumentsPccIssueDateFieldHelper')}
            errorMessage={upload.issuedOnError ? t(PCC_ISSUE_DATE_ERROR_KEYS[upload.issuedOnError]) : undefined}
            value={upload.issuedOn}
            onChangeText={upload.setIssuedOn}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            language={language}
          />
        </View>
      ) : null}

      {/* Capture guidance, not automated validation -- plain instruction text only. */}
      {canCapture && !(layout.kind === 'pair' && upload.mode === 'combined' && layout.combinedAllowed) ? <HelperText language={language}>{t('candidateDocumentsCaptureGuidance')}</HelperText> : null}

      {layout.kind === 'single' ? slot(null, null) : null}

      {layout.kind === 'pair' ? (
        <>
          {upload.mode === 'combined' && layout.combinedAllowed
            ? slot('combined', t(SIDE_CODE_LABEL_KEYS.combined as TranslationKey))
            : layout.parts.map((part) => slot(part, t(SIDE_CODE_LABEL_KEYS[part] as TranslationKey)))}
        </>
      ) : null}

      {layout.kind === 'multiple' ? (
        <View style={styles.section}>
          {entries.map((entry, index) => (
            <View key={`${entry.file.asset.uri}-${index}`} style={styles.listItem}>
              <SelectedFile file={entry.file} onRemove={() => upload.removeFileAt(index)} t={t} language={language} />
              {fileErrorFor(entry.file) ? (
                <ValidationMessage tone="error" language={language}>
                  {fileErrorFor(entry.file) as string}
                </ValidationMessage>
              ) : null}
            </View>
          ))}
          {entries.length < layout.maximumFiles ? (
            <PickButtons showCapture={canCapture} onPick={(source) => upload.pick(source, layout.sideCode)} t={t} language={language} />
          ) : null}
          <HelperText language={language}>{interpolate(t('candidateDocumentsFileLimitHint'), { count: layout.maximumFiles })}</HelperText>
        </View>
      ) : null}

      {permissionNotice && canCapture ? (
        <View style={styles.section}>
          <ValidationMessage tone="error" language={language}>
            {t(PERMISSION_NOTICE_KEYS[`${permissionNotice.source}:${permissionNotice.blocked ? 'blocked' : 'denied'}`])}
          </ValidationMessage>
          {permissionNotice.blocked ? (
            <Button variant="text" size="sm" onPress={() => Linking.openSettings()} language={language}>
              {t('candidateDocumentsOpenSettings')}
            </Button>
          ) : null}
        </View>
      ) : null}

      <HelperText language={language}>{interpolate(t('candidateDocumentsAcceptedFilesHint'), { types: typeNames, size: formatFileSize(rules.maximumFileSize, language) })}</HelperText>
      {showSetError && validation?.kind === 'set' ? (
        <ValidationMessage tone="error" language={language}>
          {t(FILE_SET_REASON_KEYS[validation.reason] as TranslationKey)}
        </ValidationMessage>
      ) : null}

      {mutation.error ? <DocumentUploadErrorNotice error={mutation.error} t={t} language={language} /> : null}

      <View style={styles.actions}>
        <Button
          variant="primary"
          size="sm"
          onPress={upload.submit}
          disabled={entries.length === 0 || validation?.kind === 'file'}
          language={language}
        >
          {mutation.error ? t('retry') : t('candidateDocumentsSubmitUpload')}
        </Button>
        <Button variant="text" size="sm" onPress={upload.cancelUpload} language={language}>
          {t('candidateDocumentsCancel')}
        </Button>
      </View>
    </View>
  );
}

interface PickButtonsProps {
  showCapture: boolean;
  onPick: (source: 'file' | 'camera' | 'gallery') => void;
  t: Translate;
  language: Language;
}

function PickButtons({ showCapture, onPick, t, language }: PickButtonsProps) {
  return (
    <View style={styles.row}>
      {showCapture ? (
        <>
          <Button variant="outline" size="sm" onPress={() => onPick('camera')} language={language}>
            {t('candidateDocumentsTakePhoto')}
          </Button>
          <Button variant="outline" size="sm" onPress={() => onPick('gallery')} language={language}>
            {t('candidateDocumentsChooseFromGallery')}
          </Button>
        </>
      ) : null}
      <Button variant="outline" size="sm" onPress={() => onPick('file')} language={language}>
        {t('candidateDocumentsChooseFile')}
      </Button>
    </View>
  );
}

interface FileSlotProps {
  /** Null for a single unlabelled file. */
  label: string | null;
  file: PickedFile | null;
  error: string | null;
  showCapture: boolean;
  onPick: (source: 'file' | 'camera' | 'gallery') => void;
  onRemove: () => void;
  t: Translate;
  language: Language;
}

/** One file slot: its part label, the pick buttons, or the chosen file with a remove action. */
function FileSlot({ label, file, error, showCapture, onPick, onRemove, t, language }: FileSlotProps) {
  return (
    <View style={styles.section}>
      {label ? <Text style={[styles.slotLabel, { fontFamily: getFontFamily(language, 'medium') }]}>{label}</Text> : null}
      {file ? (
        <SelectedFile file={file} onRemove={onRemove} t={t} language={language} />
      ) : (
        <>
          <PickButtons showCapture={showCapture} onPick={onPick} t={t} language={language} />
          <Text style={[styles.emptyText, { fontFamily: getFontFamily(language, 'regular') }]}>
            {t('candidateDocumentsNoFileChosen')}
          </Text>
        </>
      )}
      {error ? (
        <ValidationMessage tone="error" language={language}>
          {error}
        </ValidationMessage>
      ) : null}
    </View>
  );
}

function SelectedFile({ file, onRemove, t, language }: { file: PickedFile; onRemove: () => void; t: Translate; language: Language }) {
  const isImage = isPreviewableImageType(file);
  return (
    <View style={styles.selectedFile}>
      {isImage ? (
        <Image source={{ uri: file.asset.uri }} style={styles.previewImage} resizeMode="cover" accessibilityLabel={file.name} />
      ) : null}
      <Text style={[styles.fileText, { fontFamily: getFontFamily(language, 'regular') }]} numberOfLines={2}>
        {`${t('candidateDocumentsSelectedFilePrefix')}: ${file.name} • ${describeFileType(file)}${
          typeof file.size === 'number' ? ` • ${formatFileSize(file.size, language)}` : ''
        }`}
      </Text>
      <IconButton icon={<X size={16} color={colors.text.secondary} />} label={t('candidateDocumentsRemoveFile')} onPress={onRemove} size="sm" />
    </View>
  );
}

function DocumentUploadErrorNotice({ error, t, language }: { error: CandidateDocumentsError; t: Translate; language: Language }) {
  if (error.code === 'SESSION_EXPIRED' || error.code === 'INACTIVE_ACCOUNT') {
    return null;
  }

  if (error.code === 'OFFLINE') {
    return (
      <View style={styles.section}>
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} language={language} />
      </View>
    );
  }

  const message =
    error.code === 'INVALID_DOCUMENT_FILES' && error.reason
      ? t(FILE_SET_REASON_KEYS[error.reason] as TranslationKey)
      : (error.message ?? t(CANDIDATE_DOCUMENTS_ERROR_KEYS[error.code] as TranslationKey));
  return (
    <View style={styles.section}>
      <ErrorState message={message} language={language} />
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
  instructions: { fontSize: 13, color: colors.text.secondary, marginBottom: spacing[3] },
  section: { marginTop: spacing[2] },
  modeRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  modeButton: { flex: 1, minWidth: 0, height: 34, paddingVertical: 0, paddingHorizontal: spacing[1], borderWidth: 1, borderColor: '#A8CCFF', borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F1FF' },
  modeSelected: { backgroundColor: '#0862BC', borderColor: '#0862BC' },
  modeText: { color: '#0759B8', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  modeTextSelected: { color: '#FFFFFF' },
  modeTextUrdu: { fontSize: 11, lineHeight: 28 },
  slotLabel: { fontSize: 14, color: colors.text.primary, marginBottom: spacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap', marginTop: spacing[1] },
  listItem: { marginBottom: spacing[2] },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: 8,
    backgroundColor: colors.surface.raised,
    padding: spacing[2],
  },
  fileText: { flex: 1, fontSize: 13, color: colors.text.secondary },
  emptyText: { fontSize: 13, color: colors.text.tertiary, marginTop: spacing[1] },
  previewImage: { width: 48, height: 48, borderRadius: 6 },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
});
