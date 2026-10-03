// Phone-number normalisation shared by the edge functions.
// KEEP IN SYNC with src/services/phone.ts (the app's copy of the same rules).
//
// Every number is matched on its FULL international digits (country code +
// number, no "+"), e.g. "919876543210" / "971501234567". Staff numbers are
// stored as "+<digits>" in users.phone_number, so an exact match is
// `phone_number = "+" + digits`. Matching used to be "last 10 digits", which
// can't tell +91 98xxx from +44 98xxx and breaks for countries whose numbers
// aren't 10 digits long.

/** Country assumed when a number is typed without one (Horae's home market). */
export const DEFAULT_COUNTRY_CODE = "91";

/**
 * Whatever was typed/stored → international digits, or "" if it can't be a phone.
 *  • leading "+" or "00"          → already has a country code
 *  • 10 digits (or "0" + 10)      → Indian mobile, "91" is added
 *  • 11–15 digits otherwise       → already has a country code
 */
export function toPhoneDigits(raw: unknown): string {
  const s = String(raw ?? "").trim();
  let d = s.replace(/\D/g, "");
  if (!d) return "";
  if (!s.startsWith("+")) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (d.length === 10) d = DEFAULT_COUNTRY_CODE + d;
    else if (d.length === 11 && d.startsWith("0")) d = DEFAULT_COUNTRY_CODE + d.slice(1);
  }
  if (d.length < 8 || d.length > 15) return "";
  // +91 is India and no other calling code starts with 91 — it must be 10 digits.
  if (d.startsWith(DEFAULT_COUNTRY_CODE) && d.length !== 12) return "";
  return d;
}

/** Meta's wa_id / recipient_id is ALWAYS full international digits (no "+"), so
 *  never apply the Indian default to it (a 10-digit wa_id is e.g. Singapore). */
export const waIdDigits = (waId: unknown) => toPhoneDigits("+" + String(waId ?? "").replace(/\D/g, ""));
