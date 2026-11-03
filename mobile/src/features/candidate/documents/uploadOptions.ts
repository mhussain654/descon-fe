import { acceptsImages, type FileSetLayout, type PairUploadMode } from '../../../../../shared/candidateDocuments/fileSet';
import type { DocumentUploadRules } from '../../../../../shared/candidateDocuments/types';

/**
 * Client decision: candidates upload every document as one scanned PDF, so
 * the documents screen offers only "Choose file" (PDF) -- and, for a
 * two-page/two-sided document, only the one "Scan PDF" option.
 *
 * Photo uploads are hidden, not removed. Taking a photo, choosing from the
 * gallery, separate front/back photo parts and JPEG/PNG files are all still
 * implemented in useDocumentUpload/DocumentUploadPanel, and the backend still
 * accepts them wherever a requirement's upload rules allow them. To offer
 * them again (e.g. photo or selfie capture later), set this to `false`.
 * See docs/mobile-documents-pdf-only.md.
 */
export const PDF_ONLY_UPLOADS = true;

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
