-- Gestión segura de administradores y reparación de textos españoles.

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid() and role = 'superadmin'
  );
$$;

create or replace function public.list_admin_users()
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Acceso exclusivo para superadministradores';
  end if;

  return query
  select ur.user_id, p.email, ur.role, ur.created_at
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  order by case when ur.role = 'superadmin' then 0 else 1 end, lower(p.email);
end;
$$;

create or replace function public.set_admin_role(target_email text, enabled boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  normalized_email text := lower(trim(target_email));
begin
  if not public.is_superadmin() then
    raise exception 'Acceso exclusivo para superadministradores';
  end if;

  select id into target_user_id
  from public.profiles
  where lower(email) = normalized_email;

  if target_user_id is null then
    raise exception 'La cuenta debe iniciar sesión con Google al menos una vez';
  end if;

  if enabled then
    insert into public.user_roles (user_id, role)
    values (target_user_id, 'admin')
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles
    where user_id = target_user_id and role = 'admin';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (
    auth.uid(),
    case when enabled then 'admin_role_granted' else 'admin_role_revoked' end,
    'user_roles',
    target_user_id::text,
    jsonb_build_object('email', normalized_email)
  );
end;
$$;

revoke all on function public.is_superadmin() from public;
revoke all on function public.list_admin_users() from public;
revoke all on function public.set_admin_role(text, boolean) from public;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.list_admin_users() to authenticated;
grant execute on function public.set_admin_role(text, boolean) to authenticated;

insert into public.user_roles (user_id, role)
select id, 'superadmin'
from public.profiles
where lower(email) = 'dick.nina29@gmail.com'
on conflict (user_id, role) do nothing;

update public.business_settings
set hours_text = 'Martes a domingo · 09:00 a 20:00'
where id = true;

update public.services
set name = 'Corte clásico',
    description = 'Diagnóstico, corte personalizado y acabado con producto.'
where id = '10000000-0000-4000-8000-000000000001';

update public.services
set description = 'Diseño de barba, afeitado de contornos y cuidado hidratante.'
where id = '10000000-0000-4000-8000-000000000003';

update public.services
set description = 'Atención paciente y cómoda para niños de hasta 12 años.'
where id = '10000000-0000-4000-8000-000000000004';

update public.gallery_posts
set title = 'Corte clásico'
where id = '30000000-0000-4000-8000-000000000001';

update public.gallery_posts
set description = 'Detalle, simetría y cuidado.'
where id = '30000000-0000-4000-8000-000000000002';

update public.products
set description = 'Fijación media con acabado natural para uso diario.'
where id = '40000000-0000-4000-8000-000000000001';

update public.products
set description = 'Hidratación ligera y aroma fresco.'
where id = '40000000-0000-4000-8000-000000000002';

update public.barber_profiles
set bio = 'Barbero senior enfocado en técnica y detalle.'
where id = '20000000-0000-4000-8000-000000000001';

update public.barber_profiles
set display_name = 'Sofía Molina'
where id = '20000000-0000-4000-8000-000000000003';
