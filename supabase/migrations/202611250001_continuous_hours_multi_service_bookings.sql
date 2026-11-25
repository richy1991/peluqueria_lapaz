-- Unifica los horarios del local y permite reservar varios servicios como una cita.
alter table public.business_hours
  drop constraint if exists business_hours_afternoon_window_check;

update public.business_hours
set closes_at = case
      when afternoon_opens_at is not null and afternoon_closes_at is not null then afternoon_closes_at
      else closes_at
    end,
    afternoon_opens_at = null,
    afternoon_closes_at = null;

alter table public.business_hours
  add constraint business_hours_afternoon_window_check
  check (afternoon_opens_at is null and afternoon_closes_at is null);

create table if not exists public.appointment_service_items (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  position integer not null check (position > 0),
  name_snapshot text not null,
  price_snapshot numeric(10,2) not null check (price_snapshot >= 0),
  duration_snapshot integer not null check (duration_snapshot between 5 and 480),
  primary key (appointment_id, position),
  unique (appointment_id, service_id)
);

alter table public.appointment_service_items enable row level security;
grant select on public.appointment_service_items to authenticated;

drop policy if exists "Clients and staff can read appointment services" on public.appointment_service_items;
create policy "Clients and staff can read appointment services"
on public.appointment_service_items for select to authenticated
using (
  public.is_admin()
  or public.is_cashier()
  or exists (
    select 1
    from public.appointments appointment
    where appointment.id = appointment_service_items.appointment_id
      and (
        appointment.client_id = auth.uid()
        or exists (
          select 1 from public.barber_profiles barber
          where barber.id = appointment.barber_id
            and barber.user_id = auth.uid()
            and barber.active
        )
      )
  )
);

insert into public.appointment_service_items(
  appointment_id, service_id, position, name_snapshot, price_snapshot, duration_snapshot
)
select appointment.id, appointment.service_id, 1, appointment.service_name_snapshot,
       appointment.price_snapshot, appointment.duration_snapshot
from public.appointments appointment
on conflict (appointment_id, position) do nothing;

