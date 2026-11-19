-- El borrado de un cliente elimina sus datos y operaciones relacionadas en una
-- transacción. Los datos agregados del negocio quedan sin el vínculo del cliente.

alter table public.cash_shifts alter column opened_by drop not null;
alter table public.cash_movements alter column created_by drop not null;
alter table public.sales alter column created_by drop not null;
alter table public.payments alter column confirmed_by drop not null;
alter table public.receipts alter column issued_by drop not null;
alter table public.payouts alter column created_by drop not null;
alter table public.appointment_checkout_details alter column submitted_by drop not null;

alter function public.admin_delete_record(text, uuid) rename to admin_delete_record_non_client;
revoke all on function public.admin_delete_record_non_client(text, uuid) from public, anon, authenticated;

create function public.admin_delete_client_completely(target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.profiles%rowtype;
  appointment_ids uuid[] := array[]::uuid[];
  sale_ids uuid[] := array[]::uuid[];
  earning_ids uuid[] := array[]::uuid[];
  related_ids uuid[] := array[]::uuid[];
  payout_delta record;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acceso administrativo requerido' using errcode = '42501';
  end if;
  if target_id is null then raise exception 'El cliente seleccionado no es válido'; end if;

  select * into target_profile from public.profiles where id = target_id for update;
  if not found then raise exception 'El cliente ya no existe'; end if;
  if target_id = auth.uid() then raise exception 'No puedes eliminar tu propia cuenta'; end if;
  if exists (select 1 from public.user_roles where user_id = target_id and role <> 'client')
    or exists (select 1 from public.barber_profiles where user_id = target_id)
    or exists (select 1 from public.cashier_profiles where user_id = target_id) then
    raise exception 'Esta cuenta pertenece al personal. Administra primero sus accesos desde el equipo';
  end if;

  select coalesce(array_agg(id), array[]::uuid[]) into appointment_ids
  from public.appointments where client_id = target_id;

  select coalesce(array_agg(id), array[]::uuid[]) into sale_ids
  from public.sales
  where client_id = target_id or appointment_id = any(appointment_ids);

  select coalesce(array_agg(be.id), array[]::uuid[]) into earning_ids
  from public.barber_earnings be
  join public.sale_items si on si.id = be.sale_item_id
  where si.sale_id = any(sale_ids);

  related_ids := appointment_ids || sale_ids;

  -- Libera apartados y quita los registros de citas, ventas, puntos y canjes.
  -- Las reservas no descuentan stock: la disponibilidad se calcula desde las
  -- reservas vigentes, por lo que al borrarlas queda disponible automáticamente.
  update public.rewards r
  set usage_count = greatest(0, r.usage_count - used.total)
  from (
    select reward_id, count(*)::integer as total
    from public.reward_redemptions
    where status = 'used' and (user_id = target_id or sale_id = any(sale_ids))
    group by reward_id
  ) used
  where r.id = used.reward_id;

  update public.promotions p
  set usage_count = greatest(0, p.usage_count - used.total)
  from (
    select source_id as promotion_id, count(*)::integer as total
    from public.discount_applications
    where sale_id = any(sale_ids) and source_type = 'promotion' and source_id is not null
    group by source_id
  ) used
  where p.id = used.promotion_id;

  -- Ajusta los totales de liquidaciones y elimina sus líneas vinculadas a estas ventas.
  for payout_delta in
    select pi.payout_id,
      coalesce(sum(pi.amount) filter (where be.kind = 'service_commission'), 0) as commission_amount,
      coalesce(sum(pi.amount) filter (where be.kind = 'product_incentive'), 0) as incentive_amount,
      coalesce(sum(pi.amount), 0) as total_amount
    from public.payout_items pi
    join public.barber_earnings be on be.id = pi.earning_id
    where be.id = any(earning_ids)
    group by pi.payout_id
  loop
    update public.payouts
    set commission_amount = commission_amount - payout_delta.commission_amount,
        incentive_amount = incentive_amount - payout_delta.incentive_amount,
        total_amount = total_amount - payout_delta.total_amount
    where id = payout_delta.payout_id;
  end loop;
  delete from public.payout_items where earning_id = any(earning_ids);
  delete from public.barber_earnings where id = any(earning_ids);

  delete from public.notifications
  where user_id = target_id
    or notifications.data::text like '%' || target_id::text || '%'
    or exists (
      select 1 from unnest(appointment_ids) as ids(id)
      where notifications.data ->> 'appointment_id' = ids.id::text
    )
    or exists (
      select 1 from unnest(sale_ids) as ids(id)
      where notifications.data ->> 'sale_id' = ids.id::text
    );
  delete from public.web_events
  where user_id = target_id
    or web_events.data::text like '%' || target_id::text || '%'
    or exists (
      select 1 from unnest(related_ids) as ids(id)
      where web_events.data::text like '%' || ids.id::text || '%'
    );
  delete from public.audit_logs
  where actor_id = target_id
    or entity_id = target_id::text
    or data::text like '%' || target_id::text || '%'
    or position(lower(target_profile.email) in lower(data::text)) > 0
    or exists (
      select 1 from unnest(related_ids) as ids(id)
      where audit_logs.entity_id = ids.id::text
        or audit_logs.data::text like '%' || ids.id::text || '%'
    );

  -- Elimina las conversaciones personales del cliente y sus mensajes en otras conversaciones.
  delete from public.conversations c
  where c.created_by = target_id
    or exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = target_id
    );
  delete from public.messages where sender_id = target_id;

  delete from public.referrals
  where referrer_id = target_id or referred_id = target_id or first_sale_id = any(sale_ids);
  delete from public.reward_redemptions
  where user_id = target_id or sale_id = any(sale_ids);
  update public.loyalty_transactions
  set source_type = null,
      source_id = null,
      idempotency_key = 'deleted-source:' || gen_random_uuid()::text
  where user_id <> target_id and source_id = any(related_ids);
  delete from public.loyalty_transactions where user_id = target_id;
  delete from public.discount_applications where sale_id = any(sale_ids);
  delete from public.cash_movements where sale_id = any(sale_ids);
  delete from public.payments where sale_id = any(sale_ids);
  delete from public.receipts where sale_id = any(sale_ids);

  -- Borra relaciones opcionales de autoría antes de eliminar la cuenta.
  update public.profiles set blocked_by = null where blocked_by = target_id;
  update public.cash_shifts set opened_by = null where opened_by = target_id;
  update public.cash_shifts set closed_by = null where closed_by = target_id;
  update public.cash_movements set created_by = null where created_by = target_id;
  update public.sales set created_by = null where created_by = target_id;
  update public.sales set reversed_by = null where reversed_by = target_id;
  update public.sales set referral_code = null
  where target_profile.referral_code is not null
    and lower(referral_code) = lower(target_profile.referral_code);
  update public.payments set confirmed_by = null where confirmed_by = target_id;
  update public.receipts set issued_by = null where issued_by = target_id;
  update public.payouts set created_by = null where created_by = target_id;
  update public.appointment_checkout_details set submitted_by = null where submitted_by = target_id;
  update public.schedule_exceptions set created_by = null where created_by = target_id;
  update public.promotions set created_by = null where created_by = target_id;
  update public.barber_expenses set reviewed_by = null where reviewed_by = target_id;
  update public.loyalty_transactions set created_by = null where created_by = target_id;
  update public.gallery_posts set created_by = null where created_by = target_id;

  -- No debe quedar una invitación que reactive roles asociados a este correo
  -- ni una referencia de invitación a la cuenta eliminada.
  delete from public.pending_barbers
  where lower(email) = lower(target_profile.email) or invited_by = target_id;
  delete from public.pending_cashiers
  where lower(email) = lower(target_profile.email) or invited_by = target_id;
  delete from public.pending_admins
  where lower(email) = lower(target_profile.email) or invited_by = target_id;

  delete from public.product_reservations where client_id = target_id;
  delete from public.sales where id = any(sale_ids);
  delete from public.appointments where id = any(appointment_ids);

  -- auth.users elimina la sesión, las identidades y los datos personales que
  -- dependen del perfil, incluidos roles, preferencias y cuentas de puntos.
  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.admin_delete_client_completely(uuid) from public, anon, authenticated;

create function public.admin_delete_record(entity_type text, target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acceso administrativo requerido' using errcode = '42501';
  end if;

  if entity_type = 'clients' then
    perform public.admin_delete_client_completely(target_id);
    return;
  end if;

  perform public.admin_delete_record_non_client(entity_type, target_id);
end;
$$;

revoke all on function public.admin_delete_record(text, uuid) from public, anon;
grant execute on function public.admin_delete_record(text, uuid) to authenticated;
