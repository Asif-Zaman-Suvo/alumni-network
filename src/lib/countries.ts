/**
 * ISO 3166-1 alpha-2 is stored rather than free-text country, so the directory facet has
 * one bucket per country instead of one per spelling.
 *
 * Names are a fixed English map — not `Intl.DisplayNames`. Node and browsers ship different
 * ICU data (e.g. HK → "Hong Kong SAR China" vs "Hong Kong"), which would hydrate-mismatch
 * any SSR `<option>` list built from Intl.
 */

const COUNTRY_NAMES: Record<string, string> = {
  BD: "Bangladesh",
  IN: "India",
  PK: "Pakistan",
  LK: "Sri Lanka",
  NP: "Nepal",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
  NZ: "New Zealand",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IT: "Italy",
  ES: "Spain",
  IE: "Ireland",
  CH: "Switzerland",
  AT: "Austria",
  BE: "Belgium",
  PL: "Poland",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  OM: "Oman",
  BH: "Bahrain",
  MY: "Malaysia",
  SG: "Singapore",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  HK: "Hong Kong",
  TH: "Thailand",
  ID: "Indonesia",
  PH: "Philippines",
  VN: "Vietnam",
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  EG: "Egypt",
  TR: "Turkey",
  BR: "Brazil",
  MX: "Mexico",
  AR: "Argentina",
};

export function countryName(code: string): string {
  const upper = code.toUpperCase();
  return COUNTRY_NAMES[upper] ?? upper;
}

/** Countries offered in the profile editor. Deliberately short: the common cases first. */
export const COMMON_COUNTRY_CODES = [
  "BD", "IN", "PK", "LK", "NP",
  "US", "CA", "GB", "AU", "NZ",
  "DE", "FR", "NL", "SE", "NO", "DK", "FI", "IT", "ES", "IE", "CH", "AT", "BE", "PL",
  "AE", "SA", "QA", "KW", "OM", "BH",
  "MY", "SG", "JP", "KR", "CN", "HK", "TH", "ID", "PH", "VN",
  "ZA", "NG", "KE", "EG", "TR", "BR", "MX", "AR",
] as const;

export const COUNTRY_OPTIONS = COMMON_COUNTRY_CODES.map((code) => ({
  code,
  name: countryName(code),
})).sort((a, b) => a.name.localeCompare(b.name, "en"));
