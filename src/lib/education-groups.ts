/** SSC / HSC group options used across profile forms and directory facets. */
export const EDUCATION_GROUPS = ["Science", "Business Studies", "Humanities"] as const;

export type EducationGroup = (typeof EDUCATION_GROUPS)[number];

export function isEducationGroup(value: string): value is EducationGroup {
  return (EDUCATION_GROUPS as readonly string[]).includes(value);
}
