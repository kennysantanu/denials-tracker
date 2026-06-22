-- Thread grouping for conversations.
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on update cascade on delete cascade,
  title text not null default 'New chat',
  archived_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table chat_threads enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'chat_threads' and policyname = 'Users manage their own threads'
  ) then
    create policy "Users manage their own threads"
      on chat_threads as permissive for all to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_chat_threads_user_recent
  on chat_threads (user_id, last_message_at desc);

-- Add thread_id to conversations (additive — existing rows get null, which is fine).
alter table conversations
  add column if not exists thread_id uuid references chat_threads(id) on delete cascade;

-- Client-generated idempotency key so two tabs can't double-insert the same message.
alter table conversations
  add column if not exists client_message_id text;

-- Soft-delete timestamp for edit-and-resubmit truncation (Phase 7).
-- Truncated rows are retained for audit but excluded from thread loads.
alter table conversations
  add column if not exists deleted_at timestamptz;

create index if not exists idx_conversations_thread
  on conversations (thread_id, created_at);

create unique index if not exists conversations_client_msg_id_unique
  on conversations (thread_id, client_message_id)
  where client_message_id is not null;

-- Thread retention: keep at most 20 non-archived threads per user.
-- Runs as a trigger after each thread create/update to prune oldest excess threads.
-- Pruned threads are hard-deleted (cascade removes their conversations rows).
create or replace function prune_user_threads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Delete threads beyond the 20 most recent non-archived for this user.
  delete from chat_threads
  where id in (
    select id from chat_threads
    where user_id = new.user_id
      and archived_at is null
    order by last_message_at desc
    offset 20
  );
  return new;
end;
$$;

drop trigger if exists trg_prune_user_threads on chat_threads;
create trigger trg_prune_user_threads
  after insert or update of last_message_at on chat_threads
  for each row execute function prune_user_threads();
