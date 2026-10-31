// Who may be a candidate's next of kin (client rule) -- mirrors descon-be's
// CandidateDocument::NEXT_OF_KIN_RELATIONS. The candidate picks one when
// uploading their next of kin's CNIC; a wife also needs the marriage
// certificate, which the backend then adds to the checklist.

export const NEXT_OF_KIN_REQUIREMENT_CODE = 'next_of_kin_cnic';

export const NEXT_OF_KIN_RELATIONS = [
  'father',
  'mother',
  'brother',
  'wife',
  'son',
  'unmarried_sister',
  'unmarried_daughter',
] as const;

export type NextOfKinRelation = (typeof NEXT_OF_KIN_RELATIONS)[number];

export const NEXT_OF_KIN_RELATION_KEYS = {
  father: 'candidateDocumentsNextOfKinFather',
  mother: 'candidateDocumentsNextOfKinMother',
  brother: 'candidateDocumentsNextOfKinBrother',
  wife: 'candidateDocumentsNextOfKinWife',
  son: 'candidateDocumentsNextOfKinSon',
  unmarried_sister: 'candidateDocumentsNextOfKinUnmarriedSister',
  unmarried_daughter: 'candidateDocumentsNextOfKinUnmarriedDaughter',
} as const satisfies Record<NextOfKinRelation, string>;

export function isNextOfKinRelation(value: unknown): value is NextOfKinRelation {
  return typeof value === 'string' && (NEXT_OF_KIN_RELATIONS as readonly string[]).includes(value);
}
