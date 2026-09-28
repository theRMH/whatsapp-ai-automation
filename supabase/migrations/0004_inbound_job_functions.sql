-- Inbound job queue functions (PRD 36.2.1-36.2.3, 33.23).
--
-- claim_next_inbound_job: claims the oldest QUEUED job for a given user,
-- but only if that user has no job currently PROCESSING, so a user's
-- messages are always processed in order (PRD 36.2.2: "so 'actually make
-- it 11' is never handled before the message it corrects").
--
-- sweep_inbound_jobs: recovery sweeper (PRD 36.2.3) - reclaims
-- PROCESSING jobs whose lock expired, and returns QUEUED jobs older than
-- p_stale_queued_seconds so the sweep route can process them (covers the
-- case where the webhook's after() callback never ran).

create or replace function claim_next_inbound_job(p_user_id uuid, p_lock_seconds integer)
returns table (
  id uuid,
  message_id_hash text,
  payload_enc text,
  attempts integer,
  side_effects_started boolean,
  received_at timestamptz
)
language plpgsql
as $$
begin
  return query
  update inbound_jobs
  set status = 'PROCESSING',
      locked_until = now() + (p_lock_seconds * interval '1 second'),
      attempts = inbound_jobs.attempts + 1,
      updated_at = now()
  where inbound_jobs.id = (
    select j.id
    from inbound_jobs j
    where j.user_id = p_user_id
      and j.status = 'QUEUED'
      and not exists (
        select 1 from inbound_jobs p
        where p.user_id = p_user_id and p.status = 'PROCESSING'
      )
    order by j.received_at asc
    for update skip locked
    limit 1
  )
  returning inbound_jobs.id, inbound_jobs.message_id_hash, inbound_jobs.payload_enc,
    inbound_jobs.attempts, inbound_jobs.side_effects_started, inbound_jobs.received_at;
end;
$$;

create or replace function reclaim_stale_processing_jobs()
returns setof uuid
language sql
as $$
  update inbound_jobs
  set status = 'QUEUED',
      locked_until = null,
      updated_at = now()
  where status = 'PROCESSING'
    and locked_until is not null
    and locked_until < now()
  returning id;
$$;

create or replace function fail_stale_queued_jobs(p_cutoff_minutes integer)
returns setof uuid
language sql
as $$
  update inbound_jobs
  set status = 'FAILED',
      payload_enc = null,
      last_error_code = 'STALE_JOB_TIMEOUT',
      updated_at = now()
  where status = 'QUEUED'
    and received_at < now() - (p_cutoff_minutes * interval '1 minute')
  returning id;
$$;

create or replace function list_stale_queued_job_users(p_min_age_seconds integer)
returns table (user_id uuid)
language sql
as $$
  select distinct j.user_id
  from inbound_jobs j
  where j.status = 'QUEUED'
    and j.received_at < now() - (p_min_age_seconds * interval '1 second');
$$;
