// Phone-number normalisation for the app.
// KEEP IN SYNC with supabase/functions/_shared/phone.ts (the edge functions' copy).
//
// Every number is matched on its FULL international digits (country code +
// number, no "+"), e.g. "919876543210" / "971501234567". Staff numbers are
// stored as "+<digits>" in users.phone_number. A bare 10-digit number is
// treated as Indian, so everything typed before country codes existed still
// resolves to exactly the same value.

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

/** True when two numbers (in any typed/stored form) are the same phone. */
export const samePhone = (a: unknown, b: unknown) => {
  const x = toPhoneDigits(a);
  return !!x && x === toPhoneDigits(b);
};

/** Calling codes offered in the phone picker. India first (the default). */
export const COUNTRY_CODES: { code: string; name: string }[] = [
  { code: "91", name: "India" },
  { code: "971", name: "UAE" },
  { code: "966", name: "Saudi Arabia" },
  { code: "974", name: "Qatar" },
  { code: "968", name: "Oman" },
  { code: "965", name: "Kuwait" },
  { code: "973", name: "Bahrain" },
  { code: "1", name: "USA / Canada" },
  { code: "44", name: "United Kingdom" },
  { code: "353", name: "Ireland" },
  { code: "61", name: "Australia" },
  { code: "64", name: "New Zealand" },
  { code: "65", name: "Singapore" },
  { code: "60", name: "Malaysia" },
  { code: "66", name: "Thailand" },
  { code: "62", name: "Indonesia" },
  { code: "63", name: "Philippines" },
  { code: "84", name: "Vietnam" },
  { code: "852", name: "Hong Kong" },
  { code: "86", name: "China" },
  { code: "81", name: "Japan" },
  { code: "82", name: "South Korea" },
  { code: "977", name: "Nepal" },
  { code: "975", name: "Bhutan" },
  { code: "94", name: "Sri Lanka" },
  { code: "880", name: "Bangladesh" },
  { code: "960", name: "Maldives" },
  { code: "92", name: "Pakistan" },
  { code: "93", name: "Afghanistan" },
  { code: "98", name: "Iran" },
  { code: "964", name: "Iraq" },
  { code: "962", name: "Jordan" },
  { code: "961", name: "Lebanon" },
  { code: "972", name: "Israel" },
  { code: "90", name: "Turkey" },
  { code: "20", name: "Egypt" },
  { code: "212", name: "Morocco" },
  { code: "27", name: "South Africa" },
  { code: "254", name: "Kenya" },
  { code: "255", name: "Tanzania" },
  { code: "256", name: "Uganda" },
  { code: "234", name: "Nigeria" },
  { code: "233", name: "Ghana" },
  { code: "251", name: "Ethiopia" },
  { code: "230", name: "Mauritius" },
  { code: "248", name: "Seychelles" },
  { code: "49", name: "Germany" },
  { code: "33", name: "France" },
  { code: "39", name: "Italy" },
  { code: "34", name: "Spain" },
  { code: "351", name: "Portugal" },
  { code: "31", name: "Netherlands" },
  { code: "32", name: "Belgium" },
  { code: "41", name: "Switzerland" },
  { code: "43", name: "Austria" },
  { code: "46", name: "Sweden" },
  { code: "47", name: "Norway" },
  { code: "45", name: "Denmark" },
  { code: "358", name: "Finland" },
  { code: "48", name: "Poland" },
  { code: "7", name: "Russia / Kazakhstan" },
  { code: "55", name: "Brazil" },
  { code: "52", name: "Mexico" },
  { code: "54", name: "Argentina" },
  { code: "57", name: "Colombia" },
  { code: "56", name: "Chile" },
];

/** Split international digits into { code, national } by the longest known
 *  calling code. Unknown codes fall back to the first 1–3 digits. */
export function splitPhone(raw: unknown): { code: string; national: string } {
  const d = toPhoneDigits(raw);
  if (!d) return { code: DEFAULT_COUNTRY_CODE, national: String(raw ?? "").replace(/\D/g, "") };
  const known = COUNTRY_CODES.map(c => c.code).sort((a, b) => b.length - a.length).find(c => d.startsWith(c));
  const code = known || d.slice(0, d.length > 11 ? 3 : 1);
  return { code, national: d.slice(code.length) };
}
