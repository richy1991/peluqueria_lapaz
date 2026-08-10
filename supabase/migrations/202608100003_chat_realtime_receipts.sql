-- Mensajería en tiempo real: confirmaciones de lectura y cambios en vivo.
alter table public.messages
  add column if not exists read_at timestamptz,
  add column if not exists read_by uuid references public.profiles(id) on delete set null;

create index if not exists messages_unread_conversation_idx
  on public.messages(conversation_id, created_at)
  where read_at is null;

create or replace function public.mark_chat_conversation_read(target_conversation uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  affected integer;
  client_id uuid;
begin
  if auth.uid() is null or not public.can_access_conversation(target_conversation) then
    raise exception 'Conversación no disponible';
  end if;

  select created_by into client_id
  from public.conversations
  where id=target_conversation;

  if auth.uid()=client_id then
    update public.messages
    set read_at=now(), read_by=auth.uid()
    where conversation_id=target_conversation
      and sender_id<>client_id
      and read_at is null;
  else
    update public.messages
    set read_at=now(), read_by=auth.uid()
    where conversation_id=target_conversation
      and sender_id=client_id
      and read_at is null;
  end if;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_chat_conversation_read(uuid) from public;
grant execute on function public.mark_chat_conversation_read(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
