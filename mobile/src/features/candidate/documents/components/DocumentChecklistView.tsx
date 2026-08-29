import { useEffect } from 'react';
import { View } from 'react-native';
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
  onReturnToSignIn: () => void;
}

/** The full candidate documents screen content -- mirrors web's DocumentChecklistView.tsx exactly. */
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
    return <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={onRetry} />;
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
    <View>
      <Card noPadding>
        {checklist.map((item) => (
          <DocumentChecklistItemRow
            key={item.requirementCode}
            item={item}
            language={language}
            t={t}
            isActive={upload.activeRequirementCode === item.requirementCode}
            isAnyUploadPending={upload.mutation.isPending}
            document={upload.document}
            validationError={upload.validationError}
            uploadError={upload.mutation.error}
            isUploading={upload.mutation.isPending}
            isPccRequirement={upload.isPccRequirement}
            issuedOn={upload.issuedOn}
            onIssuedOnChange={upload.setIssuedOn}
            issuedOnError={upload.issuedOnError}
            onStartUpload={upload.startUpload}
            onCancel={upload.cancelUpload}
            onPickDocument={upload.pickDocument}
            onRemoveDocument={upload.removeDocument}
            onSubmit={upload.submit}
          />
        ))}
      </Card>
    </View>
  );
}
