#!/usr/bin/env node
/**
 * Applies SQL files from supabase/migrations/ in order against the
 * database specified by SUPABASE_DB_SESSION_POOLER_URL (session pooler,
 * required because CLI-style scripts run multiple statements per
 * connection and benefit from session semantics rather than the
 * transaction pooler).
 *
 * A migrations_history table tracks which files have already run so this
 * is safe to re-run.
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const connectionString =
  process.env.SUPABASE_DB_SESSION_POOLER_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("SUPABASE_DB_SESSION_POOLER_URL or SUPABASE_DB_URL must be set in .env.local");
  process.exit(1);
}

const migrationsDir = join(__dirname, "..", "supabase", "migrations");

async function main() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query(`
      create table if not exists migrations_history (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows: appliedRows } = await client.query("select filename from migrations_history");
    const applied = new Set(appliedRows.map((r) => r.filename));

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip (already applied): ${file}`);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), "utf8");
      console.log(`applying: ${file}`);

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into migrations_history (filename) values ($1)", [file]);
        await client.query("commit");
        console.log(`  done: ${file}`);
      } catch (err) {
        await client.query("rollback");
        console.error(`  FAILED: ${file}`);
        throw err;
      }
    }

    console.log("All migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
