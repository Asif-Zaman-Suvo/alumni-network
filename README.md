# SHKSC Alumni

Verified alumni networking platform for **Shamsul Hoque Khan School & College**.

Alumni identity is defined by SSC credentials (roll, registration, and passing year), not by email. Every new claim is reviewed by an administrator before directory access is granted. Email/password and Google OAuth are both supported as sign-in methods, without creating duplicate alumni records for the same SSC identity.

---

## Features

| Area                        | Description                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SSC-gated access**        | Registration and Google onboarding require roll, registration, and passing year, with optional certificate upload                                               |
| **Admin review**            | Queue for approve / reject with notes, bulk actions, and audit history                                                                                          |
| **One alumni, one account** | `VERIFIED` and `PENDING` SSC identities are unique; a Google signup that matches an existing alum is blocked and redirected to that account (masked email only) |
| **Authentication**          | Email/password and Google OAuth via Auth.js; verified members can link Google from settings without re-entering SSC                                             |
| **Directory**               | Search by name, employer, department, batch year, and country (Postgres full-text + trigram)                                                                    |
| **Profiles & privacy**      | Visibility levels `PUBLIC`, `MEMBERS_ONLY`, and `PRIVATE`; optional email and employer disclosure                                                               |
| **Account controls**        | Profile and avatar editing, linked sign-in methods, data export, and account close                                                                              |
| **SSC confidentiality**     | Roll and registration numbers are visible to administrators only — never in the directory or on profiles                                                        |
| **Authentication audit**    | Sign-ins, failed attempts, sign-outs, revocations, and expiries are recorded; a failed attempt stores a keyed HMAC of the address, never the address itself     |
| **Live monitoring**         | `/admin/audit` streams events over a private Supabase Realtime channel, and stays a working paginated history when live updates are unavailable                 |
| **Immediate revocation**    | Suspension, role change, password reset, and account close end sessions on the next request instead of waiting for the JWT to expire                            |

---

## Tech stack

| Layer          | Technology                                                        |
| -------------- | ----------------------------------------------------------------- |
| Application    | Next.js 16 (App Router), React 19, TypeScript                     |
| Authentication | Auth.js v5 (JWT sessions, Prisma adapter)                         |
| Database       | Prisma 6 → PostgreSQL (Supabase)                                  |
| UI             | Tailwind CSS 4, shadcn/ui, Motion                                 |
| File storage   | Supabase Storage (private verification documents, avatars)        |
| Live updates   | Supabase Realtime — Broadcast from Database, on a private channel |
| Token signing  | jose (ES256) for the short-lived Realtime channel tokens          |
| Scheduled jobs | Vercel Cron (daily session expiry sweep)                          |
| Email          | Resend (optional)                                                 |
| Validation     | Zod                                                               |
| Runtime        | Node.js 20.9+                                                     |

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

| Concept                          | Meaning                                                  |
| -------------------------------- | -------------------------------------------------------- |
| Auth.js `Account`                | This Google (or other OAuth) login is attached to a user |
| `VerificationRequest` (VERIFIED) | This person is the same alum (SSC identity)              |
| Email match alone                | Never used to auto-link accounts                         |

### Audit and session lifecycle

Auth.js runs a stateless JWT strategy, so a cookie stays cryptographically valid until it expires and cannot be recalled. Every sign-in therefore opens an `AuthSession` row, and the DAL resolves the token's `sessionId` claim against it on each request — revocation takes effect on the next request rather than at the next token refresh.

| Event             | Written when                                                                       |
| ----------------- | ---------------------------------------------------------------------------------- |
| `LOGIN_SUCCESS`   | A session is opened, in the same transaction as the `AuthSession` row              |
| `LOGIN_FAILED`    | Wrong credentials or a rate-limit rejection; the address is stored only as an HMAC |
| `LOGOUT`          | The Auth.js `signOut` event, which every sign-out path funnels through             |
| `SESSION_REVOKED` | Suspension, role demotion, password reset, or account close                        |
| `SESSION_EXPIRED` | The daily cron, once `expiresAt` has passed                                        |

Staff mutations use dotted lowercase actions (`verification.approve`, `user.role.change`) and are written in the same transaction as the change itself.

```
AuditLog INSERT
    │
    ├── AFTER INSERT trigger ──▶ realtime.send ──▶ admin:audit (private channel)
    │                                                   │
    │                            RLS on realtime.messages re-checks the
    │                            token's claims against AuthSession + User
    │                                                   │
    │                                                   ▼
    │                                    Admin dashboard: "something arrived"
    │                                                   │
    └────────────── canonical rows ◀── GET /api/admin/audit-logs
```

