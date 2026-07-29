import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "src/generated/**",
    ],
  },
  ...next,
  prettier,
  {
    rules: {
      // Unused locals and parameters are already errors via tsconfig's noUnusedLocals /
      // noUnusedParameters, so no ESLint rule is needed for them.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "Read profile data through src/lib/dal/* so privacy predicates and select allowlists are always applied.",
            },
          ],
        },
      ],
    },
  },
  {
    /*
     * Pages and components must go through the DAL. Server Actions, the DAL itself and
     * infrastructure modules own their own writes, so they may import Prisma directly.
     */
    files: [
      "src/lib/dal/**",
      "src/lib/prisma.ts",
      "src/lib/rate-limit.ts",
      "src/lib/oauth-link.ts",
      "src/lib/auth-adapter.ts",
      "src/app/actions/**",
      "src/auth.ts",
      "prisma/**",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default config;
