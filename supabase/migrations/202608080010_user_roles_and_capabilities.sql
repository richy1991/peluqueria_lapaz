-- Roles, capacidades combinadas y comportamientos definidos en la guía.

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('client', 'barber', 'admin', 'superadmin'));

alter table public.profiles
  add column if not exists birthday date,
  add column if not exists address text,
  add column if not exists late_cancel_count integer not null default 0,
  add column if not exists blacklist_reason text,
  add column if not exists blocked_reason text,
  add column if not exists blocked_by uuid references public.profiles(id),
  add column if not exists blocked_at timestamptz,
  add column if not exists photo_consent boolean not null default false;

alter table public.barber_profiles
  add column if not exists commission_percent numeric(5,2)
    check (commission_percent is null or commission_percent between 0 and 100);

alter table public.appointments
  add column if not exists appointment_type text not null default 'in_shop'
    check (appointment_type in ('in_shop', 'home_service', 'walk_in')),
  add column if not exists address text,
  add column if not exists location_reference text,
  add column if not exists delay_note text,
  add column if not exists no_show boolean not null default false,
  add column if not exists reassigned_from_barber_id uuid references public.barber_profiles(id),
  add column if not exists emergency_reason text,
  add column if not exists client_confirmation_status text,
  add column if not exists is_minor_appointment boolean not null default false,
  add column if not exists minor_name text,
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists guardian_consent boolean not null default false;

create table if not exists public.pending_barbers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  phone text,
  specialties text[] not null default '{}',
  bio text,
  commission_percent numeric(5,2) check (commission_percent is null or commission_percent between 0 and 100),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'canceled', 'expired')),
  invited_by uuid not null references public.profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  appointment_notifications boolean not null default true,
  promotion_notifications boolean not null default true,
  chat_notifications boolean not null default true,
  system_notifications boolean not null default true,
  muted_all boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.user_roles (user_id, role)
select id, 'client' from public.profiles on conflict do nothing;

alter table public.pending_barbers enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.feature_flags enable row level security;

