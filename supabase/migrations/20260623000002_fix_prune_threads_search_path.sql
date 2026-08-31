-- Fix: prune_user_threads() references chat_threads without schema qualification,
-- but the function uses set search_path = ''. This causes the trigger to fail on
-- every insert/update of chat_threads, rolling back the transaction.
-- Fix: qualify table references with public. schema.

create or replace function prune_user_threads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Delete threads beyond the 20 most recent non-archived for this user.
  delete from public.chat_threads
  where id in (
    select id from public.chat_threads
    where user_id = new.user_id
      and archived_at is null
    order by last_message_at desc
    offset 20
  );
  return new;
end;
$$;
