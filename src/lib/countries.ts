/**
 * ISO 3166-1 alpha-2 is stored rather than a free-text country, so the directory facet has
 * one bucket per country instead of one per spelling. Names are resolved at render time via
 * Intl, which keeps this list to codes only.
 */

const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function countryName(code: string): string {
  const upper = code.toUpperCase();
  try {
    return displayNames?.of(upper) ?? upper;
  } catch {
    return upper;
  }
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
