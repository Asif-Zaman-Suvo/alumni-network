import { PrismaClient } from "@prisma/client";
import { serverEnv } from "@/env";

/**
 * Reuse one client across hot reloads in development. Each new PrismaClient opens its own
 * pool, which exhausts the pgbouncer connection limit within a few file saves.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: serverEnv.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (serverEnv.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { Prisma } from "@prisma/client";
export type { Role, UserStatus, Visibility } from "@prisma/client";
