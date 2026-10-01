import type { CandidateDocumentChecklistItem } from './types';

/**
 * Display order matching the approved prototype exactly (its own document
 * list was always shown in this fixed sequence, never alphabetically). The
 * backend has no ordering concept of its own -- `RequirementResolver` sorts
 * by `document_type.code`, which is a stable but arbitrary API contract, not
 * a presentation decision -- so this is display-only sorting on the client.
 */
// 'bank_details'/'cheque_image' were removed from this list (and from the
// backend's active document requirements) once candidates started
// submitting bank information through the dedicated, structured
// CandidateBankDetail resource instead of a generic document upload -- see
// web/src/features/candidate/documents/components/BankDetailsPanel.tsx.
const PROTOTYPE_ORDER = [
  'passport',
  'cnic_front',
  'cnic_back',
  'next_of_kin_cnic',
  'police_character',
  'police_character_certificate',
  'cv',
  'experience_letter',
  'certificates',
  'polio_certificate',
] as const;

/** Requirement codes the prototype never modeled sort after every known one, in whatever order the API returned them -- never dropped, never crashing. */
export function sortByPrototypeOrder<T extends Pick<CandidateDocumentChecklistItem, 'requirementCode'>>(
  checklist: T[]
): T[] {
  const priority = (requirementCode: string) => {
    const index = PROTOTYPE_ORDER.indexOf(requirementCode as (typeof PROTOTYPE_ORDER)[number]);
    return index === -1 ? PROTOTYPE_ORDER.length : index;
  };

  return [...checklist].sort((a, b) => priority(a.requirementCode) - priority(b.requirementCode));
}

// The candidate's identity documents (passport, both CNIC sides, next of kin
// CNIC) read as one cluster at the top of the checklist -- BankDetailsPanel
// renders between this cluster and the rest of the checklist, not above
// everything, so identity-document upload isn't interrupted by an unrelated
// bank-details form.
const CNIC_CLUSTER_CODES = new Set(['passport', 'cnic_front', 'cnic_back', 'next_of_kin_cnic']);

/** Splits an already-`sortByPrototypeOrder`-sorted checklist so callers can render BankDetailsPanel between the two groups, each still in prototype order. */
export function splitAroundCnicCluster<T extends Pick<CandidateDocumentChecklistItem, 'requirementCode'>>(
  checklist: T[]
): { cnicClusterItems: T[]; remainingItems: T[] } {
  return {
    cnicClusterItems: checklist.filter((item) => CNIC_CLUSTER_CODES.has(item.requirementCode)),
    remainingItems: checklist.filter((item) => !CNIC_CLUSTER_CODES.has(item.requirementCode)),
  };
}
