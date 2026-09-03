/** Triggers a browser file-save from already-fetched CSV text -- the actual authenticated fetch happens in the candidate-import client (template download, error export); this only turns an already-fetched result into a download, which a plain `<a href>` can't do for an endpoint that requires an Authorization header. Shared by useCsvTemplateDownload.ts and useErrorExportDownload.ts. */
export function triggerCsvDownload(content: string, filename: string): void {
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
