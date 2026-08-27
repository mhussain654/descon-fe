import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button } from '../../../../design-system';
import { colors, fontWeights, spacing } from '../../../../design-system/tokens';
import {
  CANDIDATE_DOCUMENT_STATUS_KEYS,
  CANDIDATE_DOCUMENT_STATUS_TONES,
} from '../../../../../../shared/candidateDocuments/statusLabels';
import { formatFileSize } from '../../../../../../shared/candidateDocuments/formatting';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { CandidateDocumentChecklistItem, CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import type { FileValidationError } from '../../../../../../shared/candidateDocuments/fileValidation';
import type { PickedDocument } from '../hooks/useDocumentUpload';
import { DocumentUploadPanel } from './DocumentUploadPanel';

export interface DocumentChecklistItemRowProps {
  item: CandidateDocumentChecklistItem;
  language: Language;
  t: (key: TranslationKey) => string;
  isActive: boolean;
  isAnyUploadPending: boolean;
  document: PickedDocument | null;
  validationError: FileValidationError | null;
  uploadError: CandidateDocumentsError | null;
  isUploading: boolean;
  onStartUpload: (requirementCode: string) => void;
  onCancel: () => void;
  onPickDocument: () => void;
  onRemoveDocument: () => void;
  onSubmit: () => void;
}

/** One requirement's row -- mirrors web's DocumentChecklistItemRow.tsx exactly. */
export function DocumentChecklistItemRow({
  item,
  language,
  t,
  isActive,
  isAnyUploadPending,
  document,
  validationError,
  uploadError,
  isUploading,
  onStartUpload,
  onCancel,
  onPickDocument,
  onRemoveDocument,
  onSubmit,
}: DocumentChecklistItemRowProps) {
  const statusKey = CANDIDATE_DOCUMENT_STATUS_KEYS[item.status] as TranslationKey;
  const tone = CANDIDATE_DOCUMENT_STATUS_TONES[item.status];

  // Use `replacement_allowed` from the API directly -- never infer it from
  // `status` (ticket: "Use replacement_allowed from the API. Do not infer
  // permission from the status alone.").
  const canUpload = item.status === 'missing';
  const canReplace = item.document !== null && item.replacementAllowed;
  const hasAction = canUpload || canReplace;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <Badge tone={item.required ? 'brand' : 'neutral'}>
              {t(item.required ? 'candidateDocumentsRequiredLabel' : 'candidateDocumentsOptionalLabel')}
            </Badge>
          </View>
          <Text style={styles.detail}>
            {item.document
              ? `${item.document.fileName} · ${formatFileSize(item.document.fileSize, language)} · ${t('uploadedOnPrefix')} ${formatDate(item.document.uploadedAt, language)}`
              : t('notUploadedYet')}
          </Text>
        </View>

        <View style={styles.actionGroup}>
          <Badge tone={tone}>{t(statusKey)}</Badge>
          {!isActive && hasAction ? (
            <Button variant="outline" size="sm" onPress={() => onStartUpload(item.requirementCode)} disabled={isAnyUploadPending}>
              {t(canUpload ? 'candidateDocumentsUploadAction' : 'candidateDocumentsReplaceAction')}
            </Button>
          ) : null}
          {!isActive && !hasAction ? <Text style={styles.noAction}>{t('candidateDocumentsNoActionAvailable')}</Text> : null}
        </View>
      </View>

      {isActive ? (
        <DocumentUploadPanel
          labelText={t(canUpload ? 'candidateDocumentsUploadAction' : 'candidateDocumentsReplaceAction')}
          document={document}
          validationError={validationError}
          uploadError={uploadError}
          isUploading={isUploading}
          onPickDocument={onPickDocument}
          onRemoveDocument={onRemoveDocument}
          onCancel={onCancel}
          onSubmit={onSubmit}
          t={t}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: colors.border.default, paddingHorizontal: spacing[5], paddingVertical: spacing[4] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3], flexWrap: 'wrap' },
  titleGroup: { flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: fontWeights.medium, color: colors.text.primary },
  detail: { marginTop: spacing[1], fontSize: 13, color: colors.text.secondary },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  noAction: { fontSize: 13, color: colors.text.tertiary },
});
