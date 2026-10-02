import { useCallback, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';
import type { DocumentAccess, DocumentAccessError } from '../../../../lib/candidate-documents-client';
import { useShortLivedAccess } from '../../workflow/hooks/useShortLivedAccess';

/**
 * Candidate-facing "request a short-lived signed URL, then render a real
 * link" hook for a document the candidate already uploaded -- mirrors
 * useVisaCopyAccess.ts exactly, reusing the same `useShortLivedAccess` state
 * machine (never persisted, auto-expiring, cleared on session change).
 *
 * A candidate's checklist can show many documents at once, but the state
 * machine only tracks one in-flight/most-recent access at a time (same as
 * every other candidate-document-access hook in this app). `lastRequestedDocumentId`
 * lets the checklist know which row a pending request or a resulting
 * error/link belongs to -- check it against `access?.documentId` for a
 * resolved link, same as useVisaCopyAccess's caller already does for
 * `visaDecisionId`.
 */
export function useDocumentAccess() {
  const { session } = useAuth();
  const access = useShortLivedAccess<DocumentAccess, DocumentAccessError>();
  const [lastRequestedDocumentId, setLastRequestedDocumentId] = useState<string | null>(null);
  const [lastRequestedFileId, setLastRequestedFileId] = useState<string | null>(null);

  /** `fileId` picks one file of a multi-file document; without it the backend serves the representative file. */
  const requestDocumentAccess = useCallback(
    (documentId: string, fileId?: string) => {
      if (!session) return Promise.resolve();
      setLastRequestedDocumentId(documentId);
      setLastRequestedFileId(fileId ?? null);
      return access.requestAccess(() =>
        candidateDocumentsClient.requestDocumentAccess(session.accessToken, documentId, undefined, fileId)
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [session, access.requestAccess]
  );

  return { ...access, requestDocumentAccess, lastRequestedDocumentId, lastRequestedFileId };
}
