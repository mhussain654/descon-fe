import { acceptsImages, type FileSetLayout, type PairUploadMode } from '../../../../../shared/candidateDocuments/fileSet';
import type { DocumentUploadRules } from '../../../../../shared/candidateDocuments/types';

/**
 * Candidates may upload each document as a scanned PDF or as photos (taken
 * with the camera, chosen from the gallery, or picked as a JPEG/PNG file), and
 * a two-page/two-sided document as one PDF or a photo of each page/side.
 * Photos must be at least 500 x 500 pixels (shared/candidateDocuments/imageResolution.ts).
 *
 * Setting this to `true` hides the photo options again and offers PDF only.
 * See docs/mobile-documents-pdf-only.md.
 */
export const PDF_ONLY_UPLOADS = false;

const PDF = 'application/pdf';

/** The upload options for a given setting -- exported so tests can exercise the hidden photo options too. */
export function createUploadOptions(pdfOnly: boolean) {
  return {
    /** The file types the picker offers and the hint lists for this requirement. */
    offeredContentTypes(rules: DocumentUploadRules): string[] {
      if (!pdfOnly) return [...rules.acceptedContentTypes];
      // A requirement that doesn't take PDFs at all keeps its own types, so the candidate is never left with nothing to pick.
      return rules.acceptedContentTypes.includes(PDF) ? [PDF] : [...rules.acceptedContentTypes];
    },

    /** Whether "Take photo" / "Choose from gallery" are shown for this requirement. */
    offersPhotoCapture(rules: DocumentUploadRules): boolean {
      return !pdfOnly && acceptsImages(rules);
    },

    /** The pair upload modes the candidate can choose between (empty when the document isn't a pair with a PDF option). */
    offeredPairModes(layout: FileSetLayout | null): PairUploadMode[] {
      if (layout?.kind !== 'pair' || !layout.combinedAllowed) return [];
      return pdfOnly ? ['combined'] : ['parts', 'combined'];
    },
  };
}

export const { offeredContentTypes, offersPhotoCapture, offeredPairModes } = createUploadOptions(PDF_ONLY_UPLOADS);
