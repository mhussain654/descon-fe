import { StyleSheet, View } from 'react-native';
import { Button, OfflineState, ValidationMessage } from '../../../../design-system';
import { colors, spacing } from '../../../../design-system/tokens';
import { DOCUMENT_ACCESS_ERROR_KEYS } from '../../../../../../shared/candidateDocuments/documentAccessErrorMessages';
import type { DocumentAccessError } from '../../../../lib/candidate-documents-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';

export interface DocumentViewPanelProps {
  isRequesting: boolean;
  error: DocumentAccessError | null;
  onView: () => void;
  onDownload: () => void;
  t: (key: TranslationKey) => string;
  language: Language;
}

/**
 * Inline "View" / "Download" panel for a document the candidate already
 * uploaded -- expands below the row the same way DocumentUploadPanel does
 * for an upload/replace action, so the same familiar tap-to-expand pattern
 * applies everywhere a candidate document row can be interacted with.
 */
export function DocumentViewPanel({ isRequesting, error, onView, onDownload, t, language }: DocumentViewPanelProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Button variant="outline" size="sm" onPress={onView} disabled={isRequesting} language={language}>
          {t('candidateDocumentsViewAction')}
        </Button>
        <Button variant="outline" size="sm" onPress={onDownload} disabled={isRequesting} language={language}>
          {t('candidateDocumentsDownloadAction')}
        </Button>
      </View>

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

  const key = DOCUMENT_ACCESS_ERROR_KEYS[error.code] as TranslationKey;
  const message = error.message ?? t(key);
  return (
    <View style={styles.errorNotice}>
      <ValidationMessage tone="error" language={language}>
        {message}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' },
  errorNotice: { marginTop: spacing[3] },
});
