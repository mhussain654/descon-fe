import { NEXT_OF_KIN_REQUIREMENT_CODE } from './nextOfKin';

// Client feedback: in the next of kin's CNIC instructions ("...or unmarried
// sister or daughter can be your Next of Kin"), the term "Next of Kin" is shown
// in bold. The instructions arrive from the backend as plain, localized text,
// so the emphasis is applied here by matching the term in either language.

export interface InstructionSegment {
  text: string;
  emphasized: boolean;
}

const EMPHASIZED_TERMS: Readonly<Record<string, readonly string[]>> = {
  [NEXT_OF_KIN_REQUIREMENT_CODE]: ['Next of Kin', 'نیکسٹ آف کن'],
};

/**
 * Splits a requirement's instructions into plain and emphasized segments.
 * Requirements without emphasized terms come back as one plain segment.
 */
export function instructionSegments(requirementCode: string | null, instructions: string): InstructionSegment[] {
  const terms = (requirementCode && EMPHASIZED_TERMS[requirementCode]) || [];
  if (terms.length === 0) return [{ text: instructions, emphasized: false }];

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'g');
  return instructions
    .split(pattern)
    .filter((text) => text !== '')
    .map((text) => ({ text, emphasized: terms.includes(text) }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
