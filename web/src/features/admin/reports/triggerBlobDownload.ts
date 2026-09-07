/** Triggers a browser file-save from an already-fetched Blob -- the actual authenticated fetch happens in the reports client (GET .../export requires an Authorization header, so a plain `<a href>` can't be used directly). Generalizes triggerCsvDownload.ts's identical pattern for a binary (xlsx/pdf) or text (csv) Blob rather than a raw string. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
