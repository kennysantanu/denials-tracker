alter table conversations
  add column if not exists tool_call_id text,
  add column if not exists tool_calls jsonb,
  add column if not exists tool_args jsonb,
  add column if not exists tool_result jsonb,
  add column if not exists tool_round integer,
  add column if not exists tool_max_rounds integer;
