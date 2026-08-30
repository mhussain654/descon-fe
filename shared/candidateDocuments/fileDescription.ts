// Human-readable descriptors for a selected file, shown to the candidate
// before upload alongside its filename and size (ticket: "show appropriate
// selected-file information: Filename, File type, Size"). Platform-
// independent, operating on the same descriptor shape fileValidation.ts
// uses, since both web's File and mobile's picker asset reduce down to it.
import type { SelectedFileDescriptor } from './fileValidation';

const TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
};

/** "PDF"/"JPEG"/"PNG" for a recognized MIME type, falling back to the file's own extension when the platform didn't report one -- never the raw MIME string. */
export function describeFileType(file: SelectedFileDescriptor): string {
  if (file.type && TYPE_LABELS[file.type]) return TYPE_LABELS[file.type];
  const extension = file.name.split('.').pop();
  return extension ? extension.toUpperCase() : '';
}

/** Whether a selected file is one either platform can safely render a local image preview for, before upload. */
export function isPreviewableImageType(file: SelectedFileDescriptor): boolean {
  return file.type === 'image/jpeg' || file.type === 'image/png';
}
