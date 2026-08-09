-- Permite invitar administradores antes de su primer inicio de sesión con Google.
create table if not exists public.pending_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'canceled', 'expired')),
  invited_by uuid not null references public.profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

alter table public.pending_admins enable row level security;

drop policy if exists "Superadmins manage pending admins" on public.pending_admins;
create policy "Superadmins manage pending admins" on public.pending_admins
for all using (public.is_superadmin()) with check (public.is_superadmin());

create or replace function public.list_admin_users()
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_superadmin() then raise exception 'Acceso exclusivo para superadministradores'; end if;
  return query
  with elevated as (
    select distinct on (ur.user_id)
      ur.user_id, p.email, ur.role, ur.created_at
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role in ('admin','superadmin')
    order by ur.user_id, case when ur.role='superadmin' then 0 else 1 end, ur.created_at
  )
  select e.user_id, e.email, e.role, e.created_at from elevated e
  union all
  select null::uuid, pa.email, 'pending'::text, pa.created_at
  from public.pending_admins pa
  where pa.status = 'pending' and pa.expires_at > now()
  order by 4;
end; $$;

create or replace function public.set_admin_role(target_email text, enabled boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(trim(target_email));
  target_user_id uuid;
  pending_id uuid;
begin
  if not public.is_superadmin() then raise exception 'Acceso exclusivo para superadministradores'; end if;
  if normalized_email = '' or normalized_email not like '%@%' then raise exception 'Ingresa un correo electrónico válido'; end if;
  if normalized_email = 'dick.nina29@gmail.com' then raise exception 'La cuenta del desarrollador ya tiene acceso exclusivo de superadministrador'; end if;

  select id into target_user_id from public.profiles where lower(email) = normalized_email;
  if target_user_id = auth.uid() then raise exception 'No puedes modificar tu propio acceso'; end if;

  if enabled and target_user_id is not null then
    if exists(select 1 from public.user_roles where user_id=target_user_id and role='superadmin') then
      raise exception 'La cuenta ya es superadministrador';
    end if;
    insert into public.user_roles(user_id,role) values(target_user_id,'admin') on conflict do nothing;
    insert into public.user_roles(user_id,role) values(target_user_id,'client') on conflict do nothing;
    update public.pending_admins set status='accepted', accepted_at=now() where email=normalized_email and status='pending';
    insert into public.notifications(user_id,type,title,body)
      values(target_user_id,'account_update','Acceso administrativo activado','Ya puedes ingresar al panel de administración.');
  elsif enabled then
    insert into public.pending_admins(email,status,invited_by,expires_at)
      values(normalized_email,'pending',auth.uid(),now()+interval '30 days')
      on conflict (email) do update
        set status='pending', invited_by=auth.uid(), accepted_at=null, expires_at=now()+interval '30 days'
      returning id into pending_id;
  elsif target_user_id is not null then
    delete from public.user_roles where user_id=target_user_id and role='admin';
    update public.pending_admins set status='canceled' where email=normalized_email and status='pending';
  else
    update public.pending_admins set status='canceled' where email=normalized_email and status='pending';
    if not found then raise exception 'No existe un administrador ni una invitación pendiente para ese correo'; end if;
  end if;

  insert into public.audit_logs(actor_id,action,entity,entity_id,data)
  values(
    auth.uid(),
    case when enabled and target_user_id is null then 'admin_invited' when enabled then 'admin_role_granted' else 'admin_role_revoked' end,
    case when target_user_id is null then 'pending_admins' else 'user_roles' end,
    coalesce(target_user_id::text,pending_id::text,normalized_email),
    jsonb_build_object('email',normalized_email)
  );
end; $$;

create or replace function public.apply_pending_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pending_id uuid;
begin
  if lower(coalesce(new.email,'')) = 'dick.nina29@gmail.com' then return new; end if;

  select id into pending_id from public.pending_admins
  where lower(email)=lower(coalesce(new.email,''))
    and status='pending' and expires_at>now()
  order by created_at desc limit 1;

  if pending_id is not null then
    insert into public.user_roles(user_id,role) values(new.id,'client') on conflict do nothing;
    insert into public.user_roles(user_id,role) values(new.id,'admin') on conflict do nothing;
    update public.pending_admins set status='accepted',accepted_at=now() where id=pending_id;
    insert into public.notifications(user_id,type,title,body)
      values(new.id,'account_update','Acceso administrativo activado','Ya puedes ingresar al panel de administración.');
  end if;
  return new;
end; $$;

drop trigger if exists zz_apply_pending_admin on auth.users;
create trigger zz_apply_pending_admin
after insert or update of email on auth.users
for each row execute procedure public.apply_pending_admin();

revoke all on table public.pending_admins from public;
revoke all on function public.list_admin_users() from public;
revoke all on function public.set_admin_role(text,boolean) from public;
grant execute on function public.list_admin_users() to authenticated;
grant execute on function public.set_admin_role(text,boolean) to authenticated;
