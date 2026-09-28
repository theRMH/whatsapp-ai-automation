-- 0001_initial_schema.sql
-- Foundational schema per PRD section 33. All tables use uuid PKs
-- (except where the PRD specifies otherwise) and timestamptz columns.
-- RLS is enabled on every customer table and denies direct anon/
-- authenticated access by default (PRD 35) - all access goes through
-- server-side code using the service role key.

create extension if not exists "pgcrypto";

-- =========================================================================
-- 33.1 admins
-- =========================================================================
create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
-- No policies: only the service role (which bypasses RLS) may read/write.

-- =========================================================================
-- 33.2 users
-- =========================================================================
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_e164 text unique not null,
  phone_jid text null,
  timezone text not null default 'Asia/Kolkata',
  status text not null check (status in ('ACTIVE', 'SUSPENDED')),
  access_mode text not null check (access_mode in ('TRIAL', 'NO_EXPIRY')),
  trial_start_at timestamptz null,
  trial_end_at timestamptz null,
  last_active_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_phone_e164_idx on users (phone_e164);
create index users_status_idx on users (status);

alter table users enable row level security;

-- =========================================================================
-- 33.3 user_keys
-- =========================================================================
create table user_keys (
  user_id uuid primary key references users(id) on delete cascade,
  encrypted_dek text not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  rotated_at timestamptz null
);

alter table user_keys enable row level security;

-- =========================================================================
-- 33.4 system_settings
-- =========================================================================
create table system_settings (
  key text primary key,
  value_json jsonb null,
  encrypted_secret text null,
  is_secret boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null references admins(id) on delete set null,
  constraint system_settings_no_dual_storage
    check (not (value_json is not null and encrypted_secret is not null))
);

alter table system_settings enable row level security;

-- =========================================================================
-- 33.5 processed_messages (webhook idempotency)
-- =========================================================================
create table processed_messages (
  message_id_hash text primary key,
  user_id uuid null references users(id) on delete set null,
  event_type text not null,
  status text not null,
  processed_at timestamptz not null default now()
);

create index processed_messages_user_id_idx on processed_messages (user_id);

alter table processed_messages enable row level security;

-- =========================================================================
-- 33.6 conversation_turns
-- =========================================================================
create table conversation_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  direction text not null check (direction in ('INBOUND', 'OUTBOUND')),
  content_enc text not null,
  message_id_hash text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index conversation_turns_user_id_created_at_idx on conversation_turns (user_id, created_at desc);
create index conversation_turns_expires_at_idx on conversation_turns (expires_at);

alter table conversation_turns enable row level security;

-- =========================================================================
-- 33.7 tasks
-- =========================================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  series_id uuid null,
  prospect_id uuid null,
  title_enc text not null,
  details_enc text null,
  category text not null check (category in ('PERSONAL', 'PROFESSIONAL')),
  status text not null check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),
  due_at timestamptz null,
  has_explicit_time boolean not null default true,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  source_message_id_hash text null,
  reminder_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_status_due_idx on tasks (user_id, status, due_at);

alter table tasks enable row level security;

-- =========================================================================
-- 33.8 task_series
-- =========================================================================
create table task_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title_enc text not null,
  details_enc text null,
  category text not null check (category in ('PERSONAL', 'PROFESSIONAL')),
  rrule text not null,
  timezone text not null,
  active boolean not null default true,
  next_occurrence_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_series_user_id_idx on task_series (user_id);
create index task_series_active_next_occurrence_idx on task_series (active, next_occurrence_at);

alter table task_series enable row level security;

-- Now that task_series exists, add the FK from tasks.series_id
alter table tasks
  add constraint tasks_series_id_fkey
  foreign key (series_id) references task_series(id) on delete set null;

-- =========================================================================
-- 33.9 reminders
-- =========================================================================
create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  task_id uuid null references tasks(id) on delete cascade,
  series_id uuid null references task_series(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null check (status in ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'MISSED')),
  attempts integer not null default 0,
  next_attempt_at timestamptz null,
  sent_at timestamptz null,
  last_error_code text null,
  unique_key text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_status_next_attempt_idx on reminders (status, next_attempt_at);
create index reminders_user_scheduled_idx on reminders (user_id, scheduled_at);

-- PRD 33.9.1: at most one active (PENDING/PROCESSING) primary reminder per task
create unique index reminders_one_active_per_task
  on reminders (task_id)
  where status in ('PENDING', 'PROCESSING') and task_id is not null;

alter table reminders enable row level security;

-- =========================================================================
-- 33.10 memories
-- =========================================================================
create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  memory_type text not null check (memory_type in ('PERSON', 'PREFERENCE', 'WORK_FACT', 'PERSONAL_FACT', 'REFERENCE', 'OTHER')),
  category text not null check (category in ('PERSONAL', 'PROFESSIONAL')),
  content_enc text not null,
  importance smallint not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz null
);

create index memories_user_id_idx on memories (user_id);

alter table memories enable row level security;

-- =========================================================================
-- 33.11 prospects
-- =========================================================================
create table prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name_enc text not null,
  company_enc text null,
  phone_enc text null,
  email_enc text null,
  notes_enc text null,
  tags_enc text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospects_user_id_idx on prospects (user_id);

alter table prospects enable row level security;

-- Now that prospects exists, add the FK from tasks.prospect_id
alter table tasks
  add constraint tasks_prospect_id_fkey
  foreign key (prospect_id) references prospects(id) on delete set null;

