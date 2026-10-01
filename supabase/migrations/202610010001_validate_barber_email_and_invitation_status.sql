-- El correo de un peluquero es parte de la invitación: debe validarse antes
-- de crear o actualizar su ficha, no después.

create or replace function public.pre_register_barber(
  target_email text,
  public_name text,
  specialties text[] default '{}',
  biography text default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  target_id uuid;
  profile_id uuid;
  normalized_email text := lower(trim(target_email));
  normalized_name text := trim(public_name);
  requested_specialties text[] := coalesce(specialties,'{}');
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if normalized_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' then
    raise exception 'Ingresa un correo electrónico válido.';
  end if;
  if normalized_name = '' then raise exception 'El nombre público es obligatorio'; end if;

  select id into target_id from public.profiles where lower(email)=normalized_email;
  if target_id is not null then
    insert into public.barber_profiles(user_id,slug,display_name,bio,specialties,active)
    values(target_id,regexp_replace(lower(normalized_name),'[^a-z0-9]+','-','g')||'-'||substr(target_id::text,1,6),normalized_name,nullif(trim(biography),''),requested_specialties,true)
    on conflict(user_id) do update
    set display_name=excluded.display_name,bio=excluded.bio,specialties=excluded.specialties,active=true,updated_at=now()
    returning id into profile_id;
    insert into public.user_roles(user_id,role) values(target_id,'barber') on conflict do nothing;
    insert into public.notifications(user_id,type,title,body)
    values(target_id,'account_update','Perfil de peluquero activado','Tu cuenta ahora tiene acceso a la agenda de peluquero.');
    update public.pending_barbers set status='accepted',accepted_at=now() where email=normalized_email and status='pending';
  else
    select barber_profile_id into profile_id
    from public.pending_barbers
    where email=normalized_email and barber_profile_id is not null
    order by created_at desc limit 1;

    if profile_id is null then
      insert into public.barber_profiles(user_id,slug,display_name,bio,specialties,active)
      values(null,regexp_replace(lower(normalized_name),'[^a-z0-9]+','-','g')||'-'||substr(gen_random_uuid()::text,1,6),normalized_name,nullif(trim(biography),''),requested_specialties,true)
      returning id into profile_id;
    else
      update public.barber_profiles
      set display_name=normalized_name,bio=nullif(trim(biography),''),specialties=requested_specialties,active=true,updated_at=now()
      where id=profile_id;
    end if;

    insert into public.pending_barbers(email,full_name,specialties,bio,status,invited_by,expires_at,barber_profile_id)
    values(normalized_email,normalized_name,requested_specialties,nullif(trim(biography),''),'pending',auth.uid(),now()+interval '30 days',profile_id)
    on conflict(email) do update
    set full_name=excluded.full_name,specialties=excluded.specialties,bio=excluded.bio,status='pending',invited_by=auth.uid(),expires_at=excluded.expires_at,barber_profile_id=excluded.barber_profile_id;
  end if;

  insert into public.audit_logs(actor_id,action,entity,entity_id,data)
  values(auth.uid(),'barber_registered','barber_profiles',profile_id::text,jsonb_build_object('email',normalized_email));
  return profile_id;
end;
$$;

create or replace function public.link_barber_account(target_barber_id uuid, target_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_user uuid; barber public.barber_profiles%rowtype; normalized_email text := lower(trim(target_email));
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if normalized_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' then
    raise exception 'Ingresa un correo electrónico válido.';
  end if;
  select * into barber from public.barber_profiles where id=target_barber_id;
  if not found then raise exception 'Peluquero no encontrado'; end if;
  select id into target_user from public.profiles where lower(email)=normalized_email;
  if target_user is not null then
    if exists(select 1 from public.barber_profiles where user_id=target_user and id<>target_barber_id) then raise exception 'La cuenta ya está vinculada a otro peluquero'; end if;
    update public.barber_profiles set user_id=target_user,active=true,updated_at=now() where id=target_barber_id;
    insert into public.user_roles(user_id,role) values(target_user,'barber') on conflict do nothing;
    insert into public.notifications(user_id,type,title,body) values(target_user,'account_update','Perfil de peluquero activado','Ya puedes acceder a tu agenda de trabajo.');
  else
    insert into public.pending_barbers(email,full_name,specialties,bio,commission_percent,status,invited_by,expires_at,barber_profile_id)
    values(normalized_email,barber.display_name,barber.specialties,barber.bio,barber.commission_percent,'pending',auth.uid(),now()+interval '30 days',target_barber_id)
    on conflict(email) do update set full_name=excluded.full_name,specialties=excluded.specialties,bio=excluded.bio,commission_percent=excluded.commission_percent,status='pending',invited_by=auth.uid(),expires_at=excluded.expires_at,barber_profile_id=excluded.barber_profile_id;
  end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'barber_account_linked','barber_profiles',target_barber_id::text,jsonb_build_object('email',normalized_email));
end; $$;

revoke all on function public.pre_register_barber(text,text,text[],text) from public;
revoke all on function public.link_barber_account(uuid,text) from public;
grant execute on function public.pre_register_barber(text,text,text[],text) to authenticated;
grant execute on function public.link_barber_account(uuid,text) to authenticated;
