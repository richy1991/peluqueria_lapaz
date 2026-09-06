-- Horario general del local. Es independiente del horario individual de cada peluquero.
create table if not exists public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  opens_at time not null default '09:00',
  closes_at time not null default '20:00',
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (opens_at < closes_at)
);

alter table public.business_hours enable row level security;

drop policy if exists "Public can read business hours" on public.business_hours;
create policy "Public can read business hours"
on public.business_hours for select
using (true);

drop policy if exists "Admins manage business hours" on public.business_hours;
create policy "Admins manage business hours"
on public.business_hours for all
using (public.is_admin())
with check (public.is_admin());

insert into public.business_hours (weekday, opens_at, closes_at, active)
values
  (0, '09:00', '20:00', true),
  (1, '09:00', '20:00', false),
  (2, '09:00', '20:00', true),
  (3, '09:00', '20:00', true),
  (4, '09:00', '20:00', true),
  (5, '09:00', '20:00', true),
  (6, '09:00', '20:00', true)
on conflict (weekday) do nothing;

-- Los turnos ofrecidos deben pertenecer tanto al horario del peluquero como al del local.
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
      (p_date + greatest(schedule.starts_at, business_hour.opens_at)) at time zone business.timezone as window_start,
      (p_date + least(schedule.ends_at, business_hour.closes_at)) at time zone business.timezone as window_end
    from eligible_barbers barber
    cross join selected_service service
    join public.schedules schedule on schedule.barber_id = barber.id
    cross join public.business_settings business
    join public.business_hours business_hour on business_hour.weekday = extract(dow from p_date)::integer
    where schedule.active
      and business_hour.active
      and business.id
      and business.business_status in ('open', 'appointment_only')
      and schedule.weekday = extract(dow from p_date)::integer
      and greatest(schedule.starts_at, business_hour.opens_at) < least(schedule.ends_at, business_hour.closes_at)
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

  if not exists (
    select 1
    from public.business_hours hours
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

drop trigger if exists appointments_respect_business_hours on public.appointments;
create trigger appointments_respect_business_hours
before insert or update of starts_at, ends_at on public.appointments
for each row execute function public.enforce_business_hours_on_appointment();

revoke all on function public.get_available_slots(text, text, date) from public;
grant execute on function public.get_available_slots(text, text, date) to anon, authenticated;
