import { useMutation } from '@tanstack/react-query';
import { candidateImportClient, type CandidateImportError } from '../../../../lib/candidate-import-client';

/** Triggers a browser file-save from already-fetched CSV text -- the actual authenticated fetch happens in `candidateImportClient.downloadTemplate()`; this only turns its result into a download, which a plain `<a href>` can't do for an endpoint that requires an Authorization header. */
function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Downloads the real, backend-served, permission-checked CSV template (GET /admin/candidate_imports/template) and saves it -- never a client-generated placeholder, since the required/optional/template_version columns are the parser's actual current contract. */
export function useCsvTemplateDownload() {
  return useMutation<void, CandidateImportError, void>({
    mutationFn: async () => {
      const template = await candidateImportClient.downloadTemplate();
      triggerDownload(template.content, template.filename);
    },
  });
}
