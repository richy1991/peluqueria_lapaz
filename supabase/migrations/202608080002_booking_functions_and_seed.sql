-- Datos demostrativos y funciones transaccionales del flujo público de reservas.

alter table public.barber_profiles
  add column if not exists slug text unique;

insert into public.profiles (id, email, full_name, avatar_url)
select
  id,
  coalesce(email, ''),
  raw_user_meta_data ->> 'full_name',
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

insert into public.services (id, name, slug, description, category, price, duration_minutes, grace_minutes, status)
values
  ('10000000-0000-4000-8000-000000000001', 'Corte clásico', 'corte-clasico', 'Diagnóstico, corte personalizado y acabado con producto.', 'Corte', 50, 40, 10, 'active'),
  ('10000000-0000-4000-8000-000000000002', 'Corte + barba', 'corte-barba', 'Servicio completo con perfilado, toalla caliente y acabado.', 'Completo', 80, 60, 10, 'active'),
  ('10000000-0000-4000-8000-000000000003', 'Barba premium', 'barba-premium', 'Diseño de barba, afeitado de contornos y cuidado hidratante.', 'Barba', 40, 30, 10, 'active'),
  ('10000000-0000-4000-8000-000000000004', 'Corte infantil', 'corte-infantil', 'Atención paciente y cómoda para niños de hasta 12 años.', 'Infantil', 40, 35, 10, 'active')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  category = excluded.category,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  status = excluded.status;

insert into public.barber_profiles (id, slug, display_name, bio, specialties, active)
values
  ('20000000-0000-4000-8000-000000000001', 'mateo', 'Mateo Vargas', 'Barbero senior enfocado en técnica y detalle.', array['Fades', 'Cortes clásicos', 'Barba'], true),
  ('20000000-0000-4000-8000-000000000002', 'lucas', 'Lucas Rojas', 'Estilista especializado en tendencias y textura.', array['Texturas', 'Color', 'Estilos modernos'], true),
  ('20000000-0000-4000-8000-000000000003', 'sofia', 'Sofía Molina', 'Estilista senior y asesora de imagen.', array['Cortes largos', 'Color', 'Asesoría de imagen'], true)
on conflict (id) do update set
  slug = excluded.slug,
  display_name = excluded.display_name,
  bio = excluded.bio,
  specialties = excluded.specialties,
  active = excluded.active;

insert into public.barber_services (barber_id, service_id)
select barber.id, service.id
from public.barber_profiles barber
cross join public.services service
where barber.id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003'
)
and service.id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004'
)
on conflict do nothing;

insert into public.schedules (barber_id, weekday, starts_at, ends_at)
select barber_id, weekday, '09:00'::time, '20:00'::time
from (
  values
    ('20000000-0000-4000-8000-000000000001'::uuid),
    ('20000000-0000-4000-8000-000000000002'::uuid),
    ('20000000-0000-4000-8000-000000000003'::uuid)
) as barbers(barber_id)
cross join (values (0), (2), (3), (4), (5), (6)) as weekdays(weekday)
where not exists (
  select 1 from public.schedules existing
  where existing.barber_id = barbers.barber_id
    and existing.weekday = weekdays.weekday
    and existing.starts_at = '09:00'::time
    and existing.ends_at = '20:00'::time
);

