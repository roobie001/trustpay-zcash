export interface DialCode {
  iso: string;
  name: string;
  dial: string; // digits only, no "+"
}

// Nigeria first (default), then common trade corridors.
export const DIAL_CODES: DialCode[] = [
  { iso: "NG", name: "Nigeria", dial: "234" },
  { iso: "US", name: "United States / Canada", dial: "1" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "KE", name: "Kenya", dial: "254" },
  { iso: "GH", name: "Ghana", dial: "233" },
  { iso: "ZA", name: "South Africa", dial: "27" },
  { iso: "EG", name: "Egypt", dial: "20" },
  { iso: "CM", name: "Cameroon", dial: "237" },
  { iso: "SN", name: "Senegal", dial: "221" },
  { iso: "RW", name: "Rwanda", dial: "250" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "NL", name: "Netherlands", dial: "31" },
  { iso: "AE", name: "United Arab Emirates", dial: "971" },
  { iso: "SA", name: "Saudi Arabia", dial: "966" },
  { iso: "IN", name: "India", dial: "91" },
  { iso: "CN", name: "China", dial: "86" },
  { iso: "BR", name: "Brazil", dial: "55" },
];

export const DEFAULT_DIAL_CODE = DIAL_CODES[0];

/** E.164: "+", country code, subscriber number — 15 digits max in total. */
export const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

/**
 * Builds an E.164 number from a dial code and a locally typed number, dropping
 * formatting and the national trunk "0" (e.g. 234 + "0801 234 5678" →
 * "+2348012345678"). Returns null if the result isn't a plausible E.164 number.
 */
export function toE164(dial: string, localNumber: string): string | null {
  const national = localNumber.replace(/\D/g, "").replace(/^0/, "");
  const full = `+${dial}${national}`;
  return national && E164_PATTERN.test(full) ? full : null;
}
