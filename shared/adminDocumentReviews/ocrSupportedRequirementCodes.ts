// Mirrors descon-be's DocumentType::OCR_EXTRACTION_DOCUMENT_TYPE_CODES
// (MPS-404) -- a hardcoded, fixed business rule (not admin-configurable
// reference data), so a plain constant list here is the right mirror
// rather than a fetched value.
export const OCR_SUPPORTED_REQUIREMENT_CODES = ['passport', 'cnic_front', 'cnic_back', 'next_of_kin_cnic'] as const;

export function supportsOcrExtraction(requirementCode: string): boolean {
  return (OCR_SUPPORTED_REQUIREMENT_CODES as readonly string[]).includes(requirementCode);
}
