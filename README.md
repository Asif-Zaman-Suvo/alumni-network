# SHKSC Alumni

Verified alumni networking platform for **Shamsul Hoque Khan School & College**.

Graduates request access with SSC roll and registration details. An administrator manually approves every account before the member directory unlocks. Profiles support privacy controls; SSC identifiers never appear in the public or member-facing directory.

## Features

- **SSC-gated onboarding** — roll, registration, passing year, optional certificate upload
- **Admin review queue** — approve / reject with notes, bulk approve, audit log
- **Searchable directory** — name, employer, department, batch year, country (Postgres FTS + trigram)
- **Privacy-aware profiles** — `PUBLIC` / `MEMBERS_ONLY` / `PRIVATE`, optional email & employer visibility
- **Auth** — email/password (Auth.js) + optional Google OAuth (linked via Auth.js `Account` + SSC identity, never by email alone)
- **Account settings** — edit profile, avatar, data export, account close

## Stack

| Layer | Tech |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Auth | Auth.js v5 (JWT sessions) |
| Data | Prisma 6 → PostgreSQL (Supabase) |
| UI | Tailwind CSS 4, shadcn/ui |
| Files | Supabase Storage (certificates, avatars) |
| Email | Resend (optional; logs to console without a key) |

## Prerequisites

- Node.js **20.9+**
- A Supabase project (Postgres + Storage), or any Postgres 15+
- Optional: Google OAuth client, Resend API key

## Setup

```bash
cp .env.example .env
# Fill DATABASE_URL, DIRECT_URL, AUTH_SECRET, Supabase keys (see below)

npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

### Environment

Copy from `.env.example`. Important variables:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | **Pooled** Supabase URL (`…pooler…:6543`, `pgbouncer=true`). Prefer session-mode pooler host for both URLs if the direct `db.*.supabase.co` host is IPv6-only and unreachable. |
| `DIRECT_URL` | Session / migrate URL (`…pooler…:5432` or direct `:5432`) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; never expose to the client |
| `NEXT_PUBLIC_SCHOOL_NAME` | Brand string in the header |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin (e.g. `http://localhost:3000`) |

`connection_limit=1` on `DATABASE_URL` is correct for many serverless isolates. For a single `next dev` process you may raise it (e.g. `5`) so parallel queries can overlap.

### Supabase Storage buckets

| Bucket | Public | Purpose |
|---|---|---|
| `verification-documents` | **No** | SSC certificate uploads (admin reads via signed URL) |
| `avatars` | Yes (or signed) | Profile photos |

### Seed accounts

After `npm run db:seed`:

| Email | Password | Role / status |
|---|---|---|
| `admin@school.test` | `password123` | ADMIN / VERIFIED |
| `alumni0@example.test` | `password123` | ALUMNI / VERIFIED |
| `pending0@example.test` | `password123` | PENDING |
| `rejected0@example.test` | `password123` | REJECTED |

The seed also creates hundreds of verified profiles and a batch of pending verification requests.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local development (Turbopack) |
| `npm run build` | Prisma generate + production build |
| `npm run start` | Run production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:deploy` | Apply migrations (prod) |
| `npm run db:seed` | Departments + synthetic alumni |
| `npm run db:studio` | Prisma Studio |
| `npm run test:unit` | Privacy predicate unit tests |
| `npm run test:e2e` | Playwright (needs running DB + seed) |

## Architecture

```
Browser
  → Next.js App Router (RSC + Server Actions)
  → src/proxy.ts          routing gate (JWT decode only)
  → src/lib/dal/*         real security boundary
  → Prisma → Supabase Postgres / Storage
```

- **Verification flow:** `UNVERIFIED` → submit SSC → `PENDING` → admin `VERIFIED` | `REJECTED`
- **Proxy** (`src/proxy.ts`): Next 16 request interception; convenience only — not the security boundary
- **DAL:** profile reads via `src/lib/dal/profiles.ts`; SSC fields only via `src/lib/dal/admin.ts`
- **Search:** generated `tsvector` + `pg_trgm` (see `prisma/migrations/0_init/migration.sql`)
- **Integrity:** partial unique index so the same SSC identity cannot be approved on two accounts

## Deploy (Vercel)

1. Set every variable from `.env.example` in the Vercel project.
2. Build runs Prisma generate; ensure migrations deploy (`db:deploy` / project build command as configured).
3. Point `NEXT_PUBLIC_APP_URL` (and `AUTH_URL` if needed) at the production domain.
4. Create the Storage buckets and set `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret.

## Manual checklist

- [ ] Register with SSC details → lands on verification status
- [ ] Pending user cannot open `/directory`
- [ ] Admin approves → user reaches directory
- [ ] Admin rejects with note → user can resubmit
- [ ] Profile privacy (`PUBLIC` / `MEMBERS_ONLY` / `PRIVATE`) respected
- [ ] Data export and account close work from settings
- [ ] Mobile layout usable at phone width

## License

Private / unpublished unless otherwise stated.
