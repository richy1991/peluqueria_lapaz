-- La bandeja del cliente guarda novedades de interés, no recibos de sus propias acciones.

create or replace function public.notify_appointment_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  barber_user uuid;
  notification_kind text;
  notification_key text;
begin
  notification_kind := case when tg_op = 'INSERT' then 'appointment' else 'appointment_update' end;
  notification_key := 'appointment:' || new.id::text || ':' || new.status || ':' || new.starts_at::text;

  -- Solo avisar al cliente si la cita fue creada por otra persona; la que reserva
  -- el propio cliente queda registrada en su historial.
  if tg_op = 'INSERT'
     and new.client_id is not null
     and new.client_id is distinct from auth.uid() then
    perform public.create_user_notification(
      new.client_id,
      notification_kind,
      'Nueva cita registrada',
      new.service_name_snapshot || ' · ' || to_char(new.starts_at at time zone 'America/La_Paz', 'DD/MM HH24:MI'),
      jsonb_build_object('dedupe_key', notification_key, 'appointment_id', new.id)
    );
  end if;

  select bp.user_id into barber_user
  from public.barber_profiles bp
  where bp.id = new.barber_id;

  if barber_user is not null then
    perform public.create_user_notification(
      barber_user,
      notification_kind,
      case when tg_op = 'INSERT' then 'Nueva cita asignada' else 'Cita actualizada' end,
      coalesce(new.client_name_snapshot, 'Cliente') || ' · ' || new.service_name_snapshot || ' · ' || to_char(new.starts_at at time zone 'America/La_Paz', 'DD/MM HH24:MI'),
      jsonb_build_object('dedupe_key', notification_key, 'appointment_id', new.id)
    );
  end if;

  return new;
end;
$$;

-- El trigger anterior notificaba al cliente que acababa de reservar y duplicaba
-- el aviso que ahora reciben los peluqueros desde appointments_notify_users.
drop trigger if exists appointments_notify_created on public.appointments;

-- Apartar un producto queda reflejado en el carrito y el historial.
drop trigger if exists products_notify_reserved on public.product_reservations;

-- Cancelar una cita propia tampoco genera un aviso para la misma persona.
create or replace function public.cancel_own_appointment(target_appointment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  appt public.appointments%rowtype;
begin
  select * into appt
  from public.appointments
  where id = target_appointment_id and client_id = auth.uid()
  for update;

  if not found then raise exception 'Cita no encontrada'; end if;
  if appt.status not in ('requested', 'confirmed', 'pending_client_confirmation') then
    raise exception 'Esta cita ya no puede cancelarse';
  end if;
  if appt.starts_at < now() + interval '2 hours' then
    raise exception 'Las cancelaciones con menos de 2 horas se gestionan directamente con el negocio';
  end if;

  update public.appointments set status = 'canceled', updated_at = now() where id = appt.id;
end;
$$;

-- Canjear o devolver puntos desde la propia cuenta se registra en el historial;
-- las acumulaciones y ajustes hechos por el equipo siguen notificándose.
create or replace function public.notify_loyalty_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.created_by is distinct from new.user_id or new.kind not in ('redeem', 'reverse') then
    perform public.create_user_notification(
      new.user_id,
      case when new.kind = 'redeem' then 'reward' else 'points' end,
      case when new.kind = 'redeem' then 'Canje registrado' else 'Puntos actualizados' end,
      new.reason || ' · ' || case when new.points > 0 then '+' else '' end || new.points || ' puntos',
      jsonb_build_object('dedupe_key', 'loyalty:' || new.id::text, 'transaction_id', new.id)
    );
  end if;
  return new;
end;
$$;

-- Limpia avisos históricos de acciones del cliente. Los avisos de cancelación
-- hechos por el negocio y los cambios relevantes de puntos se conservan.
delete from public.notifications n
using public.user_roles r
where r.user_id = n.user_id
  and r.role = 'client'
  and (
    n.type in ('appointment', 'appointment_created', 'appointment_update', 'product_reserved')
    or (
      n.type = 'appointment_canceled'
      and n.title = 'Cita cancelada'
      and n.body = 'Tu horario fue liberado correctamente.'
    )
    or (
      n.type in ('points', 'reward')
      and exists (
        select 1
        from public.loyalty_transactions lt
        where lt.id::text = n.data ->> 'transaction_id'
          and lt.user_id = n.user_id
          and lt.created_by = lt.user_id
          and lt.kind in ('redeem', 'reverse')
      )
    )
  );
