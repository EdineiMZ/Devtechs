/**
 * Format a raw string as a Brazilian phone number as the user types.
 *
 * Accepts any input (letters, existing punctuation, spaces), strips
 * to digits, then re-applies the canonical mask:
 *
 *   0 digits     → ''
 *   1-2 digits   → '(XX'
 *   3-6 digits   → '(XX) XXXX'
 *   7-10 digits  → '(XX) XXXX-XXXX'  (landline)
 *   11 digits    → '(XX) XXXXX-XXXX' (mobile)
 *
 * Capped at 11 digits — longer inputs are truncated so the user
 * can't overflow the mask by typing past the end.
 *
 * The shape produced here matches `BR_PHONE_REGEX` in
 * `contato-schema.ts`, so the same formatted string passes zod
 * validation without further transformation.
 */
export function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
