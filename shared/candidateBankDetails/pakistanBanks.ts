// The banks a candidate can pick when submitting bank details. The value
// stored on the bank detail is the bank's full name exactly as listed here
// (proper nouns are not translated, so English and Urdu show the same list).

export const PAKISTAN_BANKS = [
  'Al Baraka Bank (Pakistan) Limited',
  'Allied Bank Limited',
  'Askari Bank Limited',
  'Bank AL Habib Limited',
  'Bank Alfalah Limited',
  'Bank Makramah Limited',
  'Bank of China Limited',
  'BankIslami Pakistan Limited',
  'Citibank N.A.',
  'Deutsche Bank AG',
  'Dubai Islamic Bank Pakistan Limited',
  'Faysal Bank Limited',
  'First Women Bank Limited',
  'Habib Bank Limited',
  'Habib Metropolitan Bank Limited',
  'Industrial and Commercial Bank of China',
  'JS Bank Limited',
  'Mashreq Bank Pakistan Limited',
  'MCB Bank Limited',
  'MCB Islamic Bank Limited',
  'Meezan Bank Limited',
  'National Bank of Pakistan',
  'Punjab Provincial Cooperative Bank Limited',
  'Samba Bank Limited',
  'Sindh Bank Limited',
  'Soneri Bank Limited',
  'Standard Chartered Bank (Pakistan) Limited',
  'The Bank of Khyber',
  'The Bank of Punjab',
  'United Bank Limited',
  'Zarai Taraqiati Bank Limited',
] as const;

export function isPakistanBank(value: string): boolean {
  return (PAKISTAN_BANKS as readonly string[]).includes(value);
}
