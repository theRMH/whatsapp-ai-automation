-- 0002_rls_policies.sql
-- PRD 35: "Enable RLS on customer tables and deny direct anon/authenticated
-- access by default." Migration 0001 already enabled RLS on every table
-- with zero policies, which means anon/authenticated roles get zero rows
-- and zero writes - the service role key (used exclusively by
-- lib/db/supabase-admin.ts) bypasses RLS entirely and is the only path
-- to this data.
--
-- This migration exists to make that decision explicit and documented,
-- and to add narrow read policies for the two cases where an
-- authenticated (admin) session is allowed to read something directly
-- from the browser/server-rendered admin session client:
--   - an admin reading their own admins row (used by requireAdmin() as
--     a defense-in-depth double check; the primary check still goes
--     through the service role client)
--   - nothing else. All other admin dashboard reads (user lists, usage
--     counts, operational events) go through server actions using the
--     service role client, scoped and shaped by application code so the
--     admin never receives a raw customer-content column.

-- Admins may read their own row (not other admins' rows, not any other
-- table). This does not grant write access.
create policy admins_select_self on admins
  for select
  to authenticated
  using (id = auth.uid());

-- No other policies are added. Every other table remains fully closed to
-- the anon and authenticated roles. All application code paths use
-- getSupabaseAdminClient() (service role) and MUST filter by user_id
-- themselves - RLS is a backstop here, not the primary isolation
-- mechanism, because the service role bypasses it by design (PRD 35:
-- "Even with RLS, repository code must always require a userId").
