-- Ejecutar en Supabase local o una base desechable con todas las migraciones:
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/business_hours_shifts.sql
-- La transaccion revierte los fixtures y la configuracion del negocio.
begin;

create function pg_temp.expect_hours_error(statement text, expected_state text)
returns void language plpgsql as $$
declare rejected boolean := false;
begin
  begin
    execute statement;
  exception when others then
    rejected := true;
    assert sqlstate = expected_state, 'Error inesperado: ' || sqlerrm;
  end;
  assert rejected, 'Se acepto una operacion que debia rechazarse: ' || statement;
end;
$$;

create function pg_temp.check_hours_appointment(
  client uuid, barber uuid, service uuid,
  starts_at timestamptz, ends_at timestamptz, should_accept boolean
)
returns uuid language plpgsql as $$
declare
  appointment uuid;
  rejected boolean := false;
begin
  begin
    insert into public.appointments (
      client_id, barber_id, service_id, starts_at, ends_at, blocked_until,
      duration_snapshot, price_snapshot, service_name_snapshot, status
    ) values (
      client, barber, service, starts_at, ends_at, ends_at + interval '5 minutes',
      30, 50, 'Prueba de turnos', 'canceled'
    ) returning id into appointment;
  exception when raise_exception then
    rejected := true;
    assert position('fuera del horario' in sqlerrm) > 0, 'Error inesperado: ' || sqlerrm;
  end;
  assert rejected <> should_accept, 'Resultado inesperado para la cita: ' || starts_at || ' - ' || ends_at;
  return appointment;
end;
$$;

do $$
declare
  client uuid := gen_random_uuid();
  barber uuid := gen_random_uuid();
  service uuid := gen_random_uuid();
  appointment uuid;
  business_timezone text := 'America/La_Paz';
  test_date date := (now() at time zone business_timezone)::date + 7;
  test_weekday smallint := extract(dow from test_date)::smallint;
  invalid_start time;
  invalid_end time;
  slots timestamptz[];
