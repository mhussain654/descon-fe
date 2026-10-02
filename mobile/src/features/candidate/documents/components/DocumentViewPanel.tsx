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
  t: (key: TranslationKey) => string;
  language: Language;
}

/**
 * Inline "View" / "Download" panel for a document the candidate already
 * uploaded -- expands below the row the same way DocumentUploadPanel does.
 * A multi-file document (e.g. CNIC front and back) lists every file, each
 * with its own actions.
 */
export function DocumentViewPanel({ files, isRequesting, error, onView, onDownload, t, language }: DocumentViewPanelProps) {
  const actions = (fileId?: string) => (
    <View style={styles.row}>
      <Button variant="outline" size="sm" onPress={() => onView(fileId)} disabled={isRequesting} language={language}>
        {t('candidateDocumentsViewAction')}
      </Button>
      <Button variant="outline" size="sm" onPress={() => onDownload(fileId)} disabled={isRequesting} language={language}>
        {t('candidateDocumentsDownloadAction')}
      </Button>
    </View>
  );

  return (
    <View style={styles.container}>
      {files.length > 1
        ? files.map((file) => (
            <View key={file.id} style={styles.fileRow}>
              <Text style={[styles.fileName, { fontFamily: getFontFamily(language, 'medium') }]} numberOfLines={1}>
                {file.sideCode ? `${t(SIDE_CODE_LABEL_KEYS[file.sideCode] as TranslationKey)} • ` : ''}
                {file.fileName}
              </Text>
              {actions(file.id)}
            </View>
          ))
        : actions(files[0]?.id)}

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
  fileRow: { marginBottom: spacing[3] },
  fileName: { fontSize: 14, color: colors.text.primary, marginBottom: spacing[1] },
  errorNotice: { marginTop: spacing[3] },
});
