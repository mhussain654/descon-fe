import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import type { AdminDocumentReviewError, DocumentSubmissionDetail } from '../../../../lib/admin-document-reviews-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

export function useDocumentSubmission(submissionId: string | undefined) {
  const { language } = useLanguage();

  return useQuery<DocumentSubmissionDetail, AdminDocumentReviewError>({
    queryKey: documentQueries.staffSubmission(submissionId ?? '', language),
    queryFn: () => adminDocumentReviewsClient.getSubmission(submissionId as string),
    enabled: Boolean(submissionId),
  });
}
