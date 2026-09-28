# WhatsApp Personal Assistant

A WhatsApp-only personal assistant service. Customers interact entirely
through WhatsApp (via Evolution API); there is no customer-facing web
dashboard. This repo contains the Next.js app that runs the assistant's
webhook/orchestration logic plus an admin-only dashboard for operators.

See `whatsapp_personal_assistant_v1_prd.md` for the full product spec.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth), accessed via the service-role key for all
  customer data, and via cookie-bound sessions for admin auth only
- Application-level AES-256-GCM encryption for customer content, on top
  of Postgres RLS (RLS is a backstop, not the primary isolation mechanism)
- Vitest for unit/integration tests

## First-time setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project's
   API URL/keys (Project Settings -> API) and DB connection strings
   (Project Settings -> Database). Do not commit `.env.local`.

3. Generate the app-level secrets referenced in `.env.local`:
   ```bash
   # APP_MASTER_KEY / CONFIG_MASTER_KEY
   openssl rand -base64 32
   # INTERNAL_CRON_SECRET
   openssl rand -hex 32
   ```
   `APP_MASTER_KEY` wraps per-user data encryption keys; `CONFIG_MASTER_KEY`
   encrypts integration secrets (Evolution/OpenRouter/Google) stored in
   `system_settings`. Losing either key makes the data it protects
   permanently unrecoverable, so back them up securely outside git.

4. Apply database migrations. The Supabase CLI's `link` command needs
   interactive browser login, so this repo uses a small local runner
   against the DB connection string instead:
   ```bash
   node scripts/run-migrations.mjs
   ```
   This is idempotent — it tracks applied files in a `migrations_history`
   table and skips ones already run.

5. Set `ADMIN_BOOTSTRAP_EMAIL` in `.env.local`, then create (or promote)
   that account to admin:
   ```bash
   node scripts/bootstrap-admin.mjs "<a-strong-password>"
   ```
   There is no self-serve admin signup — this script (or a direct edit of
   the `admins` table by someone who already has service-role access) is
   the only way to grant admin access.

6. Start the dev server:
   ```bash
   npm run dev
   ```
   Sign in at [http://localhost:3000/admin/login](http://localhost:3000/admin/login).

## Everyday commands

```bash
npm run dev          # start the dev server
npm run build         # production build (also type-checks)
npm run lint          # ESLint
npm run test          # run the test suite once
npm run test:watch    # run tests in watch mode
node scripts/run-migrations.mjs   # apply any new SQL migrations
```

## Configuring integrations

Evolution API, OpenRouter (AI), and Google OAuth credentials are **not**
set via environment variables. Per the PRD, they're configured at runtime
through the admin dashboard and stored encrypted in the `system_settings`
table (secrets are encrypted with `CONFIG_MASTER_KEY` and are never
returned in full to the browser once saved — only a masked preview).

## Security notes

- Every customer-data repository function must take and filter by
  `userId` explicitly. RLS denies all direct anon/authenticated access by
  default (see `supabase/migrations/0002_rls_policies.sql`) — it is a
  backstop, not the primary isolation mechanism, since the service-role
  key used by the app bypasses RLS entirely.
- `requireAdmin()` (`src/lib/security/admin.ts`) must be called at the top
  of every admin server action and `/api/admin/*` route handler. The
  Next.js middleware check is a first gate only, not a substitute.
- The structured logger (`src/lib/logger`) redacts any field whose key
  looks like it could carry message content or secrets before writing a
  log line — see `src/lib/logger/redaction.ts` for the forbidden-key list.
