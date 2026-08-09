-- Un desarrollador superadmin no se duplica como administrador operativo.
delete from public.user_roles
where role = 'admin'
  and user_id in (
    select id from public.profiles
    where lower(email) in ('dick.nina29@gmail.com', 'juanperez.trinidad123@gmail.com')
  );

delete from public.user_roles
where role = 'superadmin'
  and user_id not in (
    select id from public.profiles where lower(email) = 'dick.nina29@gmail.com'
  );

insert into public.user_roles (user_id, role)
select id, 'client' from public.profiles
where lower(email) in ('dick.nina29@gmail.com', 'juanperez.trinidad123@gmail.com')
on conflict do nothing;

insert into public.user_roles (user_id, role)
select id, 'superadmin' from public.profiles
where lower(email) = 'dick.nina29@gmail.com'
on conflict do nothing;

create or replace function public.list_admin_users()
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_superadmin() then raise exception 'Acceso exclusivo para superadministradores'; end if;
  return query
  select distinct on (ur.user_id) ur.user_id, p.email, ur.role, ur.created_at
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.role in ('admin','superadmin')
  order by ur.user_id, case when ur.role='superadmin' then 0 else 1 end, ur.created_at;
end; $$;

create or replace function public.set_admin_role(target_email text, enabled boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare target_user_id uuid;
begin
  if not public.is_superadmin() then raise exception 'Acceso exclusivo para superadministradores'; end if;
  select id into target_user_id from public.profiles where lower(email)=lower(trim(target_email));
  if target_user_id is null then raise exception 'La cuenta debe iniciar sesión con Google al menos una vez'; end if;
  if exists(select 1 from public.user_roles where user_id=target_user_id and role='superadmin') then raise exception 'El superadministrador técnico no necesita el rol administrador'; end if;
  if target_user_id=auth.uid() then raise exception 'No puedes modificar tu propio acceso'; end if;
  if enabled then
    insert into public.user_roles(user_id,role) values(target_user_id,'admin') on conflict do nothing;
    insert into public.user_roles(user_id,role) values(target_user_id,'client') on conflict do nothing;
    insert into public.notifications(user_id,type,title,body) values(target_user_id,'account_update','Acceso administrativo activado','Ya puedes ingresar al panel de administración.');
  else
    delete from public.user_roles where user_id=target_user_id and role='admin';
  end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),case when enabled then 'admin_role_granted' else 'admin_role_revoked' end,'user_roles',target_user_id::text,jsonb_build_object('email',lower(trim(target_email))));
end; $$;
