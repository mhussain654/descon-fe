import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, OfflineState, ValidationMessage, getFontFamily } from '../../../../design-system';
import { colors, spacing } from '../../../../design-system/tokens';
import { DOCUMENT_ACCESS_ERROR_KEYS } from '../../../../../../shared/candidateDocuments/documentAccessErrorMessages';
import { SIDE_CODE_LABEL_KEYS } from '../../../../../../shared/candidateDocuments/fileSet';
import type { CandidateDocumentFile, DocumentAccessError } from '../../../../lib/candidate-documents-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';

export interface DocumentViewPanelProps {
  /** The document's files; with more than one, each gets its own View/Download actions. */
  files: CandidateDocumentFile[];
  isRequesting: boolean;
  error: DocumentAccessError | null;
  onView: (fileId?: string) => void;
  onDownload: (fileId?: string) => void;
  onReplace?: () => void;
  replacementDisabled?: boolean;
  t: (key: TranslationKey) => string;
  language: Language;
}

/**
 * Inline "View" / "Download" panel for a document the candidate already
 * uploaded -- expands below the row the same way DocumentUploadPanel does.
 * A multi-file document (e.g. CNIC front and back) lists every file, each
 * with its own actions.
 */
export function DocumentViewPanel({ files, isRequesting, error, onView, onDownload, onReplace, replacementDisabled = false, t, language }: DocumentViewPanelProps) {
  const [fileAction, setFileAction] = useState<'view' | 'download' | null>(null);
  const isMultiFile = files.length > 1;
  const fileLabel = (file: CandidateDocumentFile) => `${file.sideCode ? `${t(SIDE_CODE_LABEL_KEYS[file.sideCode] as TranslationKey)} • ` : ''}${file.fileName}`;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Button variant="outline" size="sm" style={styles.viewButton} labelStyle={styles.viewLabel} onPress={() => isMultiFile ? setFileAction('view') : onView(files[0]?.id)} disabled={isRequesting} language={language}>{t('candidateDocumentsViewAction')}</Button>
        {onReplace ? <Button variant="outline" size="sm" style={styles.replaceButton} labelStyle={styles.replaceLabel} onPress={onReplace} disabled={replacementDisabled || isRequesting} language={language}>{t('candidateDocumentsReplaceAction')}</Button> : null}
        <Button variant="outline" size="sm" style={styles.downloadButton} labelStyle={styles.downloadLabel} onPress={() => isMultiFile ? setFileAction('download') : onDownload(files[0]?.id)} disabled={isRequesting} language={language}>{t('candidateDocumentsDownloadAction')}</Button>
      </View>
      {isMultiFile ? files.map(file => (
        <View key={file.id} style={[styles.fileRow, language === 'ur' && styles.fileRowRtl]}>
          <Text style={[styles.fileName, { fontFamily: getFontFamily(language, 'medium') }]}>{fileLabel(file)}</Text>
          {fileAction ? <Button variant="outline" size="sm" style={[fileAction === 'view' ? styles.viewButton : styles.downloadButton, styles.fileButton]} labelStyle={[fileAction === 'view' ? styles.viewLabel : styles.downloadLabel, styles.fileButtonLabel]} onPress={() => fileAction === 'view' ? onView(file.id) : onDownload(file.id)} disabled={isRequesting} language={language}>{t(fileAction === 'view' ? 'candidateDocumentsViewAction' : 'candidateDocumentsDownloadAction')}</Button> : null}
        </View>
      )) : null}

      {error ? <DocumentViewErrorNotice error={error} t={t} language={language} /> : null}
    </View>
  );
}

function DocumentViewErrorNotice({
  error,
  t,
  language,
}: {
  error: DocumentAccessError;
  t: (key: TranslationKey) => string;
  language: Language;
}) {
  // The screen signs the candidate out for these -- nothing to show here.
  if (error.code === 'SESSION_EXPIRED' || error.code === 'INACTIVE_ACCOUNT') {
    return null;
  }

  if (error.code === 'OFFLINE') {
    return (
      <View style={styles.errorNotice}>
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} language={language} />
      </View>
    );
  }

  return (
    <View style={styles.errorNotice}>
      <ValidationMessage tone="error" language={language}>
        {error.message ?? t(DOCUMENT_ACCESS_ERROR_KEYS[error.code] as TranslationKey)}
      </ValidationMessage>
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
  row: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  viewButton: { backgroundColor: '#E7F1FF', borderColor: '#A8CCFF', borderRadius: 12 },
  viewLabel: { color: '#0759B8' },
  replaceButton: { backgroundColor: '#FFF3DF', borderColor: '#EFC789', borderRadius: 12 },
  replaceLabel: { color: '#8F4B00' },
  downloadButton: { backgroundColor: '#E6F8EE', borderColor: '#A1DCBD', borderRadius: 12 },
  downloadLabel: { color: '#087443' },
  fileRow: { marginTop: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  fileRowRtl: { flexDirection: 'row-reverse' },
  fileButton: { height: 30, alignSelf: 'center', paddingHorizontal: spacing[2], borderRadius: 10, flexShrink: 0 },
  fileButtonLabel: { fontSize: 12 },
  fileName: { flex: 1, minWidth: 0, fontSize: 13, color: colors.text.primary },
  errorNotice: { marginTop: spacing[3] },
});
