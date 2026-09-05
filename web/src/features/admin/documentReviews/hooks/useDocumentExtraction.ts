import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

/**
 * The latest OCR extraction attempt for one document (MPS-404), feeding the
 * verify dialog's pre-filled, always-editable issue/expiry inputs. Unlike
 * useDocumentAccess.ts's short-lived preview credential, this is safe to
 * cache normally -- it's extracted field data, not a signed access token.
 * `enabled` lets the caller skip fetching for a document type that doesn't
 * support OCR extraction at all.
 */
export function useDocumentExtraction(documentId: string, enabled: boolean) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: documentQueries.staffDocumentExtraction(documentId, language),
    queryFn: () => adminDocumentReviewsClient.getExtraction(documentId),
    enabled,
  });
}
