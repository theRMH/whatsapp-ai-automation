-- Reminder engine functions (PRD 13, 33.9, 33.9.1, 73).
--
-- set_task_reminder: atomically (a) bumps tasks.reminder_revision, (b)
-- cancels any existing PENDING/PROCESSING reminder for the task, and (c)
-- inserts a new PENDING reminder with unique_key = task:<task_id>:v<rev>.
-- One function covers both "first reminder on task creation" and
-- "reschedule/snooze", since both are the same cancel-old-insert-new
-- operation (PRD 33.9.1: "Rescheduling cancels the existing PENDING
-- reminder and inserts a new one with the next revision, in one
-- transaction."). Returns the new reminder's id and revision.
--
-- cancel_task_reminders: marks all PENDING/PROCESSING reminders for a task
-- CANCELLED (task completed/cancelled - PRD 13.6 rule 4).
--
-- claim_due_reminders: batch claim for the dispatcher (PRD 73). First
-- marks stale PENDING reminders MISSED (PRD 13.6 rule 1: scheduled_at
-- older than the grace period can no longer be delivered usefully), then
-- claims up to p_batch_size due PENDING/FAILED-retryable reminders with
-- FOR UPDATE SKIP LOCKED, marking them PROCESSING.

create or replace function set_task_reminder(
  p_task_id uuid,
  p_user_id uuid,
  p_scheduled_at timestamptz
)
returns table (reminder_id uuid, revision integer)
language plpgsql
as $$
declare
  v_revision integer;
  v_reminder_id uuid;
begin
  update reminders
  set status = 'CANCELLED', updated_at = now()
  where task_id = p_task_id
    and status in ('PENDING', 'PROCESSING');

  update tasks
  set reminder_revision = reminder_revision + 1,
      updated_at = now()
  where id = p_task_id and user_id = p_user_id
  returning reminder_revision into v_revision;

  if v_revision is null then
    raise exception 'task % not found for user %', p_task_id, p_user_id;
  end if;

  insert into reminders (user_id, task_id, scheduled_at, status, unique_key)
  values (p_user_id, p_task_id, p_scheduled_at, 'PENDING', 'task:' || p_task_id || ':v' || v_revision)
  returning id into v_reminder_id;

  return query select v_reminder_id, v_revision;
end;
$$;

create or replace function cancel_task_reminders(p_task_id uuid)
returns setof uuid
language sql
as $$
  update reminders
  set status = 'CANCELLED', updated_at = now()
  where task_id = p_task_id
    and status in ('PENDING', 'PROCESSING')
  returning id;
$$;

create or replace function claim_due_reminders(p_batch_size integer, p_missed_grace_minutes integer, p_lock_seconds integer)
returns table (
  out_id uuid,
  out_user_id uuid,
  out_task_id uuid,
  out_series_id uuid,
  out_scheduled_at timestamptz,
  out_attempts integer
)
language plpgsql
as $$
begin
  -- PRD 13.6 rule 1: a PENDING reminder past the grace period can no
  -- longer be delivered usefully - mark it MISSED instead of sending.
  update reminders
  set status = 'MISSED', updated_at = now()
  where status = 'PENDING'
    and scheduled_at < now() - (p_missed_grace_minutes * interval '1 minute');

  return query
  update reminders
  set status = 'PROCESSING',
      attempts = reminders.attempts + 1,
      next_attempt_at = null,
      updated_at = now()
  where reminders.id in (
    select r.id
    from reminders r
    where r.status = 'PENDING'
      and r.scheduled_at <= now()
    order by r.scheduled_at asc
    for update skip locked
    limit p_batch_size
  )
  returning reminders.id, reminders.user_id, reminders.task_id, reminders.series_id,
    reminders.scheduled_at, reminders.attempts;
end;
$$;

-- PRD 13.6 rule 3: retries whose next attempt would fall past the grace
-- window relative to scheduled_at are marked FAILED (final) instead of
-- being retried again.
create or replace function reclaim_stale_processing_reminders(p_lock_timeout_minutes integer)
returns setof uuid
language sql
as $$
  update reminders
  set status = 'PENDING', updated_at = now()
  where status = 'PROCESSING'
    and updated_at < now() - (p_lock_timeout_minutes * interval '1 minute')
  returning id;
$$;