create or replace function public.get_available_slots(
  p_service_slug text,
  p_barber_slug text,
  p_date date
)
returns table (starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with selected_service as (
    select id, duration_minutes
    from public.services
    where slug = p_service_slug and status = 'active'
  ),
  eligible_barbers as (
    select barber.id
    from public.barber_profiles barber
    join public.barber_services assigned on assigned.barber_id = barber.id
    join selected_service service on service.id = assigned.service_id
    where barber.active
      and (p_barber_slug is null or p_barber_slug = 'any' or barber.slug = p_barber_slug)
  ),
  working_windows as (
    select
      barber.id as barber_id,
      service.duration_minutes,
      (p_date + schedule.starts_at) at time zone 'America/La_Paz' as window_start,
      (p_date + schedule.ends_at) at time zone 'America/La_Paz' as window_end
    from eligible_barbers barber
    cross join selected_service service
    join public.schedules schedule on schedule.barber_id = barber.id
    cross join public.business_settings business
    where schedule.active
      and business.id
      and business.business_status in ('open', 'appointment_only')
      and schedule.weekday = extract(dow from p_date)::integer
  ),
  candidate_slots as (
    select
      work_window.barber_id,
      slot as slot_start,
      slot + make_interval(mins => work_window.duration_minutes) as slot_end
    from working_windows work_window
    cross join lateral generate_series(
      work_window.window_start,
      work_window.window_end - make_interval(mins => work_window.duration_minutes),
      interval '15 minutes'
    ) slot
  )
  select distinct candidate.slot_start
  from candidate_slots candidate
  where candidate.slot_start >= now() + interval '30 minutes'
    and candidate.slot_start < now() + interval '90 days'
    and not exists (
      select 1
      from public.schedule_exceptions exception
      where (exception.barber_id is null or exception.barber_id = candidate.barber_id)
        and tstzrange(exception.starts_at, exception.ends_at, '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
    and not exists (
      select 1
      from public.appointments appointment
      where appointment.barber_id = candidate.barber_id
        and appointment.status in ('requested', 'confirmed', 'in_progress', 'pending_client_confirmation')
        and tstzrange(appointment.starts_at, appointment.ends_at + interval '5 minutes', '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end + interval '5 minutes', '[)')
    )
  order by candidate.slot_start;
$$;

create or replace function public.create_appointment(
  p_service_slug text,
  p_barber_slug text,
  p_starts_at timestamptz,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := auth.uid();
  v_phone_normalized text;
  v_service public.services%rowtype;
  v_barber_id uuid;
  v_ends_at timestamptz;
  v_appointment_id uuid;
  v_local_start timestamp;
begin
  if v_client_id is null then
    raise exception 'Debes iniciar sesión para reservar.' using errcode = 'P0001';
  end if;

  select * into v_service
  from public.services
  where slug = p_service_slug and status = 'active';

  if not found then
    raise exception 'El servicio seleccionado no está disponible.' using errcode = 'P0001';
  end if;

  v_phone_normalized := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if length(v_phone_normalized) < 7 or length(v_phone_normalized) > 15 then
    raise exception 'Ingresa un teléfono válido.' using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.profiles
    where phone_normalized = v_phone_normalized
      and status = 'active'
      and id <> v_client_id
  ) >= 3 then
    raise exception 'Este teléfono ya está asociado a varias cuentas.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.profiles
    where id = v_client_id and (status <> 'active' or is_blocked)
  ) then
    raise exception 'Tu cuenta no puede crear reservas. Contacta al negocio.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.business_settings
    where id and business_status in ('open', 'appointment_only')
  ) then
    raise exception 'El negocio no está recibiendo reservas en este momento.' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.appointments
    where client_id = v_client_id
      and starts_at > now()
      and status in ('requested', 'confirmed', 'pending_client_confirmation')
  ) >= 2 then
    raise exception 'Ya tienes el máximo de citas futuras permitidas.' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.appointments
    where client_id = v_client_id
      and created_at >= date_trunc('day', now())
  ) >= 3 then
    raise exception 'Alcanzaste el límite diario de reservas.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.appointments
    where client_id = v_client_id
      and created_at > now() - interval '30 seconds'
  ) then
    raise exception 'Espera unos segundos antes de crear otra reserva.' using errcode = 'P0001';
  end if;

  if p_starts_at < now() + interval '30 minutes' or p_starts_at > now() + interval '90 days' then
    raise exception 'El horario está fuera del período permitido.' using errcode = 'P0001';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_local_start := p_starts_at at time zone 'America/La_Paz';

  select barber.id into v_barber_id
  from public.barber_profiles barber
  join public.barber_services assigned
    on assigned.barber_id = barber.id and assigned.service_id = v_service.id
  where barber.active
    and (p_barber_slug is null or p_barber_slug = 'any' or barber.slug = p_barber_slug)
    and exists (
      select 1 from public.schedules schedule
      where schedule.barber_id = barber.id
        and schedule.active
        and schedule.weekday = extract(dow from v_local_start)::integer
        and v_local_start::time >= schedule.starts_at
        and (v_local_start + make_interval(mins => v_service.duration_minutes))::time <= schedule.ends_at
    )
    and not exists (
      select 1 from public.schedule_exceptions exception
      where (exception.barber_id is null or exception.barber_id = barber.id)
        and tstzrange(exception.starts_at, exception.ends_at, '[)')
          && tstzrange(p_starts_at, v_ends_at, '[)')
    )
    and not exists (
      select 1 from public.appointments appointment
      where appointment.barber_id = barber.id
        and appointment.status in ('requested', 'confirmed', 'in_progress', 'pending_client_confirmation')
        and tstzrange(appointment.starts_at, appointment.ends_at + interval '5 minutes', '[)')
          && tstzrange(p_starts_at, v_ends_at + interval '5 minutes', '[)')
    )
  order by barber.display_name
  limit 1;

  if v_barber_id is null then
    raise exception 'Este horario ya no está disponible. Elige otro.' using errcode = 'P0001';
  end if;

  update public.profiles
  set phone = p_phone,
      phone_normalized = v_phone_normalized,
      phone_confirmed_at = now(),
      updated_at = now()
  where id = v_client_id;

  insert into public.appointments (
    client_id,
    barber_id,
    service_id,
    starts_at,
    ends_at,
    blocked_until,
    duration_snapshot,
    price_snapshot,
    service_name_snapshot,
    status
  ) values (
    v_client_id,
    v_barber_id,
    v_service.id,
    p_starts_at,
    v_ends_at,
    v_ends_at + interval '5 minutes',
    v_service.duration_minutes,
    v_service.price,
    v_service.name,
    'confirmed'
  ) returning id into v_appointment_id;

  return v_appointment_id;
exception
  when exclusion_violation then
    raise exception 'Este horario acaba de ocuparse. Elige otro.' using errcode = 'P0001';
end;
$$;

revoke all on function public.get_available_slots(text, text, date) from public;
grant execute on function public.get_available_slots(text, text, date) to anon, authenticated;

revoke all on function public.create_appointment(text, text, timestamptz, text) from public;
grant execute on function public.create_appointment(text, text, timestamptz, text) to authenticated;

revoke update on public.profiles from authenticated;
grant update (full_name, phone, phone_normalized, phone_confirmed_at, marketing_consent, updated_at)
  on public.profiles to authenticated;
