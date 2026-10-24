-- Permite configurar una pausa de mediodía con turnos independientes.
alter table public.business_hours
  add column if not exists afternoon_opens_at time,
  add column if not exists afternoon_closes_at time;

alter table public.business_hours
  drop constraint if exists business_hours_afternoon_window_check;

alter table public.business_hours
  add constraint business_hours_afternoon_window_check
  check (
    (afternoon_opens_at is null and afternoon_closes_at is null)
    or (
      afternoon_opens_at is not null
      and afternoon_closes_at is not null
      and afternoon_opens_at > closes_at
      and afternoon_opens_at < afternoon_closes_at
    )
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
  business_windows as (
    select weekday, opens_at, closes_at
    from public.business_hours
    where weekday = extract(dow from p_date)::integer and active
    union all
    select weekday, afternoon_opens_at, afternoon_closes_at
    from public.business_hours
    where weekday = extract(dow from p_date)::integer
      and active
      and afternoon_opens_at is not null
      and afternoon_closes_at is not null
  ),
  working_windows as (
    select
      barber.id as barber_id,
      service.duration_minutes,
      (p_date + greatest(schedule.starts_at, business_window.opens_at)) at time zone business.timezone as window_start,
      (p_date + least(schedule.ends_at, business_window.closes_at)) at time zone business.timezone as window_end
    from eligible_barbers barber
    cross join selected_service service
    join public.schedules schedule on schedule.barber_id = barber.id
    cross join public.business_settings business
    join business_windows business_window on true
    where schedule.active
      and business.id
      and business.business_status in ('open', 'appointment_only')
      and schedule.weekday = extract(dow from p_date)::integer
      and greatest(schedule.starts_at, business_window.opens_at) < least(schedule.ends_at, business_window.closes_at)
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
      select 1 from public.schedule_exceptions exception
      where (exception.barber_id is null or exception.barber_id = candidate.barber_id)
        and tstzrange(exception.starts_at, exception.ends_at, '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
    and not exists (
      select 1 from public.appointments appointment
      where appointment.barber_id = candidate.barber_id
        and appointment.status in ('requested', 'confirmed', 'in_progress', 'pending_client_confirmation')
        and tstzrange(appointment.starts_at, appointment.ends_at + interval '5 minutes', '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end + interval '5 minutes', '[)')
    )
  order by candidate.slot_start;
$$;

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
  select timezone into business_timezone
  from public.business_settings
  where id;

  local_start := new.starts_at at time zone coalesce(business_timezone, 'America/La_Paz');
  local_end := new.ends_at at time zone coalesce(business_timezone, 'America/La_Paz');

  if local_start::date <> local_end::date
    or local_start >= local_end
    or not exists (
    select 1
    from public.business_hours hours
    where hours.weekday = extract(dow from local_start)::integer
      and hours.active
      and (
        (local_start::time >= hours.opens_at and local_end::time <= hours.closes_at)
        or (
          hours.afternoon_opens_at is not null
          and local_start::time >= hours.afternoon_opens_at
          and local_end::time <= hours.afternoon_closes_at
        )
      )
  ) then
    raise exception 'La cita está fuera del horario de atención del negocio.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
