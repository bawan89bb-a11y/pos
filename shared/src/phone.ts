/**
 * Normalizes a phone number for matching: strips everything but digits, then strips
 * any leading zeros (a domestic "0" trunk prefix or an international "00" prefix),
 * so "0770147" and "009647701470374" compare on their shared significant digits.
 */
export function normalizePhoneDigits(s: string): string {
  const digits = s.replace(/[^\d]/g, "");
  return digits.replace(/^0+/, "");
}

export function phoneNumbersMatch(a: string, b: string): boolean {
  const na = normalizePhoneDigits(a);
  const nb = normalizePhoneDigits(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}
