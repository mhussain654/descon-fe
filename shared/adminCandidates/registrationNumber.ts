// Client-side check for a registration (file) number typed by staff (the backend's
// Candidates::RegistrationNumberParser is the real rule): empty, or a whole number
// above zero of up to 15 digits.
export function isValidRegistrationNumber(value: string): boolean {
  const text = value.trim();
  if (text === '') return true;
  return /^\d{1,15}$/.test(text) && Number(text) > 0;
}