-- =========================================================================
-- 33.12 document_references
-- =========================================================================
create table document_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  media_type text not null,
  mime_type text null,
  filename_enc text null,
  caption_enc text null,
  tags_enc text null,
  media_reference_enc text null,
  media_url_enc text null,
  evolution_message_key_enc text null,
  source_message_id_hash text null,
  received_at timestamptz not null,
  last_replay_attempt_at timestamptz null,
  availability_status text not null default 'UNKNOWN' check (availability_status in ('UNKNOWN', 'AVAILABLE', 'UNAVAILABLE')),
  replaces_document_id uuid null references document_references(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index document_references_user_id_idx on document_references (user_id);
create index document_references_user_received_idx on document_references (user_id, received_at desc);

alter table document_references enable row level security;

-- =========================================================================
-- 33.13 google_connections
-- =========================================================================
create table google_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references users(id) on delete cascade,
  google_email_enc text null,
  access_token_enc text null,
  refresh_token_enc text not null,
  token_expiry_at timestamptz null,
  scopes text[] not null default '{}',
  status text not null check (status in ('CONNECTED', 'REAUTH_REQUIRED', 'DISCONNECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table google_connections enable row level security;

-- =========================================================================
-- 33.14 calendar_preferences
-- =========================================================================
create table calendar_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  default_calendar_id_enc text null,
  updated_at timestamptz not null default now()
);

alter table calendar_preferences enable row level security;

-- =========================================================================
-- 33.15 managed_sheets
-- =========================================================================
create table managed_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  spreadsheet_id_enc text not null,
  title_enc text not null,
  spreadsheet_url_enc text null,
  schema_enc text null,
  status text not null check (status in ('ACTIVE', 'UNLINKED', 'DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index managed_sheets_user_id_idx on managed_sheets (user_id);

alter table managed_sheets enable row level security;

-- =========================================================================
-- 33.16 one_time_tokens
-- =========================================================================
create table one_time_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null,
  token_hash text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index one_time_tokens_user_id_idx on one_time_tokens (user_id);

alter table one_time_tokens enable row level security;

-- =========================================================================
-- 33.17 usage_daily
-- =========================================================================
create table usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  usage_date date not null,
  inbound_messages integer not null default 0,
  outbound_messages integer not null default 0,
  ai_requests integer not null default 0,
  ai_input_tokens integer not null default 0,
  ai_output_tokens integer not null default 0,
  google_requests integer not null default 0,
  reminders_sent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

alter table usage_daily enable row level security;

-- =========================================================================
-- 33.18 operational_events
-- =========================================================================
create table operational_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references users(id) on delete set null,
  integration text not null,
  event_type text not null,
  status text not null,
  error_code text null,
  latency_ms integer null,
  safe_metadata jsonb null,
  created_at timestamptz not null default now()
);

create index operational_events_created_at_idx on operational_events (created_at desc);
create index operational_events_integration_idx on operational_events (integration);

alter table operational_events enable row level security;

-- =========================================================================
-- 33.19 admin_audit_logs
-- =========================================================================
create table admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins(id) on delete cascade,
  action text not null,
  target_user_id uuid null,
  safe_metadata jsonb null,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_admin_id_idx on admin_audit_logs (admin_id);
create index admin_audit_logs_created_at_idx on admin_audit_logs (created_at desc);

alter table admin_audit_logs enable row level security;

-- =========================================================================
-- 33.20 unknown_sender_replies
-- =========================================================================
create table unknown_sender_replies (
  sender_hash text primary key,
  last_replied_at timestamptz not null default now()
);

alter table unknown_sender_replies enable row level security;

-- =========================================================================
-- 33.21 pending_actions
-- =========================================================================
create table pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('CHOOSE_CANDIDATE', 'CONFIRM_DESTRUCTIVE')),
  payload_enc text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'CANCELLED', 'SUPERSEDED', 'EXPIRED')),
  source_message_id_hash text null,
  expires_at timestamptz not null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index pending_actions_one_open_per_user
  on pending_actions (user_id) where status = 'OPEN';

create index pending_actions_expires_at_idx on pending_actions (expires_at) where status = 'OPEN';

alter table pending_actions enable row level security;

-- =========================================================================
-- 33.22 rate_limit_windows
-- =========================================================================
create table rate_limit_windows (
  user_id uuid not null references users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table rate_limit_windows enable row level security;

-- =========================================================================
-- 33.23 inbound_jobs
-- =========================================================================
create table inbound_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  message_id_hash text unique not null,
  payload_enc text null,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'PROCESSING', 'DONE', 'FAILED')),
  attempts integer not null default 0,
  side_effects_started boolean not null default false,
  locked_until timestamptz null,
  last_error_code text null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inbound_jobs_user_status_received_idx on inbound_jobs (user_id, status, received_at);
create index inbound_jobs_status_locked_until_idx on inbound_jobs (status, locked_until);

alter table inbound_jobs enable row level security;

-- =========================================================================
-- updated_at trigger helper, applied where the table has updated_at
-- =========================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'tasks', 'task_series', 'reminders', 'memories', 'prospects',
    'document_references', 'google_connections', 'calendar_preferences',
    'managed_sheets', 'usage_daily', 'inbound_jobs'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function set_updated_at()',
      t
    );
  end loop;
end $$;
