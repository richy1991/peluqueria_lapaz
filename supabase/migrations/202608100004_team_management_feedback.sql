-- Gestión consistente del equipo: fichas visibles e invitaciones activables con Google.

create table if not exists public.pending_cashiers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'canceled', 'expired')),
  invited_by uuid not null references public.profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pending_cashiers enable row level security;
drop policy if exists "Admins read pending cashiers" on public.pending_cashiers;
create policy "Admins read pending cashiers" on public.pending_cashiers
for select to authenticated using (public.is_admin());
grant select on table public.pending_cashiers to authenticated;
revoke insert, update, delete on table public.pending_cashiers from anon, authenticated;

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
  if normalized_email = '' or normalized_name = '' then raise exception 'Correo y nombre público son obligatorios'; end if;

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

create or replace function public.set_cashier_role(target_email text, enabled boolean default true)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  target_id uuid;
  normalized_email text := lower(trim(target_email));
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if normalized_email = '' then raise exception 'El correo es obligatorio'; end if;
  select id into target_id from public.profiles where lower(email)=normalized_email;

  if target_id is null then
    if enabled then
      insert into public.pending_cashiers(email,status,invited_by,expires_at,updated_at)
      values(normalized_email,'pending',auth.uid(),now()+interval '30 days',now())
      on conflict(email) do update
      set status='pending',invited_by=auth.uid(),expires_at=excluded.expires_at,accepted_at=null,updated_at=now();
    else
      update public.pending_cashiers set status='canceled',updated_at=now() where email=normalized_email;
    end if;
    insert into public.audit_logs(actor_id,action,entity,entity_id,data)
    values(auth.uid(),case when enabled then 'cashier_invited' else 'cashier_invitation_canceled' end,'pending_cashiers',normalized_email,jsonb_build_object('email',normalized_email));
    return;
  end if;

  insert into public.cashier_profiles(user_id,active,updated_at)
  values(target_id,enabled,now())
  on conflict(user_id) do update set active=excluded.active,updated_at=now();
  if enabled then
    insert into public.user_roles(user_id,role) values(target_id,'client') on conflict do nothing;
    insert into public.user_roles(user_id,role) values(target_id,'cashier') on conflict do nothing;
  else
    delete from public.user_roles where user_id=target_id and role='cashier';
  end if;
  update public.pending_cashiers
  set status=case when enabled then 'accepted' else 'canceled' end,
      accepted_at=case when enabled then now() else accepted_at end,
      updated_at=now()
  where email=normalized_email;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data)
  values(auth.uid(),case when enabled then 'cashier_granted' else 'cashier_revoked' end,'cashier_profiles',target_id::text,jsonb_build_object('email',normalized_email,'active',enabled));
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  pending public.pending_barbers%rowtype;
  pending_cashier public.pending_cashiers%rowtype;
  target_barber_id uuid;
begin
  insert into public.profiles(id,email,full_name,avatar_url)
  values(new.id,coalesce(new.email,''),new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update
  set email=excluded.email,full_name=coalesce(excluded.full_name,public.profiles.full_name),avatar_url=coalesce(excluded.avatar_url,public.profiles.avatar_url);
  insert into public.user_roles(user_id,role) values(new.id,'client') on conflict do nothing;

  select * into pending from public.pending_barbers
  where lower(email)=lower(coalesce(new.email,'')) and status='pending' and expires_at>now()
  order by created_at desc limit 1;
  if found then
    if pending.barber_profile_id is not null then
      update public.barber_profiles set user_id=new.id,active=true,updated_at=now()
      where id=pending.barber_profile_id returning id into target_barber_id;
    else
      insert into public.barber_profiles(user_id,slug,display_name,bio,specialties,commission_percent,active)
      values(new.id,regexp_replace(lower(pending.full_name),'[^a-z0-9]+','-','g')||'-'||substr(new.id::text,1,6),pending.full_name,pending.bio,pending.specialties,pending.commission_percent,true)
      on conflict(user_id) do update
      set display_name=excluded.display_name,bio=excluded.bio,specialties=excluded.specialties,commission_percent=excluded.commission_percent,active=true
      returning id into target_barber_id;
    end if;
    insert into public.user_roles(user_id,role) values(new.id,'barber') on conflict do nothing;
    update public.pending_barbers set status='accepted',accepted_at=now() where id=pending.id;
    insert into public.notifications(user_id,type,title,body)
    values(new.id,'account_update','Perfil de peluquero activado','Ya puedes acceder a tu agenda de trabajo.');
  end if;

  select * into pending_cashier from public.pending_cashiers
  where lower(email)=lower(coalesce(new.email,'')) and status='pending' and expires_at>now()
  order by created_at desc limit 1;
  if found then
    insert into public.cashier_profiles(user_id,active,updated_at)
    values(new.id,true,now()) on conflict(user_id) do update set active=true,updated_at=now();
    insert into public.user_roles(user_id,role) values(new.id,'cashier') on conflict do nothing;
    update public.pending_cashiers set status='accepted',accepted_at=now(),updated_at=now() where id=pending_cashier.id;
    insert into public.notifications(user_id,type,title,body)
    values(new.id,'account_update','Acceso de caja activado','Tu cuenta ahora puede ingresar a la terminal de caja.');
  end if;
  return new;
end;
$$;

revoke all on function public.pre_register_barber(text,text,text[],text) from public;
revoke all on function public.set_cashier_role(text,boolean) from public;
grant execute on function public.pre_register_barber(text,text,text[],text) to authenticated;
grant execute on function public.set_cashier_role(text,boolean) to authenticated;
