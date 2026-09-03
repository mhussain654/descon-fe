import { useMutation } from '@tanstack/react-query';
import { candidateImportClient, type CandidateImportError } from '../../../../lib/candidate-import-client';
import { triggerCsvDownload } from '../triggerCsvDownload';

/** Downloads this batch's rejected/skipped row errors as UTF-8 CSV (GET /admin/candidate_imports/{id}/error_export) and saves it. */
export function useErrorExportDownload(importId: string) {
  return useMutation<void, CandidateImportError, void>({
    mutationFn: async () => {
      const file = await candidateImportClient.downloadErrorExport(importId);
      triggerCsvDownload(file.content, file.filename);
    },
  });
}
