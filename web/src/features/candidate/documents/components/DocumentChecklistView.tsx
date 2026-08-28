import { useEffect } from 'react';
import {
  Card,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  OfflineState,
  SessionExpiredState,
} from '../../../../design-system';
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from '../../../../../../shared/candidateDocuments/errorMessages';
import type { CandidateDocumentChecklistItem, CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { DocumentChecklistItemRow } from './DocumentChecklistItemRow';
import { useDocumentUpload } from '../hooks/useDocumentUpload';

export interface DocumentChecklistViewProps {
  isLoading: boolean;
  error: CandidateDocumentsError | null;
  checklist: CandidateDocumentChecklistItem[] | undefined;
  language: Language;
  t: (key: TranslationKey) => string;
  onRetry: () => void;
  /** Signs the candidate out and returns them to sign-in -- used for both the checklist fetch's and an upload's session-expired/inactive-account outcomes. */
  onReturnToSignIn: () => void;
}

/** The full candidate documents screen content: progress, every required UI state, and the checklist itself. */
export function DocumentChecklistView({
  isLoading,
  error,
  checklist,
  language,
  t,
  onRetry,
  onReturnToSignIn,
}: DocumentChecklistViewProps) {
  const upload = useDocumentUpload();

  useEffect(() => {
    if (upload.mutation.error?.code === 'SESSION_EXPIRED' || upload.mutation.error?.code === 'INACTIVE_ACCOUNT') {
      onReturnToSignIn();
    }
  }, [upload.mutation.error, onReturnToSignIn]);

  if (isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (error?.code === 'SESSION_EXPIRED') {
    return (
      <SessionExpiredState
        title={t('dsSessionExpiredTitle')}
        description={t('dsSessionExpiredDescription')}
        actionLabel={t('dsSessionExpiredAction')}
        onAction={onReturnToSignIn}
      />
    );
  }

  if (error?.code === 'INACTIVE_ACCOUNT') {
    return (
      <ForbiddenState
        title={t('candidateProfileInactiveAccountTitle')}
        description={t('candidateProfileInactiveAccountDescription')}
        actionLabel={t('candidateProfileInactiveAccountAction')}
        onAction={onReturnToSignIn}
      />
    );
  }

  if (error?.code === 'OFFLINE') {
    return (
      <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={onRetry} />
    );
  }

  if (error) {
    const key = CANDIDATE_DOCUMENTS_ERROR_KEYS[error.code] as TranslationKey;
    return <ErrorState message={error.message ?? t(key)} retryLabel={t('retry')} onRetry={onRetry} />;
  }

  if (!checklist) {
    return <ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={onRetry} />;
  }

  if (checklist.length === 0) {
    return <EmptyState title={t('candidateDocumentsEmptyTitle')} description={t('candidateDocumentsEmptyDescription')} />;
  }

  return (
    <>
      <Card noPadding>
        {checklist.map((item) => (
          <DocumentChecklistItemRow
            key={item.requirementCode}
            item={item}
            language={language}
            t={t}
            isActive={upload.activeRequirementCode === item.requirementCode}
            isAnyUploadPending={upload.mutation.isPending}
            file={upload.file}
            validationError={upload.validationError}
            uploadError={upload.mutation.error}
            isUploading={upload.mutation.isPending}
            onStartUpload={upload.startUpload}
            onCancel={upload.cancelUpload}
            onSelectFile={upload.selectFile}
            onSubmit={upload.submit}
          />
        ))}
      </Card>
    </>
  );
}
