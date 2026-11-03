// Public legal pages (/privacy, /terms) linked from the Google Play and App
// Store listings. Their text is legal content approved by Descon in English,
// so it lives here as structured data rather than as translation keys.

export type LegalInline = string | { bold: string } | { link: string; href: string };

export type LegalBlock =
  | { kind: 'paragraph'; content: LegalInline[] }
  | { kind: 'bullets'; items: LegalInline[][] }
  | { kind: 'steps'; items: LegalInline[][] }
  | { kind: 'table'; head: string[]; rows: string[][] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  effectiveDate: string;
  intro: LegalBlock[];
  sections: LegalSection[];
}
