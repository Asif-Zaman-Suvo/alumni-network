# SHKSC Alumni

Verified alumni networking platform for **Shamsul Hoque Khan School & College**.

Identity is SSC-based (roll, registration, passing year), not email. An administrator must approve every new alumni claim before the directory unlocks. Google and email/password can both sign people in, but a second account cannot claim an SSC identity that is already verified or pending.

---

## Features

<<<<<<< Updated upstream
- **SSC-gated onboarding** — roll, registration, passing year, optional certificate upload
- **Admin review queue** — approve / reject with notes, bulk approve, audit log
- **Searchable directory** — name, employer, department, batch year, country (Postgres FTS + trigram)
- **Privacy-aware profiles** — `PUBLIC` / `MEMBERS_ONLY` / `PRIVATE`, optional email & employer visibility
- **Auth** — email/password (Auth.js) + optional Google OAuth (linked via Auth.js `Account` + SSC identity, never by email alone)
- **Account settings** — edit profile, avatar, data export, account close
=======
- **SSC-gated access** — alumni prove identity with roll, registration, and passing year; optional certificate upload
- **Admin review queue** — approve or reject with notes, bulk actions, audit history
- **One alumni / one account** — VERIFIED and PENDING SSC identities are unique; Google onboarding that matches an existing alum is blocked (masked email + sign in to the existing account)
- **Auth** — email/password and Google OAuth; verified users can link Google from settings without re-entering SSC
- **Searchable directory** — name, employer, department, batch year, country (Postgres full-text + trigram)
- **Privacy-aware profiles** — `PUBLIC` / `MEMBERS_ONLY` / `PRIVATE`, with optional email and employer visibility
- **Account settings** — profile and avatar editing, linked sign-in methods, data export, account close
- **SSC privacy** — roll and registration numbers are admin-only; never shown in the directory or on public profiles
>>>>>>> Stashed changes

---

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Auth | Auth.js v5 (JWT sessions, Prisma adapter) |
| Data | Prisma 6 → PostgreSQL (Supabase) |
| UI | Tailwind CSS 4, shadcn/ui, Motion |
| Files | Supabase Storage (private certificates, avatars) |
| Email | Resend (optional; falls back to console without a key) |
| Validation | Zod |
| Runtime | Node.js 20.9+ |

---

## Architecture

```
Browser
  → Next.js App Router (RSC + Server Actions)
  → src/proxy.ts                 route convenience gate (JWT decode only)
  → src/lib/dal/*                real authorization boundary
  → Prisma → Supabase Postgres / Storage
```

**Verification lifecycle**

`UNVERIFIED` → submit SSC → `PENDING` → admin → `VERIFIED` | `REJECTED` (resubmit allowed)

- Email/password signup collects SSC at registration and goes straight to the admin queue.
- Google first login creates an Auth.js stub (`UNVERIFIED`), then `/onboarding` collects SSC. Matching a VERIFIED alum deletes the stub and sends the user to login; a new claim stays `PENDING`.

**Security boundaries**

- `src/proxy.ts` — request routing only; not the security boundary
- `src/lib/dal/*` — session-aware reads/writes; directory and profile payloads never include SSC fields
- Admin SSC access only through admin DAL paths

**Data integrity**

- Partial unique indexes: one `VERIFIED` and one `PENDING` row per `(sscRoll, sscRegistration, passingYear)`
- Profile search via generated `tsvector` + `pg_trgm` on display name
- Soft-delete on users (`deletedAt`); GDPR-style export and account close from settings

**Auth model**

- Auth.js `Account` = “this Google login works”
- `VerificationRequest` (VERIFIED SSC) = “this is the same alum”
- No auto-link by matching OAuth email alone

---

## Environment

| Variable | Role |
|---|---|
| `DATABASE_URL` | Pooled Postgres URL for the app runtime (typically Supabase pooler) |
| `DIRECT_URL` | Direct / session URL for Prisma Migrate |
| `AUTH_SECRET` | Auth.js signing secret |
| `AUTH_URL` | Auth callback origin (production) |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin |
| `NEXT_PUBLIC_SCHOOL_NAME` | Brand string in the UI |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Storage and privileged Supabase access |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Optional Google OAuth |
| `RESEND_API_KEY` / `EMAIL_FROM` | Optional transactional email |

**Storage buckets**

| Bucket | Visibility | Purpose |
|---|---|---|
| `verification-documents` | Private | SSC certificates (admin via signed URL) |
| `avatars` | Public or signed | Profile photos |
