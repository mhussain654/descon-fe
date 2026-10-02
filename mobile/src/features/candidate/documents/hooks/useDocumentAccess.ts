import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';
import type { DocumentAccessDisposition, DocumentAccessError } from '../../../../lib/candidate-documents-client';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';

/**
 * Requests a short-lived signed URL for one of the candidate's own
 * already-uploaded documents and hands it straight to the OS via
 * `Linking.openURL` -- mirrors useVisaCopyAccess.ts's identical
 * "request-on-tap, hand off to the OS" rationale. A candidate can have many
 * documents, so the target document's id is tracked across the request
 * (including after it finishes) so the screen can show a failure against
 * the specific row that caused it.
 *
 * `disposition: 'inline'` opens the file for viewing; `'attachment'` asks
 * the server for a URL that prompts the device to download and save it --
 * the same underlying request either way, just a different intent.
 */
export function useDocumentAccess() {
  const { session } = useAuth();
  const [targetDocumentId, setTargetDocumentId] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<DocumentAccessError | null>(null);

  const requestDocument = useCallback(
    async (documentId: string, disposition: DocumentAccessDisposition) => {
      if (!session || isRequesting) return;
      setTargetDocumentId(documentId);
      setIsRequesting(true);
      setError(null);
      try {
        const access = await candidateDocumentsClient.requestDocumentAccess(session.accessToken, documentId, disposition);
        // Fails closed: null when the signed URL doesn't resolve to our own
        // API origin (a malformed backend response, an unexpected absolute
        // URL, a dangerous scheme) -- never hand that to Linking.openURL.
        const url = resolveDocumentAccessUrl(access.url, process.env.EXPO_PUBLIC_API_BASE_URL ?? '');
        if (!url) {
          setError({ code: 'UNKNOWN' });
          return;
        }
        await Linking.openURL(url);
      } catch (requestError) {
        setError(requestError as DocumentAccessError);
      } finally {
        setIsRequesting(false);
      }
    },
    [session, isRequesting]
  );

  const viewDocument = useCallback((documentId: string) => requestDocument(documentId, 'inline'), [requestDocument]);
  const downloadDocument = useCallback((documentId: string) => requestDocument(documentId, 'attachment'), [requestDocument]);

  return {
    viewDocument,
    downloadDocument,
    targetDocumentId,
    isRequesting,
    error,
    clearError: () => setError(null),
  };
}