create or replace function public.get_booking_slots_for_services(
  p_service_slugs text[],
  p_barber_slug text,
  p_date date
)
returns table (starts_at timestamptz, is_available boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with requested_services as (
    select input.slug, min(input.position) as position
    from unnest(coalesce(p_service_slugs, array[]::text[])) with ordinality as input(slug, position)
    where nullif(btrim(input.slug), '') is not null
    group by input.slug
  ),
  selected_services as (
    select service.id, service.duration_minutes
    from requested_services requested
    join public.services service on service.slug = requested.slug and service.status = 'active'
  ),
  service_summary as (
    select count(*) as service_count, coalesce(sum(duration_minutes), 0) as duration_minutes
    from selected_services
  ),
  request_summary as (
    select count(*) as service_count from requested_services
  ),
  eligible_barbers as (
    select barber.id
    from public.barber_profiles barber
    join public.barber_services assigned on assigned.barber_id = barber.id
    join selected_services service on service.id = assigned.service_id
    cross join service_summary summary
    cross join request_summary requested
    where barber.active
      and (p_barber_slug is null or p_barber_slug = 'any' or barber.slug = p_barber_slug)
      and summary.service_count > 0
      and summary.service_count = requested.service_count
    group by barber.id, summary.service_count
    having count(distinct assigned.service_id) = summary.service_count
  ),
  working_windows as (
    select
      barber.id as barber_id,
      summary.duration_minutes,
      (p_date + greatest(schedule.starts_at, hours.opens_at))
        at time zone coalesce(nullif(business.timezone, ''), 'America/La_Paz') as window_start,
      (p_date + least(schedule.ends_at, hours.closes_at))
        at time zone coalesce(nullif(business.timezone, ''), 'America/La_Paz') as window_end
    from eligible_barbers barber
    cross join service_summary summary
    join public.schedules schedule on schedule.barber_id = barber.id
    cross join public.business_settings business
    join public.business_hours hours on hours.weekday = extract(dow from p_date)::integer
    where schedule.active
      and hours.active
      and business.id
      and business.business_status in ('open', 'appointment_only')
      and schedule.weekday = extract(dow from p_date)::integer
      and greatest(schedule.starts_at, hours.opens_at) < least(schedule.ends_at, hours.closes_at)
  ),
  candidate_slots as (
    select
      work_window.barber_id,
      slot as slot_start,
      slot + make_interval(mins => work_window.duration_minutes::integer) as slot_end
    from working_windows work_window
    cross join lateral generate_series(
      work_window.window_start,
      work_window.window_end - make_interval(mins => work_window.duration_minutes::integer),
      interval '15 minutes'
    ) slot
    where work_window.duration_minutes > 0
  )
  select candidate.slot_start,
    bool_or(
      not exists (
        select 1 from public.schedule_exceptions exception
        where (exception.barber_id is null or exception.barber_id = candidate.barber_id)
          and tstzrange(exception.starts_at, exception.ends_at, '[)')
            && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
      )
      and not exists (
        select 1 from public.appointments appointment
        where appointment.barber_id = candidate.barber_id
          and appointment.status in ('requested', 'confirmed', 'in_progress', 'pending_client_confirmation')
          and tstzrange(appointment.starts_at, appointment.blocked_until, '[)')
            && tstzrange(candidate.slot_start, candidate.slot_end + interval '5 minutes', '[)')
      )
    ) as is_available
  from candidate_slots candidate
  where candidate.slot_start >= now() + interval '30 minutes'
    and candidate.slot_start < now() + interval '90 days'
  group by candidate.slot_start
  order by candidate.slot_start;
$$;

revoke all on function public.get_booking_slots_for_services(text[], text, date) from public;
grant execute on function public.get_booking_slots_for_services(text[], text, date) to anon, authenticated;

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
  select slots.starts_at
  from public.get_booking_slots_for_services(array[p_service_slug], p_barber_slug, p_date) slots
  where slots.is_available
  order by slots.starts_at;
$$;

revoke all on function public.get_available_slots(text, text, date) from public;
grant execute on function public.get_available_slots(text, text, date) to anon, authenticated;

create or replace function public.enforce_business_hours_on_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_start timestamp;
  local_end timestamp;
  business_timezone text;
begin
  select coalesce(nullif(timezone, ''), 'America/La_Paz') into business_timezone
  from public.business_settings
  where id;

  local_start := new.starts_at at time zone coalesce(business_timezone, 'America/La_Paz');
  local_end := new.ends_at at time zone coalesce(business_timezone, 'America/La_Paz');

  if local_start::date <> local_end::date
    or local_start >= local_end
    or not exists (
      select 1 from public.business_hours hours
      where hours.weekday = extract(dow from local_start)::integer
        and hours.active
        and local_start::time >= hours.opens_at
        and local_end::time <= hours.closes_at
    ) then
    raise exception 'La cita está fuera del horario de atención del negocio.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.create_appointment_with_services(
  p_service_slugs text[],
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
  v_service_count integer;
  v_unique_service_count integer;
  v_duration integer;
  v_price numeric(10,2);
  v_service_name text;
  v_service_ids uuid[];
  v_barber_id uuid;
  v_ends_at timestamptz;
  v_appointment_id uuid;
  v_local_start timestamp;
  v_local_end timestamp;
  v_business_timezone text;
begin
  if v_client_id is null then
    raise exception 'Debes iniciar sesión para reservar.' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_service_slugs, 1), 0) < 1 or array_length(p_service_slugs, 1) > 12 then
    raise exception 'Selecciona entre 1 y 12 servicios.' using errcode = 'P0001';
  end if;

  select count(*), count(distinct service.id), coalesce(sum(service.duration_minutes), 0),
         coalesce(sum(service.price), 0), string_agg(service.name, ' + ' order by requested.position),
         array_agg(service.id order by requested.position)
  into v_service_count, v_unique_service_count, v_duration, v_price, v_service_name, v_service_ids
  from unnest(p_service_slugs) with ordinality as requested(slug, position)
  join public.services service on service.slug = requested.slug and service.status = 'active';

  if v_service_count <> array_length(p_service_slugs, 1) then
    raise exception 'Uno de los servicios seleccionados ya no está disponible.' using errcode = 'P0001';
  end if;
  if v_unique_service_count <> v_service_count then
    raise exception 'No repitas un servicio en la misma reserva.' using errcode = 'P0001';
  end if;
  if v_duration > 480 then
    raise exception 'La duración total no puede superar 8 horas.' using errcode = 'P0001';
  end if;

  v_phone_normalized := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if length(v_phone_normalized) < 7 or length(v_phone_normalized) > 15 then
    raise exception 'Ingresa un teléfono válido.' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.profiles
    where phone_normalized = v_phone_normalized and status = 'active' and id <> v_client_id
  ) >= 3 then
    raise exception 'Este teléfono ya está asociado a varias cuentas.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.profiles
    where id = v_client_id and (status <> 'active' or is_blocked)
  ) then
    raise exception 'Tu cuenta no puede crear reservas. Contacta al negocio.' using errcode = 'P0001';
  end if;

  select coalesce(nullif(timezone, ''), 'America/La_Paz') into v_business_timezone
  from public.business_settings where id;
  if not exists (
    select 1 from public.business_settings
    where id and business_status in ('open', 'appointment_only')
  ) then
    raise exception 'El negocio no está recibiendo reservas en este momento.' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.appointments
    where client_id = v_client_id and starts_at > now()
      and status in ('requested', 'confirmed', 'pending_client_confirmation')
  ) >= 2 then
    raise exception 'Ya tienes el máximo de citas futuras permitidas.' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.appointments
    where client_id = v_client_id and created_at >= date_trunc('day', now())
  ) >= 3 then
    raise exception 'Alcanzaste el límite diario de reservas.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.appointments
    where client_id = v_client_id and created_at > now() - interval '30 seconds'
  ) then
    raise exception 'Espera unos segundos antes de crear otra reserva.' using errcode = 'P0001';
  end if;

  if p_starts_at < now() + interval '30 minutes' or p_starts_at > now() + interval '90 days' then
    raise exception 'El horario está fuera del período permitido.' using errcode = 'P0001';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);
  v_local_start := p_starts_at at time zone coalesce(v_business_timezone, 'America/La_Paz');
  v_local_end := v_ends_at at time zone coalesce(v_business_timezone, 'America/La_Paz');

  select barber.id into v_barber_id
  from public.barber_profiles barber
  where barber.active
    and (p_barber_slug is null or p_barber_slug = 'any' or barber.slug = p_barber_slug)
    and (
      select count(distinct assigned.service_id)
      from public.barber_services assigned
      where assigned.barber_id = barber.id and assigned.service_id = any(v_service_ids)
    ) = v_service_count
    and exists (
      select 1 from public.schedules schedule
      where schedule.barber_id = barber.id
        and schedule.active
        and schedule.weekday = extract(dow from v_local_start)::integer
        and v_local_start::time >= schedule.starts_at
        and v_local_end::time <= schedule.ends_at
    )
    and exists (
      select 1 from public.business_hours hours
      where hours.weekday = extract(dow from v_local_start)::integer
        and hours.active
        and v_local_start::time >= hours.opens_at
        and v_local_end::time <= hours.closes_at
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
        and tstzrange(appointment.starts_at, appointment.blocked_until, '[)')
          && tstzrange(p_starts_at, v_ends_at + interval '5 minutes', '[)')
    )
  order by barber.display_name
  limit 1;

  if v_barber_id is null then
    raise exception 'Ese horario no tiene espacio para todos los servicios. Elige otro peluquero u horario.' using errcode = 'P0001';
  end if;

  update public.profiles
  set phone = p_phone, phone_normalized = v_phone_normalized,
      phone_confirmed_at = now(), updated_at = now()
  where id = v_client_id;

  insert into public.appointments (
    client_id, barber_id, service_id, starts_at, ends_at, blocked_until,
    duration_snapshot, price_snapshot, service_name_snapshot, status
  ) values (
    v_client_id, v_barber_id, v_service_ids[1], p_starts_at, v_ends_at, v_ends_at + interval '5 minutes',
    v_duration, v_price, v_service_name, 'confirmed'
  ) returning id into v_appointment_id;

  insert into public.appointment_service_items(
    appointment_id, service_id, position, name_snapshot, price_snapshot, duration_snapshot
  )
  select v_appointment_id, service.id, requested.position::integer,
         service.name, service.price, service.duration_minutes
  from unnest(p_service_slugs) with ordinality as requested(slug, position)
  join public.services service on service.slug = requested.slug and service.status = 'active';

  return v_appointment_id;
exception
  when exclusion_violation then
    raise exception 'Ese horario acaba de ocuparse. Elige otro.' using errcode = 'P0001';
end;
$$;

revoke all on function public.create_appointment_with_services(text[], text, timestamptz, text) from public;
grant execute on function public.create_appointment_with_services(text[], text, timestamptz, text) to authenticated;

create or replace function public.create_appointment(
  p_service_slug text,
  p_barber_slug text,
  p_starts_at timestamptz,
  p_phone text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.create_appointment_with_services(array[p_service_slug], p_barber_slug, p_starts_at, p_phone);
$$;

revoke all on function public.create_appointment(text, text, timestamptz, text) from public;
grant execute on function public.create_appointment(text, text, timestamptz, text) to authenticated;
