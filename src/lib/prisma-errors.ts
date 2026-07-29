import { Prisma } from "@prisma/client";

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** True when a P2002 unique violation touches any of the given field/index name fragments. */
export function uniqueViolationMatches(error: unknown, fragments: string[]): boolean {
  if (!isUniqueViolation(error)) return false;

  const meta = (error as Prisma.PrismaClientKnownRequestError).meta;
  const target = meta?.target;
  const haystack = Array.isArray(target)
    ? target.map(String).join(" ")
    : typeof target === "string"
      ? target
      : typeof meta?.modelName === "string"
        ? meta.modelName
        : "";

  const lower = haystack.toLowerCase();
  return fragments.some((fragment) => lower.includes(fragment.toLowerCase()));
}
