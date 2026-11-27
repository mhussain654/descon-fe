// The client's registration (file) number for a candidate, as text for display; empty when staff have not added
// it yet. The API sends it as `registration_number` (a number, or null).
export function displayRegistrationNumber(value: number | string | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}
