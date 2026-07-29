# SHKSC Alumni

Verified alumni networking platform for **Shamsul Hoque Khan School & College**.

Alumni identity is defined by SSC credentials (roll, registration, and passing year), not by email. Every new claim is reviewed by an administrator before directory access is granted. Email/password and Google OAuth are both supported as sign-in methods, without creating duplicate alumni records for the same SSC identity.

---

## Features

| Area | Description |
|---|---|
| **SSC-gated access** | Registration and Google onboarding require roll, registration, and passing year, with optional certificate upload |
| **Admin review** | Queue for approve / reject with notes, bulk actions, and audit history |
| **One alumni, one account** | `VERIFIED` and `PENDING` SSC identities are unique; a Google signup that matches an existing alum is blocked and redirected to that account (masked email only) |
| **Authentication** | Email/password and Google OAuth via Auth.js; verified members can link Google from settings without re-entering SSC |
| **Directory** | Search by name, employer, department, batch year, and country (Postgres full-text + trigram) |
| **Profiles & privacy** | Visibility levels `PUBLIC`, `MEMBERS_ONLY`, and `PRIVATE`; optional email and employer disclosure |
| **Account controls** | Profile and avatar editing, linked sign-in methods, data export, and account close |
| **SSC confidentiality** | Roll and registration numbers are visible to administrators only — never in the directory or on profiles |

---

## Tech stack

| Layer | Technology |
|---|---|
| Application | Next.js 16 (App Router), React 19, TypeScript |
| Authentication | Auth.js v5 (JWT sessions, Prisma adapter) |
| Database | Prisma 6 → PostgreSQL (Supabase) |
| UI | Tailwind CSS 4, shadcn/ui, Motion |
| File storage | Supabase Storage (private verification documents, avatars) |
| Email | Resend (optional) |
| Validation | Zod |
| Runtime | Node.js 20.9+ |

---

## Architecture

```
Client (Browser)
    │
    ▼
Next.js App Router
  · React Server Components
  · Server Actions
    │
    ├── src/proxy.ts          Route gate (JWT decode only — convenience, not authorization)
    │
    ├── src/lib/dal/*         Data access layer — real security boundary
    │
    └── Prisma
          ├── Supabase Postgres
          └── Supabase Storage
```

### Verification lifecycle

```
UNVERIFIED  →  submit SSC  →  PENDING  →  admin decision  →  VERIFIED
                                                      └→  REJECTED (may resubmit)
```

- **Email/password signup** collects SSC at registration and enters the admin queue as `PENDING`.
- **Google first sign-in** creates an Auth.js stub user (`UNVERIFIED`), then `/onboarding` collects SSC.
  - Match to an existing **VERIFIED** alum → stub is removed; user is sent to sign in with the registered account.
  - No match → `PENDING` verification request on the stub.

### Auth model

| Concept | Meaning |
|---|---|
| Auth.js `Account` | This Google (or other OAuth) login is attached to a user |
| `VerificationRequest` (VERIFIED) | This person is the same alum (SSC identity) |
| Email match alone | Never used to auto-link accounts |

### Security boundaries

- **Proxy** — routing and session presence only
- **DAL** — authorization for directory, profiles, and admin data; public payloads never include SSC fields
- **Integrity** — partial unique indexes enforce one `VERIFIED` and one `PENDING` row per `(sscRoll, sscRegistration, passingYear)`
- **Search** — generated `tsvector` plus `pg_trgm` on display name
- **Lifecycle** — soft-delete (`deletedAt`); export and account close from settings

---

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres URL for application runtime |
| `DIRECT_URL` | Direct / session URL for Prisma Migrate |
| `AUTH_SECRET` | Auth.js signing secret |
| `AUTH_URL` | Auth callback origin (production) |
| `NEXT_PUBLIC_APP_URL` | Canonical application origin |
| `NEXT_PUBLIC_SCHOOL_NAME` | School brand string in the UI |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase access (Storage, privileged ops) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (optional) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email (optional) |

### Storage buckets

| Bucket | Access | Purpose |
|---|---|---|
| `verification-documents` | Private | SSC certificates (admin read via signed URL) |
| `avatars` | Public or signed | Profile photos |