create policy "Users read own roles" on public.user_roles for select using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage pending barbers" on public.pending_barbers for all using (public.is_admin()) with check (public.is_admin());
create policy "Users read own notifications" on public.notifications for select using (user_id = auth.uid() or public.is_admin());
create policy "Users update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own preferences" on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Authenticated read feature flags" on public.feature_flags for select to authenticated using (true);
create policy "Superadmins manage feature flags" on public.feature_flags for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy "Barbers read assigned appointments" on public.appointments for select using (
  exists (select 1 from public.barber_profiles b where b.id = barber_id and b.user_id = auth.uid() and b.active)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  pending public.pending_barbers%rowtype;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do update set email = excluded.email, full_name = coalesce(excluded.full_name, public.profiles.full_name), avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  insert into public.user_roles (user_id, role) values (new.id, 'client') on conflict do nothing;

  select * into pending from public.pending_barbers
  where lower(email) = lower(coalesce(new.email, '')) and status = 'pending' and expires_at > now()
  order by created_at desc limit 1;

  if found then
    insert into public.barber_profiles (user_id, slug, display_name, bio, specialties, commission_percent, active)
    values (new.id, regexp_replace(lower(pending.full_name), '[^a-z0-9]+', '-', 'g') || '-' || substr(new.id::text, 1, 6), pending.full_name, pending.bio, pending.specialties, pending.commission_percent, true)
    on conflict (user_id) do update set display_name = excluded.display_name, bio = excluded.bio, specialties = excluded.specialties, commission_percent = excluded.commission_percent, active = true;
    insert into public.user_roles (user_id, role) values (new.id, 'barber') on conflict do nothing;
    update public.pending_barbers set status = 'accepted', accepted_at = now() where id = pending.id;
    insert into public.notifications (user_id, type, title, body) values (new.id, 'account_update', 'Perfil de peluquero activado', 'Ya puedes acceder a tu agenda de trabajo.');
  end if;
  return new;
end;
$$;

create or replace function public.pre_register_barber(target_email text, public_name text, specialties text[] default '{}', biography text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare target_id uuid; pending_id uuid;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  select id into target_id from public.profiles where lower(email) = lower(trim(target_email));
  if target_id is not null then
    insert into public.barber_profiles (user_id, slug, display_name, bio, specialties, active)
    values (target_id, regexp_replace(lower(public_name), '[^a-z0-9]+', '-', 'g') || '-' || substr(target_id::text, 1, 6), public_name, biography, specialties, true)
    on conflict (user_id) do update set display_name=excluded.display_name, bio=excluded.bio, specialties=excluded.specialties, active=true
    returning id into pending_id;
    insert into public.user_roles (user_id, role) values (target_id, 'barber') on conflict do nothing;
    insert into public.notifications (user_id,type,title,body) values (target_id,'account_update','Perfil de peluquero activado','Tu cuenta ahora tiene acceso a la agenda de peluquero.');
  else
    insert into public.pending_barbers (email,full_name,specialties,bio,invited_by)
    values (lower(trim(target_email)),public_name,specialties,biography,auth.uid())
    on conflict (email) do update set full_name=excluded.full_name,specialties=excluded.specialties,bio=excluded.bio,status='pending',invited_by=auth.uid(),expires_at=now()+interval '30 days'
    returning id into pending_id;
  end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'barber_registered','barber_profiles',pending_id::text,jsonb_build_object('email',lower(trim(target_email))));
  return pending_id;
end;
$$;

create or replace function public.set_admin_role(target_email text, enabled boolean default true)
returns void
language plpgsql security definer set search_path = ''
as $$
declare target_user_id uuid; remaining_admins integer;
begin
  if not public.is_superadmin() then raise exception 'Acceso exclusivo para superadministradores'; end if;
  select id into target_user_id from public.profiles where lower(email)=lower(trim(target_email));
  if target_user_id is null then raise exception 'La cuenta debe iniciar sesión con Google al menos una vez'; end if;
  if not enabled and target_user_id=auth.uid() then raise exception 'No puedes retirar tu propio acceso'; end if;
  if enabled then
    insert into public.user_roles(user_id,role) values(target_user_id,'admin') on conflict do nothing;
    insert into public.notifications(user_id,type,title,body) values(target_user_id,'account_update','Acceso administrativo activado','Ya puedes ingresar al panel de administración.');
  else
    select count(*) into remaining_admins from public.user_roles ur join public.profiles p on p.id=ur.user_id where ur.role='admin' and p.status='active' and ur.user_id<>target_user_id;
    if remaining_admins=0 then raise exception 'Debe permanecer al menos un administrador activo'; end if;
    delete from public.user_roles where user_id=target_user_id and role='admin';
  end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),case when enabled then 'admin_role_granted' else 'admin_role_revoked' end,'user_roles',target_user_id::text,jsonb_build_object('email',lower(trim(target_email))));
end;
$$;

create or replace function public.set_barber_active(target_barber_id uuid, enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare target_user uuid;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  update public.barber_profiles set active=enabled,updated_at=now() where id=target_barber_id returning user_id into target_user;
  if not enabled then
    update public.appointments set status='needs_reschedule',emergency_reason='Peluquero no disponible',updated_at=now()
    where barber_id=target_barber_id and starts_at>now() and status in ('requested','confirmed','pending_client_confirmation');
  end if;
  if target_user is not null then
    if enabled then insert into public.user_roles(user_id,role) values(target_user,'barber') on conflict do nothing;
    else delete from public.user_roles where user_id=target_user and role='barber'; end if;
  end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),case when enabled then 'barber_activated' else 'barber_deactivated' end,'barber_profiles',target_barber_id::text,'{}');
end; $$;

