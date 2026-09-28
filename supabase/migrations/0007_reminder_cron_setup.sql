-- Reminder dispatch cron setup (PRD 72).
--
-- Enables pg_cron and pg_net. The actual cron.schedule(...) calls (for
-- both /api/internal/reminders/dispatch and /api/internal/jobs/sweep,
-- every minute) are environment-specific - they need the real deployment
-- domain and the INTERNAL_CRON_SECRET value - so they are not embedded in
-- migration source. Run once per environment, after deploying:
--
--   npx dotenv run -f .env.local -- node scripts/setup-production-cron.mjs
--
-- That script stores INTERNAL_CRON_SECRET in Supabase Vault
-- (as 'reminder_dispatch_cron_secret') and schedules both jobs by name.
-- It refuses to run while NEXT_PUBLIC_APP_URL still points at localhost,
-- and is safe to re-run (cron.schedule upserts by job name; the vault
-- secret is updated in place).
--
-- To inspect/verify: select * from cron.job; select * from cron.job_run_details order by start_time desc limit 20;
-- To remove: select cron.unschedule('reminder-dispatch'); select cron.unschedule('inbound-job-sweep');

create extension if not exists pg_cron with schema pg_cron;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
