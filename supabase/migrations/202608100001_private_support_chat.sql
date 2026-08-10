-- Centro privado de atención: clientes conversan únicamente con soporte.
create or replace function public.can_support_chat()
returns boolean language sql stable security definer set search_path=''
as $$ select public.is_admin() or public.is_cashier(); $$;

create or replace function public.can_access_conversation(target_conversation uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select public.can_support_chat()
    or exists(
      select 1 from public.conversation_participants
      where conversation_id=target_conversation and user_id=auth.uid()
    );
$$;

drop policy if exists "Participants access" on public.conversation_participants;
create policy "Participants and support access" on public.conversation_participants
for select using(user_id=auth.uid() or public.can_support_chat());

revoke all on function public.can_support_chat() from public;
grant execute on function public.can_support_chat() to authenticated;
