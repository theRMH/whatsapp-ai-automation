#!/usr/bin/env node
/**
 * Creates (or promotes) the first admin account: a Supabase Auth user for
 * ADMIN_BOOTSTRAP_EMAIL plus a matching row in the admins table. Intended
 * as a one-time setup step run locally with the service role key - there
 * is deliberately no self-serve admin signup UI (PRD 23).
 *
 * Usage: node scripts/bootstrap-admin.mjs <password>
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
const password = process.argv[2];

if (!email) {
  console.error("ADMIN_BOOTSTRAP_EMAIL must be set in .env.local");
  process.exit(1);
}

if (!password || password.length < 8) {
  console.error("Usage: node scripts/bootstrap-admin.mjs <password>  (min 8 characters)");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: existingList, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  let userId = existingList.users.find((u) => u.email === email)?.id;

  if (!userId) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw createError;
    userId = created.user.id;
    console.log(`Created Supabase Auth user for ${email}`);
  } else {
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateError) throw updateError;
    console.log(`Auth user for ${email} already existed; password updated`);
  }

  const { error: upsertError } = await supabase
    .from("admins")
    .upsert({ id: userId, email }, { onConflict: "id" });
  if (upsertError) throw upsertError;

  console.log(`${email} is now an admin. Sign in at /admin/login.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
