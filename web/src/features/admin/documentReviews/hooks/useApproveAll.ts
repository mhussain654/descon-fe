import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import { adminBankDetailsClient } from '../../../../lib/admin-bank-details-client';
import { supportsOcrExtraction } from '../../../../../../shared/adminDocumentReviews/ocrSupportedRequirementCodes';
import type { SubmissionDocument, VerifyDocumentDates } from '../../../../../../shared/adminDocumentReviews/types';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

function randomKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The dates the scanner read, as the single-document approve dialog would pre-fill them; none when it read nothing. */
async function scannedDates(document: SubmissionDocument): Promise<VerifyDocumentDates> {
  if (!supportsOcrExtraction(document.requirementCode)) return {};
  try {
    const extraction = await adminDocumentReviewsClient.getExtraction(document.id);
    return { issuedOn: extraction.issuedOn || undefined, expiresOn: extraction.expiresOn || undefined };
  } catch {
    return {};
  }
}

interface ApproveAllInput {
  documents: SubmissionDocument[];
  /** True when the bank details are waiting for review. */
  bankDetailPending: boolean;
}

/**
 * Approves every document still waiting for review, then the bank details, one
 * after another through the same calls as the single approve actions -- so each
 * keeps its own audit entry, and approving the last item moves the candidate on
 * automatically (CandidateWorkflows::AutomaticTransitionService). An item that
 * fails is left for staff to approve by hand; the rest still go through.
 */
export function useApproveAll(submissionId: string, candidateId: string | undefined) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [isApproving, setIsApproving] = useState(false);

  const approveAll = useCallback(
    async ({ documents, bankDetailPending }: ApproveAllInput) => {
      if (isApproving || !candidateId) return;
      setIsApproving(true);
      let failed = 0;
      try {
        for (const document of documents.filter((doc) => doc.status === 'pending_review')) {
          try {
            await adminDocumentReviewsClient.verifyDocument(document.id, randomKey('admin-approve-all'), await scannedDates(document));
          } catch {
            failed += 1;
          }
        }
        if (bankDetailPending) {
          try {
            await adminBankDetailsClient.verify(candidateId, randomKey('admin-bank-detail-verified'));
          } catch {
            failed += 1;
          }
        }
      } finally {
        queryClient.invalidateQueries({ queryKey: documentQueries.staffSubmission(submissionId, language) });
        queryClient.invalidateQueries({ queryKey: documentQueries.staffQueueAll() });
        queryClient.invalidateQueries({ queryKey: documentQueries.staffCandidateSummary(candidateId, language) });
        queryClient.invalidateQueries({ queryKey: ['adminBankDetail', candidateId] });
        setIsApproving(false);
      }
      if (failed === 0) toast.success(t('adminDocumentReviewApproveAllSuccessToast'));
      else toast.error(interpolate(t('adminDocumentReviewApproveAllPartialToast'), { count: failed }));
    },
    [isApproving, candidateId, queryClient, submissionId, language, t]
  );

  return { approveAll, isApproving };
}
