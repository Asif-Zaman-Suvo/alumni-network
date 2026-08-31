# SHKSC Alumni — as-built

The original setup plan is complete. This file records what shipped, not a TODO list.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript, Auth.js v5 (JWT + Prisma adapter), Prisma 6 → Supabase Postgres, Tailwind CSS 4 + shadcn/ui + Motion, Supabase Storage, Supabase Realtime (private channel), Vercel Cron, optional Brevo.

Not used: UploadThing, Vercel Blob, `NEXTAUTH_*` env names.

## Routes

| Path | Audience |
| ---- | -------- |
| `/` | Public landing |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth |
| `/verify-email` | Email confirmation |
| `/onboarding` | Google stub: collect SSC |
| `/verification-status` | Pending / rejected claimants |
| `/directory` | Verified members |
| `/profile/[slug]` | Public or members-only profile (respects visibility) |
| `/settings/profile` | Own profile, privacy, linked Google, export, close |
| `/admin` | Membership counts |
| `/admin/verifications` | Human review queue |
| `/admin/users` | Role, suspend, restore |
| `/admin/audit` | Auth + staff audit (live when Realtime is configured) |

Authorization lives in `src/lib/dal/*`. `src/proxy.ts` only decodes the JWT for routing.

## Identity

- Alumni uniqueness: `(sscRoll, sscRegistration)` — passing year is review metadata, not the key.
- `UserStatus`: `UNVERIFIED` → `PENDING` → `VERIFIED` / `REJECTED` (resubmit allowed).
- Directory access also requires `profileComplete` (WhatsApp saved after approval).
- SSC roll/registration never appear in directory or public profile payloads.

Google first sign-in creates an `UNVERIFIED` stub; `/onboarding` collects SSC. A match to a `VERIFIED` alum deletes the stub and sends the user to the existing account. Google may attach to an existing `User` when the mailbox matches. Facebook is wired in Auth.js but not offered in the UI.

## Session and audit

Auth.js JWT cannot be recalled. Each sign-in writes `AuthSession`; the DAL checks `sessionId` on every request. Suspension, role demotion, password reset, and account close revoke immediately.

`AuditLog` is append-only (auth lifecycle + staff actions). Failed sign-ins store a keyed HMAC of the address, never the address. An `AFTER INSERT` trigger broadcasts a redacted payload to private channel `admin:audit`; the admin page treats that as a refetch hint, so the table always matches Postgres.

## Data model (current)

`User` (role, status, `profileComplete`, soft-delete) → `Profile` (education SSC/HSC/university, work, WhatsApp/socials, `Visibility`, `showEmail` / `showEmployer` / `showGender`, blood group) → `Department`. `VerificationRequest` is one row per submission. `AuthSession` is the revocation registry. Auth.js adapter tables (`Account`, `Session`, `VerificationToken`) exist; JWT strategy does not use `Session` rows.

Search: generated `tsvector` + `pg_trgm` on `displayName`.

Storage: private `verification-documents`, avatars in `avatars`.

## Original plan vs shipped

| Original | Shipped |
| -------- | ------- |
| Open signup + profile | SSC-gated; admin must approve |
| UploadThing / Vercel Blob | Supabase Storage |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | `AUTH_SECRET` / `AUTH_URL` |
| `Privacy.REGISTERED_ONLY` | `Visibility.MEMBERS_ONLY` |
| Analytics tracking | Not built |
| Admin “content moderation + analytics” | Review queue, users, live audit — no product analytics |

## Verification that still applies

- Unit: `npm run test:unit`
- E2E: `npm run test:e2e` (verification gating, admin, audit, OAuth linking)
- Manual: register → queue → approve → complete WhatsApp → directory; privacy; suspend ends the session on the next request
