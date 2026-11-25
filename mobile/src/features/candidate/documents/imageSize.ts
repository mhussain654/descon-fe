import { Image } from 'react-native';
import type { ImageSize } from '../../../../../shared/candidateDocuments/imageResolution';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

/** Whether a picked file is a JPEG/PNG photo, by its reported type or, failing that, its name. */
export function isImageFile(name: string | null | undefined, mimeType: string | null | undefined): boolean {
  if (mimeType) return IMAGE_TYPES.has(mimeType);
  return /\.(jpe?g|png)$/i.test(name ?? '');
}

/**
 * A picked photo's pixel size. The camera and gallery report it; the file
 * picker doesn't, so it's read from the file. Null when it can't be read --
 * the backend still checks the size on upload.
 */
export function readImageSize(uri: string, known?: { width?: number; height?: number }): Promise<ImageSize | null> {
  if (known?.width && known?.height) return Promise.resolve({ width: known.width, height: known.height });
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve(width > 0 && height > 0 ? { width, height } : null),
      () => resolve(null)
    );
  });
}
