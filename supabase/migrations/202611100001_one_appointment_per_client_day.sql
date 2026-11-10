-- A client can keep at most one non-canceled appointment per local business day.
-- The per-client/day transaction lock closes the race between simultaneous bookings.
create or replace function public.enforce_one_appointment_per_client_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_timezone text;
  local_day date;
  day_start timestamptz;
  day_end timestamptz;
begin
  if new.client_id is null
    or new.status = 'canceled' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.client_id is not distinct from old.client_id
    and new.starts_at is not distinct from old.starts_at
    and old.status <> 'canceled' then
    return new;
  end if;

  select settings.timezone into business_timezone
  from public.business_settings as settings
  where settings.id;

  business_timezone := coalesce(nullif(business_timezone, ''), 'America/La_Paz');
  local_day := (new.starts_at at time zone business_timezone)::date;
  day_start := local_day::timestamp at time zone business_timezone;
  day_end := (local_day + 1)::timestamp at time zone business_timezone;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.client_id::text || ':appointment-day:' || local_day::text, 0)
  );

  if exists (
    select 1
    from public.appointments as existing
    where existing.client_id = new.client_id
      and existing.id is distinct from new.id
      and existing.status <> 'canceled'
      and existing.starts_at >= day_start
      and existing.starts_at < day_end
  ) then
    raise exception 'Ya tienes una cita para ese día. Solo puedes reservar una cita por día.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_one_per_client_day on public.appointments;
create trigger appointments_one_per_client_day
before insert or update of client_id, starts_at, status on public.appointments
for each row execute function public.enforce_one_appointment_per_client_day();

revoke all on function public.enforce_one_appointment_per_client_day() from public;

comment on function public.enforce_one_appointment_per_client_day() is
  'Prevents a client from booking more than one non-canceled appointment per local business day.';

-- Expose only appointment client details to the barber assigned to those appointments.
-- This avoids broad profile access through a nested PostgREST relation.
create or replace function public.get_barber_appointment_clients(target_appointment_ids uuid[])
returns table (
  appointment_id uuid,
  full_name text,
  phone text,
  is_blacklisted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select appointments.id, profiles.full_name, profiles.phone, profiles.is_blacklisted
  from public.appointments as appointments
  join public.barber_profiles as barbers on barbers.id = appointments.barber_id
  join public.profiles as profiles on profiles.id = appointments.client_id
  where appointments.id = any(coalesce(target_appointment_ids, array[]::uuid[]))
    and barbers.user_id = auth.uid()
    and barbers.active;
$$;

revoke all on function public.get_barber_appointment_clients(uuid[]) from public;
grant execute on function public.get_barber_appointment_clients(uuid[]) to authenticated;

comment on function public.get_barber_appointment_clients(uuid[]) is
  'Returns minimal client contact details for appointments assigned to the authenticated active barber.';