The broadcast carries seven fields and nothing more — `ipAddress`, `userAgent`, `subjectHash`, and `metadata` stay server-side. Because the dashboard treats a message purely as a prompt to re-read, a dropped or duplicated broadcast cannot make the table disagree with the database.

Channel authorization does not trust the token alone. The RLS policy re-checks the claims against live rows, so a demoted, suspended, or signed-out administrator loses the stream even while holding an unexpired token.

### Security boundaries

- **Proxy** — routing and session presence only
- **DAL** — authorization for directory, profiles, and admin data; public payloads never include SSC fields
- **Data API** — every table has RLS enabled with no policies, and `anon` / `authenticated` hold no DML grants; all access is Prisma over a direct connection as the table owner
- **Audit reads** — administrator-only, asserted inside `src/lib/dal/audit-read.ts` as well as at the route, so a caller that forgets fails closed
- **Integrity** — partial unique indexes enforce one `VERIFIED` and one `PENDING` row per `(sscRoll, sscRegistration, passingYear)`, and one terminal event per session
- **Search** — generated `tsvector` plus `pg_trgm` on display name
- **Lifecycle** — soft-delete (`deletedAt`); export and account close from settings

---

## Environment

| Variable                                | Purpose                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | Pooled Postgres URL for application runtime                                                                            |
| `DIRECT_URL`                            | Direct / session URL for Prisma Migrate                                                                                |
| `AUTH_SECRET`                           | Auth.js signing secret                                                                                                 |
| `AUTH_URL`                              | Auth callback origin (production)                                                                                      |
| `NEXT_PUBLIC_APP_URL`                   | Canonical application origin                                                                                           |
| `NEXT_PUBLIC_SCHOOL_NAME`               | School brand string in the UI                                                                                          |
| `NEXT_PUBLIC_SUPABASE_URL`              | Supabase project URL                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`         | Supabase anon key (public)                                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`             | Server-only Supabase access (Storage, privileged ops)                                                                  |
| `AUDIT_HASH_SECRET`                     | **Required.** Keys the HMAC that pseudonymises an address on a failed sign-in. Generate with `openssl rand -base64 32` |
| `SUPABASE_REALTIME_JWK`                 | ES256 private JWK for the live audit monitor (optional)                                                                |
| `SUPABASE_REALTIME_JWT_TTL_SECONDS`     | Channel token lifetime, 60–3600 (default `600`)                                                                        |
| `CRON_SECRET`                           | Bearer secret for the session expiry cron (optional)                                                                   |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (optional)                                                                                                |
| `RESEND_API_KEY` / `EMAIL_FROM`         | Transactional email (optional)                                                                                         |

`AUDIT_HASH_SECRET` is validated at startup, so a deployment without it fails outright rather than degrading. The Realtime and cron variables are optional: without them the audit page is a paginated history and expiry is enforced without being recorded.

### Storage buckets

| Bucket                   | Access           | Purpose                                      |
| ------------------------ | ---------------- | -------------------------------------------- |
| `verification-documents` | Private          | SSC certificates (admin read via signed URL) |
| `avatars`                | Public or signed | Profile photos                               |

### Live audit updates

This application does not use Supabase Auth, so there is no Supabase-issued JWT to present when subscribing. It signs its own short-lived ES256 tokens instead, with a key Supabase also holds:

1. Generate an EC P-256 key pair as a JWK, including a `kid`.
2. **Authentication → JWT Keys → import the private JWK.** Supabase needs the private key, not the public half: it stores the pair and publishes the public half for verification.
3. Rotate so the imported key becomes **CURRENT**. A STANDBY key is published but not yet trusted, and channel joins fail until it is rotated in.
4. Set `SUPABASE_REALTIME_JWK` to the same private JWK, minified onto one line.
5. Disable public channel access in **Realtime → Settings**.

### Scheduled jobs

| Path                        | Schedule           | Purpose                                                |
| --------------------------- | ------------------ | ------------------------------------------------------ |
| `/api/cron/expire-sessions` | Daily, `0 3 * * *` | Writes `SESSION_EXPIRED` for sessions past `expiresAt` |

Daily rather than hourly because a Vercel Hobby plan rejects any cron expression that fires more than once a day, and fails the deployment rather than degrading. Access control already refuses an expired session on the next request, so the job records the expiry rather than enforcing it.
