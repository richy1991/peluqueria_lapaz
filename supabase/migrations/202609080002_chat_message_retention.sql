-- Retención privada del chat: los mensajes dejan de existir al cumplir siete días.
create index if not exists messages_created_at_idx
  on public.messages(created_at);

create or replace function public.purge_expired_chat_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  delete from public.messages
  where created_at < now() - interval '7 days';

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

comment on function public.purge_expired_chat_messages()
  is 'Elimina mensajes de chat con más de siete días de antigüedad.';

revoke all on function public.purge_expired_chat_messages() from public, anon, authenticated;

create or replace function public.enforce_chat_message_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.purge_expired_chat_messages();
  return null;
end;
$$;

revoke all on function public.enforce_chat_message_retention() from public, anon, authenticated;

drop trigger if exists enforce_chat_message_retention on public.messages;
create trigger enforce_chat_message_retention
after insert on public.messages
for each statement
execute function public.enforce_chat_message_retention();

create extension if not exists pg_cron;

do $retention$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'legend-chat-retention-hourly'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'legend-chat-retention-hourly',
    '17 * * * *',
    'select public.purge_expired_chat_messages();'
  );
end;
$retention$;

select public.purge_expired_chat_messages();