begin
  perform set_config('request.jwt.claim.sub', '', true);
  insert into auth.users (id, email, raw_user_meta_data)
    values (client, client::text || '@hours-test.invalid', '{"full_name":"Cliente prueba de turnos"}');
  insert into public.barber_profiles (id, display_name, slug)
    values (barber, 'Peluquero prueba de turnos', barber::text);
  insert into public.services (id, name, slug, price, duration_minutes)
    values (service, 'Servicio prueba de turnos', service::text, 50, 30);
  insert into public.barber_services (barber_id, service_id) values (barber, service);
  insert into public.schedules (barber_id, weekday, starts_at, ends_at)
    values (barber, test_weekday, '08:00', '21:00');
  insert into public.business_settings (id, timezone, business_status)
    values (true, business_timezone, 'open')
    on conflict (id) do update set timezone = excluded.timezone, business_status = excluded.business_status;
  insert into public.business_hours (weekday, opens_at, closes_at, afternoon_opens_at, afternoon_closes_at, active)
    values (test_weekday, '09:00', '13:00', '14:00', '20:00', true)
    on conflict (weekday) do update set
      opens_at = excluded.opens_at, closes_at = excluded.closes_at,
      afternoon_opens_at = excluded.afternoon_opens_at, afternoon_closes_at = excluded.afternoon_closes_at,
      active = excluded.active;
  -- Aislar el dia probado de cierres globales existentes; rollback los restaura.
  delete from public.schedule_exceptions
    where barber_id is null
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(
        test_date::timestamp at time zone business_timezone,
        (test_date + 1)::timestamp at time zone business_timezone, '[)');

  -- La base rechaza campos incompletos, solapamientos y turnos invertidos/vacios.
  for invalid_start, invalid_end in
    select * from (values
      ('14:00'::time, null::time), (null::time, '20:00'::time),
      ('12:30'::time, '20:00'::time), ('13:00'::time, '20:00'::time),
      ('20:00'::time, '14:00'::time), ('14:00'::time, '14:00'::time)
    ) invalid(opening, closing)
  loop
    perform pg_temp.expect_hours_error(format(
      'update public.business_hours set afternoon_opens_at = %L::time, afternoon_closes_at = %L::time where weekday = %s',
      invalid_start, invalid_end, test_weekday
    ), '23514');
  end loop;
  perform pg_temp.expect_hours_error(format(
    'update public.business_hours set opens_at = %L::time where weekday = %s', '13:00', test_weekday
  ), '23514');

  select array_agg(starts_at order by starts_at) into slots
    from public.get_available_slots(service::text, barber::text, test_date);
  assert cardinality(slots) = 38, 'Deben ofrecerse 15 horas de inicio en la manana y 23 en la tarde';
  assert (test_date + time '09:00') at time zone business_timezone = any(slots);
  assert (test_date + time '12:30') at time zone business_timezone = any(slots);
  assert (test_date + time '14:00') at time zone business_timezone = any(slots);
  assert (test_date + time '19:30') at time zone business_timezone = any(slots);
  assert not exists (
    select 1 from unnest(slots) as offered(starts_at)
    where (offered.starts_at at time zone business_timezone)::time > time '12:30'
      and (offered.starts_at at time zone business_timezone)::time < time '14:00'
  ), 'No deben ofrecerse citas durante el almuerzo ni citas que invadan el descanso';

  -- La disponibilidad sigue respetando el horario individual del peluquero.
  update public.schedules set starts_at = '10:00', ends_at = '18:00' where barber_id = barber;
  assert (select count(*) = 26 from public.get_available_slots(service::text, barber::text, test_date));
  update public.schedules set starts_at = '08:00', ends_at = '21:00' where barber_id = barber;

  -- La pausa es configurable, incluyendo minutos distintos de la hora en punto.
  update public.business_hours set closes_at = '12:15', afternoon_opens_at = '13:45' where weekday = test_weekday;
  select array_agg(starts_at order by starts_at) into slots
    from public.get_available_slots(service::text, barber::text, test_date);
  assert cardinality(slots) = 36;
  assert (test_date + time '11:45') at time zone business_timezone = any(slots);
  assert not ((test_date + time '12:00') at time zone business_timezone = any(slots));
  assert (test_date + time '13:45') at time zone business_timezone = any(slots);

  -- Los horarios anteriores de un solo turno siguen funcionando sin modificarse.
  update public.business_hours set closes_at = '20:00', afternoon_opens_at = null, afternoon_closes_at = null
    where weekday = test_weekday;
  select array_agg(starts_at order by starts_at) into slots
    from public.get_available_slots(service::text, barber::text, test_date);
  assert cardinality(slots) = 43;
  assert (test_date + time '13:00') at time zone business_timezone = any(slots);
  update public.business_hours set closes_at = '13:00', afternoon_opens_at = '14:00', afternoon_closes_at = '20:00'
    where weekday = test_weekday;

  -- Insertar directamente tampoco permite saltarse el descanso del negocio.
  appointment := pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '09:00') at time zone business_timezone,
    (test_date + time '09:30') at time zone business_timezone, true);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '12:30') at time zone business_timezone,
    (test_date + time '13:00') at time zone business_timezone, true);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '14:00') at time zone business_timezone,
    (test_date + time '14:30') at time zone business_timezone, true);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '19:30') at time zone business_timezone,
    (test_date + time '20:00') at time zone business_timezone, true);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '13:00') at time zone business_timezone,
    (test_date + time '13:30') at time zone business_timezone, false);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '12:45') at time zone business_timezone,
    (test_date + time '13:15') at time zone business_timezone, false);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '12:30') at time zone business_timezone,
    (test_date + time '14:30') at time zone business_timezone, false);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '08:30') at time zone business_timezone,
    (test_date + time '09:00') at time zone business_timezone, false);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '19:45') at time zone business_timezone,
    (test_date + time '20:15') at time zone business_timezone, false);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '10:00') at time zone business_timezone,
    (test_date + 1 + time '10:30') at time zone business_timezone, false);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '10:30') at time zone business_timezone,
    (test_date + time '10:00') at time zone business_timezone, false);
  perform pg_temp.expect_hours_error(format(
    'update public.appointments set starts_at = %L::timestamptz, ends_at = %L::timestamptz, blocked_until = %L::timestamptz where id = %L::uuid',
    (test_date + time '13:00') at time zone business_timezone,
    (test_date + time '13:30') at time zone business_timezone,
    (test_date + time '13:35') at time zone business_timezone, appointment
  ), 'P0001');

  update public.business_hours set active = false where weekday = test_weekday;
  assert not exists (select 1 from public.get_available_slots(service::text, barber::text, test_date));
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '09:00') at time zone business_timezone,
    (test_date + time '09:30') at time zone business_timezone, false);
  perform pg_temp.check_hours_appointment(client, barber, service,
    (test_date + time '14:00') at time zone business_timezone,
    (test_date + time '14:30') at time zone business_timezone, false);
end;
$$;

rollback;
