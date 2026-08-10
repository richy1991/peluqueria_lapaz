create table if not exists public.cashier_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cashier_profiles is
  'Directorio persistente de cajeros. Conserva al personal inactivo aunque se retire su capacidad operativa.';

insert into public.cashier_profiles (user_id, active)
select ur.user_id, true
from public.user_roles ur
where ur.role = 'cashier'
on conflict (user_id) do update
set active = true,
    updated_at = now();

alter table public.cashier_profiles enable row level security;

drop policy if exists "Admins manage cashier profiles" on public.cashier_profiles;
create policy "Admins manage cashier profiles"
on public.cashier_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Cashiers read own profile" on public.cashier_profiles;
create policy "Cashiers read own profile"
on public.cashier_profiles
for select
to authenticated
using (user_id = auth.uid());

grant select on table public.cashier_profiles to authenticated;
revoke insert, update, delete on table public.cashier_profiles from anon, authenticated;

create or replace function public.set_cashier_role(target_email text, enabled boolean default true)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  target_id uuid;
  normalized_email text := lower(trim(target_email));
begin
  if not public.is_admin() then
    raise exception 'Acceso administrativo requerido';
  end if;

  select id into target_id
  from public.profiles
  where lower(email) = normalized_email;

  if target_id is null then
    raise exception 'La cuenta debe iniciar sesión con Google antes de recibir acceso de caja';
  end if;

  insert into public.cashier_profiles (user_id, active, updated_at)
  values (target_id, enabled, now())
  on conflict (user_id) do update
  set active = excluded.active,
      updated_at = now();

  if enabled then
    insert into public.user_roles(user_id, role)
    values(target_id, 'client')
    on conflict do nothing;

    insert into public.user_roles(user_id, role)
    values(target_id, 'cashier')
    on conflict do nothing;
  else
    delete from public.user_roles
    where user_id = target_id and role = 'cashier';
  end if;

  insert into public.audit_logs(actor_id, action, entity, entity_id, data)
  values(
    auth.uid(),
    case when enabled then 'cashier_granted' else 'cashier_revoked' end,
    'cashier_profiles',
    target_id::text,
    jsonb_build_object('email', normalized_email, 'active', enabled)
  );
end;
$$;

revoke all on function public.set_cashier_role(text, boolean) from public;
grant execute on function public.set_cashier_role(text, boolean) to authenticated;

