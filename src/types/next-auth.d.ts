import type { Role, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: UserStatus;
      /** Mirrors JWT; Auth.js `User.emailVerified` stays `Date | null`. */
      isEmailVerified: boolean;
      profileComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    status?: UserStatus;
    profileComplete?: boolean;
  }
}

/**
 * `next-auth/jwt` only re-exports `@auth/core/jwt`, and a re-export does not merge
 * declarations — the augmentation has to target the declaring module.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    status: UserStatus;
    isEmailVerified: boolean;
    profileComplete: boolean;
    /** Epoch ms of the last database refresh, so role and status changes propagate. */
    refreshedAt: number;
  }
}
