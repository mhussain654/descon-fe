import { useQuery } from '@tanstack/react-query';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import type { AdminDocumentReviewError, DocumentSubmissionDetail } from '../../../../lib/admin-document-reviews-client';

export const DOCUMENT_REVIEW_SUBMISSION_QUERY_KEY = 'admin-document-review-submission';

export function useDocumentSubmission(submissionId: string | undefined) {
  return useQuery<DocumentSubmissionDetail, AdminDocumentReviewError>({
    queryKey: [DOCUMENT_REVIEW_SUBMISSION_QUERY_KEY, submissionId],
    queryFn: () => adminDocumentReviewsClient.getSubmission(submissionId as string),
    enabled: Boolean(submissionId),
  });
}
