-- A barber or cashier account must not also retain the client role.
-- Serialize role inserts per user so a simultaneous signup and staff assignment
-- cannot leave both roles attached to the account.
create or replace function public.enforce_exclusive_staff_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role not in ('client', 'barber', 'cashier') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  if new.role = 'client' then
    if exists (
      select 1
      from public.user_roles as existing_role
      where existing_role.user_id = new.user_id
        and existing_role.role in ('barber', 'cashier')
    ) then
      return null;
    end if;
  else
    delete from public.user_roles
    where user_id = new.user_id
      and role = 'client';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_exclusive_staff_roles() from public, anon, authenticated;

drop trigger if exists user_roles_exclusive_staff_role on public.user_roles;
create trigger user_roles_exclusive_staff_role
before insert on public.user_roles
for each row execute function public.enforce_exclusive_staff_roles();

create or replace function public.restore_client_role_after_staff_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role not in ('barber', 'cashier') then
    return old;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(old.user_id::text, 0)
  );

  if exists (select 1 from public.profiles where id = old.user_id)
    and not exists (
      select 1 from public.user_roles
      where user_id = old.user_id and role in ('barber', 'cashier', 'admin', 'superadmin')
    ) then
    insert into public.user_roles(user_id, role)
    values (old.user_id, 'client')
    on conflict do nothing;
  end if;

  return old;
end;
$$;

revoke all on function public.restore_client_role_after_staff_removal() from public, anon, authenticated;

drop trigger if exists user_roles_restore_client_after_staff_removal on public.user_roles;
create trigger user_roles_restore_client_after_staff_removal
after delete on public.user_roles
for each row execute function public.restore_client_role_after_staff_removal();

-- Correct accounts that already received both roles before this migration.
delete from public.user_roles as client_role
where client_role.role = 'client'
  and exists (
    select 1
    from public.user_roles as staff_role
    where staff_role.user_id = client_role.user_id
      and staff_role.role in ('barber', 'cashier')
  );

comment on function public.enforce_exclusive_staff_roles() is
  'Keeps client role exclusive from barber and cashier roles, including pending staff invitations accepted during signup.';
