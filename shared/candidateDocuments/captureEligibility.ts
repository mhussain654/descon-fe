// Requirement codes for formal, institution-issued documents (a resume,
// an employer's experience letter, professional certificates) where a
// phone camera capture is a poor fit -- these requirements keep only
// "Choose file", never "Take photo"/"Choose from gallery". Every other
// requirement (ID cards, government certificates, bank/cheque images) is
// naturally a single physical item a candidate can photograph directly.
// A UI-affordance decision only, mirrors PCC_REQUIREMENT_CODE's single-
// requirement special-casing in pccIssueDate.ts.
const NON_PHOTO_REQUIREMENT_CODES = new Set(['cv', 'experience_letter', 'certificates']);

export function isCameraCaptureEligible(requirementCode: string): boolean {
  return !NON_PHOTO_REQUIREMENT_CODES.has(requirementCode);
}
