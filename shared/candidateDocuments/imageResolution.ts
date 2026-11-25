// The smallest photo the candidate document uploads accept: both sides at
// least MIN_IMAGE_SIDE pixels, so the document stays readable. Mirrors the
// backend's Candidates::Documents::ImageDimensions::MINIMUM_SIDE, which stays
// authoritative -- this only refuses a too-small photo the moment it's picked.
// PDFs have no pixel size and are never checked; there is no maximum size
// beyond the 5 MB file limit.

export const MIN_IMAGE_SIDE = 500;

export interface ImageSize {
  width: number;
  height: number;
}

/** True when either side is below MIN_IMAGE_SIDE. */
export function isImageTooSmall({ width, height }: ImageSize): boolean {
  return Math.min(width, height) < MIN_IMAGE_SIDE;
}

/** The first size that is too small, or null when every size passes (unknown sizes are skipped). */
export function firstTooSmallImage(sizes: ReadonlyArray<ImageSize | null>): ImageSize | null {
  return sizes.find((size): size is ImageSize => size !== null && isImageTooSmall(size)) ?? null;
}
