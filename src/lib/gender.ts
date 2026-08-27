export const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]["value"];

export function genderLabel(gender: GenderValue): string {
  return gender === "MALE" ? "Male" : "Female";
}
