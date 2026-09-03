import { useMutation } from '@tanstack/react-query';
import { candidateImportClient, type CandidateImportError } from '../../../../lib/candidate-import-client';
import { triggerCsvDownload } from '../triggerCsvDownload';

/** Downloads the real, backend-served, permission-checked CSV template (GET /admin/candidate_imports/template) and saves it -- never a client-generated placeholder, since the required/optional/template_version columns are the parser's actual current contract. */
export function useCsvTemplateDownload() {
  return useMutation<void, CandidateImportError, void>({
    mutationFn: async () => {
      const template = await candidateImportClient.downloadTemplate();
      triggerCsvDownload(template.content, template.filename);
    },
  });
}
