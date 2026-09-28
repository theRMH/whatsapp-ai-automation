#!/usr/bin/env node
/**
 * One-time production setup (PRD 72): stores the internal cron secret in
 * Supabase Vault and schedules the two per-minute pg_cron jobs that drive
 * the app outside of any request (reminder dispatch, PRD 13; inbound job
 * sweep/recovery). Requires pg_cron + pg_net, which
 * supabase/migrations/0007_reminder_cron_setup.sql already enables.
 *
 * Not run automatically by run-migrations.mjs because it depends on
 * environment-specific values (the real deployment domain) that don't
 * belong in committed migration source. Safe to re-run: it replaces the
 * vault secret and reschedules both jobs by name (cron.schedule upserts
 * by job name).
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_APP_URL       - the real deployed domain (not localhost)
 *   INTERNAL_CRON_SECRET      - must match the value the deployed app uses
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const cronSecret = process.env.INTERNAL_CRON_SECRET;
const connectionString = process.env.SUPABASE_DB_SESSION_POOLER_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("SUPABASE_DB_SESSION_POOLER_URL or SUPABASE_DB_URL must be set in .env.local");
  process.exit(1);
}
if (!cronSecret) {
  console.error("INTERNAL_CRON_SECRET must be set in .env.local");
  process.exit(1);
}
if (!appUrl || appUrl.includes("localhost") || !appUrl.startsWith("https://")) {
  console.error(
    `NEXT_PUBLIC_APP_URL must be a real https:// production domain (got: ${appUrl ?? "unset"}).\n` +
      "pg_cron's net.http_post cannot reach localhost - deploy the app first, then re-run this script."
  );
  process.exit(1);
}

const VAULT_SECRET_NAME = "reminder_dispatch_cron_secret";

const jobs = [
  { name: "reminder-dispatch", path: "/api/internal/reminders/dispatch" },
  { name: "inbound-job-sweep", path: "/api/internal/jobs/sweep" },
];

async function main() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const { rows: existingSecret } = await client.query(
      "select id from vault.secrets where name = $1",
      [VAULT_SECRET_NAME]
    );
    if (existingSecret.length > 0) {
      await client.query("select vault.update_secret($1, $2)", [existingSecret[0].id, cronSecret]);
      console.log(`updated existing vault secret: ${VAULT_SECRET_NAME}`);
    } else {
      await client.query("select vault.create_secret($1, $2)", [cronSecret, VAULT_SECRET_NAME]);
      console.log(`created vault secret: ${VAULT_SECRET_NAME}`);
    }

    for (const job of jobs) {
      const url = `${appUrl}${job.path}`;
      await client.query(
        `select cron.schedule(
           $1::text,
           '* * * * *',
           format(
             $sql$
             select net.http_post(
               url := %L,
               headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = %L)
               ),
               body := '{}'::jsonb
             );
             $sql$,
             $2::text, $3::text
           )
         )`,
        [job.name, url, VAULT_SECRET_NAME]
      );
      console.log(`scheduled cron job "${job.name}" -> ${url} (every minute)`);
    }

    const { rows: scheduled } = await client.query(
      "select jobname, schedule, active from cron.job where jobname = any($1)",
      [jobs.map((j) => j.name)]
    );
    console.table(scheduled);
    console.log(
      "\nVerify runs after a minute or two with:\n" +
        "  select * from cron.job_run_details order by start_time desc limit 20;"
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
