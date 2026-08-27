export const BLOOD_GROUP_VALUES = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
] as const;

export const BLOOD_GROUP_OPTIONS = [
  { value: "A_POSITIVE", label: "A+" },
  { value: "A_NEGATIVE", label: "A-" },
  { value: "B_POSITIVE", label: "B+" },
  { value: "B_NEGATIVE", label: "B-" },
  { value: "O_POSITIVE", label: "O+" },
  { value: "O_NEGATIVE", label: "O-" },
  { value: "AB_POSITIVE", label: "AB+" },
  { value: "AB_NEGATIVE", label: "AB-" },
] as const;

export type BloodGroupValue = (typeof BLOOD_GROUP_VALUES)[number];

const BLOOD_GROUP_SET = new Set<string>(BLOOD_GROUP_VALUES);

export function isBloodGroup(value: string): value is BloodGroupValue {
  return BLOOD_GROUP_SET.has(value);
}

export function bloodGroupLabel(value: BloodGroupValue): string {
  const match = BLOOD_GROUP_OPTIONS.find((option) => option.value === value);
  return match?.label ?? value;
}
