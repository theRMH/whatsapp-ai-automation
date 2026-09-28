-- 0005_ai_token_usage_function.sql
-- PRD 45.1 / 33.17: atomic increment for usage_daily's AI token counters,
-- recorded once per AI turn alongside the daily request counter. Kept
-- separate from increment_usage_counter (0003) since that function's
-- allowlist intentionally does not include the token columns.

create or replace function increment_daily_ai_tokens(
  p_user_id uuid,
  p_usage_date date,
  p_input_tokens integer,
  p_output_tokens integer
) returns void
language sql
as $$
  insert into usage_daily (user_id, usage_date, ai_input_tokens, ai_output_tokens)
  values (p_user_id, p_usage_date, p_input_tokens, p_output_tokens)
  on conflict (user_id, usage_date)
  do update set
    ai_input_tokens = usage_daily.ai_input_tokens + excluded.ai_input_tokens,
    ai_output_tokens = usage_daily.ai_output_tokens + excluded.ai_output_tokens,
    updated_at = now();
$$;
