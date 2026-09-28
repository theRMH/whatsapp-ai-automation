-- 0003_usage_and_rate_limit_functions.sql
-- PRD 45.1: atomic increment-and-check helpers for the daily AI request
-- limit (usage_daily.ai_requests) and the per-minute inbound message
-- limit (rate_limit_windows). Both must increment and return the new
-- count in a single statement so concurrent webhook deliveries cannot
-- race past the limit - a plain select-then-update from application code
-- would not be atomic under concurrent requests.

create or replace function increment_daily_ai_requests(
  p_user_id uuid,
  p_usage_date date
) returns integer
language sql
as $$
  insert into usage_daily (user_id, usage_date, ai_requests)
  values (p_user_id, p_usage_date, 1)
  on conflict (user_id, usage_date)
  do update set ai_requests = usage_daily.ai_requests + 1, updated_at = now()
  returning ai_requests;
$$;

create or replace function rate_limit_hit(
  p_user_id uuid,
  p_bucket text,
  p_window_start timestamptz
) returns integer
language sql
as $$
  insert into rate_limit_windows (user_id, bucket, window_start, count)
  values (p_user_id, p_bucket, p_window_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = rate_limit_windows.count + 1
  returning count;
$$;

-- Generic atomic increment for the remaining usage_daily counters
-- (inbound_messages, outbound_messages, google_requests, reminders_sent).
-- p_counter is validated against a fixed allowlist to prevent SQL
-- injection via dynamic identifier construction.
create or replace function increment_usage_counter(
  p_user_id uuid,
  p_usage_date date,
  p_counter text,
  p_amount integer default 1
) returns void
language plpgsql
as $$
begin
  if p_counter not in ('inbound_messages', 'outbound_messages', 'google_requests', 'reminders_sent') then
    raise exception 'invalid usage counter: %', p_counter;
  end if;

  execute format(
    'insert into usage_daily (user_id, usage_date, %1$I)
     values ($1, $2, $3)
     on conflict (user_id, usage_date)
     do update set %1$I = usage_daily.%1$I + excluded.%1$I, updated_at = now()',
    p_counter
  ) using p_user_id, p_usage_date, p_amount;
end;
$$;

-- PRD 6.2.1: atomically decide whether to send the unauthorized-number
-- reply to an unknown sender and, if so, record that it was just sent -
-- in one statement so concurrent webhook deliveries cannot both reply.
create or replace function unknown_sender_reply_hit(
  p_sender_hash text,
  p_cooldown_hours numeric
) returns boolean
language sql
as $$
  with upserted as (
    insert into unknown_sender_replies (sender_hash, last_replied_at)
    values (p_sender_hash, now())
    on conflict (sender_hash) do update
      set last_replied_at = now()
      where unknown_sender_replies.last_replied_at < now() - (p_cooldown_hours * interval '1 hour')
    returning true as replied
  )
  select coalesce((select replied from upserted), false);
$$;