create or replace function public.cancel_own_appointment(target_appointment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare appt public.appointments%rowtype;
begin
  select * into appt from public.appointments where id=target_appointment_id and client_id=auth.uid() for update;
  if not found then raise exception 'Cita no encontrada'; end if;
  if appt.status not in ('requested','confirmed','pending_client_confirmation') then raise exception 'Esta cita ya no puede cancelarse'; end if;
  if appt.starts_at < now()+interval '2 hours' then raise exception 'Las cancelaciones con menos de 2 horas se gestionan directamente con el negocio'; end if;
  update public.appointments set status='canceled',updated_at=now() where id=appt.id;
  insert into public.notifications(user_id,type,title,body,data) values(auth.uid(),'appointment_canceled','Cita cancelada','Tu horario fue liberado correctamente.',jsonb_build_object('appointment_id',appt.id));
end; $$;

create or replace function public.update_assigned_appointment(target_appointment_id uuid, next_status text, note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare appt public.appointments%rowtype; allowed boolean;
begin
  select * into appt from public.appointments where id=target_appointment_id for update;
  allowed := public.is_admin() or exists(select 1 from public.barber_profiles b where b.id=appt.barber_id and b.user_id=auth.uid() and b.active);
  if not allowed then raise exception 'No tienes acceso a esta cita'; end if;
  if next_status not in ('confirmed','in_progress','completed','no_show') then raise exception 'Estado no permitido'; end if;
  if next_status='no_show' and now() < appt.starts_at + make_interval(mins => (select grace_minutes from public.services where id=appt.service_id)) then raise exception 'Aún no terminó el tiempo de gracia'; end if;
  update public.appointments set status=next_status,is_delayed=coalesce(note,'')<>'',delay_note=note,no_show=(next_status='no_show'),updated_at=now() where id=appt.id;
  if next_status='no_show' and not appt.no_show then
    update public.profiles set no_show_count=no_show_count+1,is_blacklisted=(no_show_count+1)>=3,blacklist_reason=case when no_show_count+1>=3 then 'Tres inasistencias registradas' else blacklist_reason end,updated_at=now() where id=appt.client_id;
  end if;
  insert into public.notifications(user_id,type,title,body,data) values(appt.client_id,case when next_status='no_show' then 'appointment_no_show' else 'appointment_confirmed' end,'Estado de tu cita','Tu cita cambió a: '||next_status,jsonb_build_object('appointment_id',appt.id));
end; $$;

revoke all on function public.pre_register_barber(text,text,text[],text) from public;
revoke all on function public.set_barber_active(uuid,boolean) from public;
revoke all on function public.cancel_own_appointment(uuid) from public;
revoke all on function public.update_assigned_appointment(uuid,text,text) from public;
grant execute on function public.pre_register_barber(text,text,text[],text) to authenticated;
grant execute on function public.set_barber_active(uuid,boolean) to authenticated;
grant execute on function public.cancel_own_appointment(uuid) to authenticated;
grant execute on function public.update_assigned_appointment(uuid,text,text) to authenticated;

create or replace function public.notify_appointment_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare barber_user uuid;
begin
  insert into public.notifications(user_id,type,title,body,data)
  values(new.client_id,'appointment_created','Reserva confirmada','Tu cita para '||new.service_name_snapshot||' quedó registrada.',jsonb_build_object('appointment_id',new.id));
  select user_id into barber_user from public.barber_profiles where id=new.barber_id and active;
  if barber_user is not null then
    insert into public.notifications(user_id,type,title,body,data)
    values(barber_user,'appointment_created','Nueva cita asignada',new.service_name_snapshot||' fue añadida a tu agenda.',jsonb_build_object('appointment_id',new.id));
  end if;
  return new;
end; $$;

drop trigger if exists appointments_notify_created on public.appointments;
create trigger appointments_notify_created after insert on public.appointments for each row execute procedure public.notify_appointment_created();

create or replace function public.notify_product_reserved()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id,type,title,body,data)
  values(new.client_id,'product_reserved','Producto apartado','Tu apartado vence en 24 horas.',jsonb_build_object('reservation_id',new.id));
  return new;
end; $$;
drop trigger if exists products_notify_reserved on public.product_reservations;
create trigger products_notify_reserved after insert on public.product_reservations for each row execute procedure public.notify_product_reserved();

create or replace function public.handle_emergency_closure()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.business_status='emergency_closed' and old.business_status is distinct from new.business_status then
    update public.appointments set status='needs_reschedule',emergency_reason=coalesce(new.status_message,'Cierre por emergencia'),updated_at=now()
    where starts_at>now() and status in ('requested','confirmed','pending_client_confirmation');
    insert into public.notifications(user_id,type,title,body,data)
    select distinct client_id,'appointment_rescheduled','Cierre por emergencia',coalesce(new.status_message,'El negocio se encuentra cerrado por emergencia. Te contactaremos para reprogramar.'),'{}'::jsonb
    from public.appointments where starts_at>now() and status='needs_reschedule';
    insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'emergency_closed','business_settings','true',jsonb_build_object('message',new.status_message));
  end if;
  return new;
end; $$;
drop trigger if exists business_emergency_closure on public.business_settings;
create trigger business_emergency_closure after update of business_status on public.business_settings for each row execute procedure public.handle_emergency_closure();
