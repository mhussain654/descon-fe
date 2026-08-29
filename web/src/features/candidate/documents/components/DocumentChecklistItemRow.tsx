import { Badge, Button } from '../../../../design-system';
import {
  CANDIDATE_DOCUMENT_STATUS_KEYS,
  CANDIDATE_DOCUMENT_STATUS_TONES,
  PCC_COMPLIANCE_STATUS_KEYS,
  PCC_COMPLIANCE_STATUS_TONES,
} from '../../../../../../shared/candidateDocuments/statusLabels';
import { formatFileSize } from '../../../../../../shared/candidateDocuments/formatting';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { CandidateDocumentChecklistItem, CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import type { FileValidationError } from '../../../../../../shared/candidateDocuments/fileValidation';
import { DocumentUploadPanel } from './DocumentUploadPanel';

export interface DocumentChecklistItemRowProps {
  item: CandidateDocumentChecklistItem;
  language: Language;
  t: (key: TranslationKey) => string;
  isActive: boolean;
  isAnyUploadPending: boolean;
  file: File | null;
  validationError: FileValidationError | null;
  uploadError: CandidateDocumentsError | null;
  isUploading: boolean;
  onStartUpload: (requirementCode: string) => void;
  onCancel: () => void;
  onSelectFile: (file: File | null) => void;
  onSubmit: () => void;
}

/** One requirement's row: name, required/optional, status, uploaded metadata, and the upload/replace action (or none, per `replacementAllowed`). */
export function DocumentChecklistItemRow({
  item,
  language,
  t,
  isActive,
  isAnyUploadPending,
  file,
  validationError,
  uploadError,
  isUploading,
  onStartUpload,
  onCancel,
  onSelectFile,
  onSubmit,
}: DocumentChecklistItemRowProps) {
  const statusKey = CANDIDATE_DOCUMENT_STATUS_KEYS[item.status] as TranslationKey;
  const tone = CANDIDATE_DOCUMENT_STATUS_TONES[item.status];
  const complianceStatus = item.document?.complianceStatus;

  // Use `replacement_allowed` from the API directly -- never infer it from
  // `status` (ticket: "Use replacement_allowed from the API. Do not infer
  // permission from the status alone.").
  const canUpload = item.status === 'missing';
  const canReplace = item.document !== null && item.replacementAllowed;
  const hasAction = canUpload || canReplace;

  return (
    <div className="border-b border-border px-6 py-5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-text-primary">{item.name}</span>
            <Badge tone={item.required ? 'brand' : 'neutral'}>
              {t(item.required ? 'candidateDocumentsRequiredLabel' : 'candidateDocumentsOptionalLabel')}
            </Badge>
          </div>
          <div className="mt-1 text-sm text-text-secondary">
            {item.document ? (
              <>
                <span>{item.document.fileName}</span>
                {' · '}
                <span>{formatFileSize(item.document.fileSize, language)}</span>
                {' · '}
                <span>
                  {t('uploadedOnPrefix')} {formatDate(item.document.uploadedAt, language)}
                </span>
              </>
            ) : (
              t('notUploadedYet')
            )}
          </div>

          {item.document?.issuedOn && item.document?.expiresOn ? (
            <div className="mt-1 text-sm text-text-secondary">
              {t('candidateDocumentsPccIssuedOnLabel')}: {formatDate(item.document.issuedOn, language)} ·{' '}
              {t('candidateDocumentsPccExpiresOnLabel')}: {formatDate(item.document.expiresOn, language)}
            </div>
          ) : null}

          {item.document?.reviewedAt ? (
            <div className="mt-1 text-sm text-text-secondary">
              {t('adminDocumentReviewDecidedAtLabel')}: {formatDate(item.document.reviewedAt, language)}
            </div>
          ) : null}

          {item.document?.rejectionReason ? (
            <div className="mt-1 text-sm text-danger">
              {t('candidateDocumentsRejectionReasonLabel')}: {item.document.rejectionReason}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={tone}>{t(statusKey)}</Badge>
          {complianceStatus ? (
            <Badge tone={PCC_COMPLIANCE_STATUS_TONES[complianceStatus]}>{t(PCC_COMPLIANCE_STATUS_KEYS[complianceStatus] as TranslationKey)}</Badge>
          ) : null}
          {!isActive && hasAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onStartUpload(item.requirementCode)}
              disabled={isAnyUploadPending}
            >
              {t(canUpload ? 'candidateDocumentsUploadAction' : 'candidateDocumentsReplaceAction')}
            </Button>
          ) : null}
          {!isActive && !hasAction ? (
            <span className="text-sm text-text-tertiary">{t('candidateDocumentsNoActionAvailable')}</span>
          ) : null}
        </div>
      </div>

      {isActive ? (
        <DocumentUploadPanel
          labelText={t(canUpload ? 'candidateDocumentsUploadAction' : 'candidateDocumentsReplaceAction')}
          file={file}
          validationError={validationError}
          uploadError={uploadError}
          isUploading={isUploading}
          onSelect={onSelectFile}
          onCancel={onCancel}
          onSubmit={onSubmit}
          t={t}
        />
      ) : null}
    </div>
  );
}
