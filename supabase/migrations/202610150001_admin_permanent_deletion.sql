-- Borrado fisico administrativo. Las ventas, comprobantes y liquidaciones
-- conservan importes y nombres historicos; las operaciones abiertas se resuelven
-- antes de borrar su cliente, producto, servicio o peluquero.

alter table public.appointments
  alter column client_id drop not null,
  alter column barber_id drop not null,
  alter column service_id drop not null,
  add column if not exists client_name_snapshot text,
  add column if not exists barber_name_snapshot text,
  add constraint appointments_deleted_relation_is_history check (
    (client_id is not null and barber_id is not null and service_id is not null)
    or status in ('completed', 'canceled', 'no_show')
  );

alter table public.product_reservations
  alter column client_id drop not null,
  alter column product_id drop not null,
  add column if not exists client_name_snapshot text,
  add column if not exists product_name_snapshot text,
  add constraint reservations_deleted_relation_is_history check (
    (client_id is not null and product_id is not null) or status <> 'reserved'
  );

alter table public.sale_items
  add column if not exists service_id_snapshot uuid,
  add column if not exists product_id_snapshot uuid,
  add column if not exists barber_id_snapshot uuid,
  add column if not exists barber_name_snapshot text,
  add column if not exists recommended_by_barber_name_snapshot text;
-- El check original exige referencias vivas incluso en ventas ya cobradas.
alter table public.sale_items drop constraint sale_items_kind_fields_check;
alter table public.sale_items add constraint sale_items_kind_fields_check check (
  (item_type = 'service' and coalesce(service_id, service_id_snapshot) is not null
    and coalesce(barber_id, barber_id_snapshot) is not null and coalesce(product_id, product_id_snapshot) is null)
  or (item_type = 'product' and coalesce(product_id, product_id_snapshot) is not null
    and coalesce(service_id, service_id_snapshot) is null)
  or (item_type = 'custom_charge' and coalesce(service_id, service_id_snapshot) is null
    and coalesce(product_id, product_id_snapshot) is null and coalesce(barber_id, barber_id_snapshot) is not null)
);

alter table public.barber_earnings
  alter column barber_id drop not null,
  add column if not exists barber_name_snapshot text;
alter table public.barber_expenses
  alter column barber_id drop not null,
  add column if not exists barber_name_snapshot text;
alter table public.payouts
  alter column barber_id drop not null,
  add column if not exists barber_name_snapshot text;
alter table public.loyalty_transactions add column if not exists barber_id_snapshot uuid;
alter table public.reward_redemptions
  alter column user_id drop not null,
  add column if not exists barber_id_snapshot uuid;

create or replace function public.admin_delete_record(entity_type text, target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.profiles%rowtype;
  target_barber public.barber_profiles%rowtype;
  record_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acceso administrativo requerido' using errcode = '42501';
  end if;
  if target_id is null or entity_type is null or entity_type not in ('clients', 'products', 'barbers', 'gallery', 'services') then
    raise exception 'El registro seleccionado no es valido';
  end if;

  case entity_type
  when 'clients' then
    select * into target_profile from public.profiles where id = target_id for update;
    if not found then raise exception 'El cliente ya no existe'; end if;
    if target_id = auth.uid() then raise exception 'No puedes eliminar tu propia cuenta'; end if;
    if exists (select 1 from public.user_roles where user_id = target_id and role <> 'client')
      or exists (select 1 from public.barber_profiles where user_id = target_id)
      or exists (select 1 from public.cashier_profiles where user_id = target_id) then
      raise exception 'Esta cuenta pertenece al personal. Administra primero sus accesos desde el equipo';
    end if;
    if exists (select 1 from public.appointments where client_id = target_id and status not in ('completed', 'canceled', 'no_show')) then
      raise exception 'Resuelve o cancela las citas pendientes del cliente antes de eliminarlo';
    end if;
    if exists (select 1 from public.product_reservations where client_id = target_id and status = 'reserved' and expires_at > now()) then
      raise exception 'Entrega o cancela los productos reservados del cliente antes de eliminarlo';
    end if;
    perform 1 from public.sales where client_id = target_id for update;
    if exists (select 1 from public.sales where client_id = target_id and status in ('draft', 'pending_payment')) then
      raise exception 'Resuelve las ventas pendientes del cliente antes de eliminarlo';
    end if;
    if exists (select 1 from public.reward_redemptions where user_id = target_id and status = 'pending') then
      raise exception 'Resuelve o cancela los canjes pendientes del cliente antes de eliminarlo';
    end if;

    record_name := coalesce(nullif(target_profile.full_name, ''), target_profile.email);
    update public.appointments set client_name_snapshot = coalesce(client_name_snapshot, record_name), client_id = null where client_id = target_id;
    update public.product_reservations
      set client_name_snapshot = coalesce(client_name_snapshot, record_name), client_id = null,
          status = case when status = 'reserved' then 'expired' else status end
      where client_id = target_id;
    update public.sales
      set guest_name = coalesce(nullif(guest_name, ''), record_name), client_id = null, claim_code = null
      where client_id = target_id;
    update public.reward_redemptions set user_id = null where user_id = target_id;
    delete from public.referrals where referrer_id = target_id or referred_id = target_id;
    delete from public.messages where sender_id = target_id;
    delete from public.conversations where created_by = target_id;
    update public.web_events set user_id = null where user_id = target_id;
    update public.audit_logs set actor_id = null where actor_id = target_id;
    update public.loyalty_transactions set created_by = null where created_by = target_id;
    -- No debe quedar una invitacion capaz de restablecer privilegios al registrarse.
    delete from public.pending_barbers where lower(email) = lower(target_profile.email);
    delete from public.pending_cashiers where lower(email) = lower(target_profile.email);
    delete from public.pending_admins where lower(email) = lower(target_profile.email);
    -- auth.users elimina sesiones, identidades y el perfil con sus datos personales
    -- dependientes (roles, preferencias, notificaciones y cuentas de fidelidad).
    delete from auth.users where id = target_id;

  when 'products' then
    select name into record_name from public.products where id = target_id for update;
    if not found then raise exception 'El producto ya no existe'; end if;
    perform 1 from public.rewards where product_id = target_id for update;
    if exists (select 1 from public.product_reservations where product_id = target_id and status = 'reserved' and expires_at > now()) then
      raise exception 'Entrega o cancela las reservas pendientes de este producto antes de eliminarlo';
    end if;
    perform 1 from public.sales s join public.sale_items si on si.sale_id = s.id where si.product_id = target_id for update of s;
    if exists (select 1 from public.sale_items si join public.sales s on s.id = si.sale_id where si.product_id = target_id and s.status in ('draft', 'pending_payment')) then
      raise exception 'Resuelve las ventas pendientes de este producto antes de eliminarlo';
    end if;
    if exists (select 1 from public.reward_redemptions rr join public.rewards r on r.id = rr.reward_id where r.product_id = target_id and rr.status = 'pending') then
      raise exception 'Resuelve los canjes pendientes de este producto antes de eliminarlo';
    end if;
    if exists (select 1 from public.appointment_checkout_details d join public.appointments a on a.id = d.appointment_id where d.suggested_product_id = target_id and a.status not in ('completed', 'canceled', 'no_show')) then
      raise exception 'Resuelve las atenciones que incluyen este producto antes de eliminarlo';
    end if;
    update public.sale_items set product_id_snapshot = product_id, product_id = null where product_id = target_id;
    update public.product_reservations
      set product_name_snapshot = coalesce(product_name_snapshot, record_name), product_id = null,
          status = case when status = 'reserved' then 'expired' else status end
      where product_id = target_id;
    update public.appointment_checkout_details set suggested_product_id = null where suggested_product_id = target_id;
    update public.rewards set active = false, product_id = null where product_id = target_id;
    delete from public.products where id = target_id;

  when 'services' then
    select name into record_name from public.services where id = target_id for update;
    if not found then raise exception 'El servicio ya no existe'; end if;
    perform 1 from public.rewards where service_id = target_id for update;
    if exists (select 1 from public.appointments where service_id = target_id and status not in ('completed', 'canceled', 'no_show'))
      or exists (select 1 from public.appointment_checkout_details d join public.appointments a on a.id = d.appointment_id
        where (d.actual_service_id = target_id or d.extra_service_id = target_id) and a.status not in ('completed', 'canceled', 'no_show')) then
      raise exception 'Resuelve o cancela las citas pendientes de este servicio antes de eliminarlo';
    end if;
    perform 1 from public.sales s join public.sale_items si on si.sale_id = s.id where si.service_id = target_id for update of s;
    if exists (select 1 from public.sale_items si join public.sales s on s.id = si.sale_id where si.service_id = target_id and s.status in ('draft', 'pending_payment')) then
      raise exception 'Resuelve las ventas pendientes de este servicio antes de eliminarlo';
    end if;
    if exists (select 1 from public.reward_redemptions rr join public.rewards r on r.id = rr.reward_id
      where (rr.service_id_snapshot = target_id or r.service_id = target_id) and rr.status = 'pending') then
      raise exception 'Resuelve los canjes pendientes de este servicio antes de eliminarlo';
    end if;
    update public.appointments set service_id = null where service_id = target_id;
    update public.sale_items set service_id_snapshot = service_id, service_id = null where service_id = target_id;
    update public.appointment_checkout_details set actual_service_id = null where actual_service_id = target_id;
    update public.appointment_checkout_details set extra_service_id = null where extra_service_id = target_id;
    update public.reward_redemptions set service_id_snapshot = null where service_id_snapshot = target_id;
    update public.rewards set active = false, service_id = null where service_id = target_id;
    delete from public.services where id = target_id;

  when 'barbers' then
    select * into target_barber from public.barber_profiles where id = target_id for update;
    if not found then raise exception 'El peluquero ya no existe'; end if;
    record_name := target_barber.display_name;
    perform 1 from public.barber_earnings where barber_id = target_id for update;
    perform 1 from public.barber_expenses where barber_id = target_id for update;
    perform 1 from public.payouts where barber_id = target_id for update;
    if exists (select 1 from public.appointments where barber_id = target_id and status not in ('completed', 'canceled', 'no_show')) then
      raise exception 'Reasigna o cancela las citas pendientes del peluquero antes de eliminarlo';
    end if;
    perform 1 from public.sales s join public.sale_items si on si.sale_id = s.id
      where si.barber_id = target_id or si.recommended_by_barber_id = target_id for update of s;
    if exists (select 1 from public.sale_items si join public.sales s on s.id = si.sale_id
      where (si.barber_id = target_id or si.recommended_by_barber_id = target_id) and s.status in ('draft', 'pending_payment')) then
      raise exception 'Resuelve las ventas pendientes del peluquero antes de eliminarlo';
    end if;
    if exists (select 1 from public.barber_earnings where barber_id = target_id and status in ('pending', 'approved') and amount <> 0)
      or exists (select 1 from public.barber_expenses where barber_id = target_id and status in ('pending', 'approved'))
      or exists (select 1 from public.payouts where barber_id = target_id and status in ('draft', 'approved')) then
      raise exception 'Liquida las comisiones, gastos y pagos pendientes del peluquero antes de eliminarlo';
    end if;
    if exists (select 1 from public.reward_redemptions where barber_id = target_id and status = 'pending') then
      raise exception 'Resuelve o cancela los canjes pendientes del peluquero antes de eliminarlo';
    end if;

    update public.appointments set barber_name_snapshot = coalesce(barber_name_snapshot, record_name), barber_id = null where barber_id = target_id;
    update public.appointments set reassigned_from_barber_id = null where reassigned_from_barber_id = target_id;
    update public.sale_items set barber_name_snapshot = coalesce(barber_name_snapshot, record_name), barber_id_snapshot = barber_id, barber_id = null where barber_id = target_id;
    update public.sale_items set recommended_by_barber_name_snapshot = coalesce(recommended_by_barber_name_snapshot, record_name), recommended_by_barber_id = null where recommended_by_barber_id = target_id;
    update public.barber_earnings set barber_name_snapshot = coalesce(barber_name_snapshot, record_name), barber_id = null where barber_id = target_id;
    update public.barber_expenses set barber_name_snapshot = coalesce(barber_name_snapshot, record_name), barber_id = null where barber_id = target_id;
    update public.payouts set barber_name_snapshot = coalesce(barber_name_snapshot, record_name), barber_id = null where barber_id = target_id;
    update public.loyalty_transactions set barber_id_snapshot = barber_id, barber_id = null where barber_id = target_id;
    update public.reward_redemptions set barber_id_snapshot = barber_id, barber_id = null where barber_id = target_id;
    update public.discount_applications set barber_id = null where barber_id = target_id;
    delete from public.pending_barbers where barber_profile_id = target_id;
    delete from public.user_roles where user_id = target_barber.user_id and role = 'barber';
    -- La cuenta personal y sus otros roles siguen siendo independientes del empleo.
    delete from public.barber_profiles where id = target_id;

  when 'gallery' then
    select title into record_name from public.gallery_posts where id = target_id for update;
    if not found then raise exception 'La publicacion ya no existe'; end if;
    delete from public.gallery_posts where id = target_id;
  end case;

  insert into public.audit_logs(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'record_permanently_deleted', entity_type, target_id::text,
    jsonb_build_object('name', record_name, 'financial_history_preserved', true));
exception
  when foreign_key_violation then
    -- Una nueva dependencia desconocida nunca debe causar un borrado en cascada.
    raise exception 'No se pudo eliminar: el registro conserva operaciones vinculadas que deben resolverse primero. No se realizaron cambios.';
end;
$$;

revoke all on function public.admin_delete_record(text, uuid) from public, anon;
grant execute on function public.admin_delete_record(text, uuid) to authenticated;
-- Impide saltarse validaciones mediante DELETE directo en la API de tablas.
revoke delete on public.profiles, public.products, public.barber_profiles, public.gallery_posts, public.services from anon, authenticated;

-- El modal de clientes necesita la ficha completa, sin exponer estos datos a otros roles.
create or replace function public.admin_list_clients(search_term text default null, page_number integer default 1, page_size integer default 25)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_size integer := least(greatest(coalesce(page_size, 25), 1), 100);
  normalized_search text := lower(btrim(coalesce(search_term, '')));
  result_rows jsonb;
  result_total bigint;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  select count(*) into result_total from public.profiles p
  where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role in ('admin', 'superadmin'))
    and (normalized_search = '' or position(normalized_search in lower(coalesce(p.full_name, '') || ' ' || p.email || ' ' || coalesce(p.phone, ''))) > 0);
  select coalesce(jsonb_agg(to_jsonb(client_row)), '[]'::jsonb) into result_rows
  from (
    select p.id, p.full_name, p.email, p.phone, p.status, p.no_show_count, p.is_blacklisted, p.is_blocked,
      p.created_at, p.birthday, p.address, p.late_cancel_count, p.blacklist_reason, p.blocked_reason,
      p.blocked_at, p.photo_consent, p.updated_at
    from public.profiles p
    where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role in ('admin', 'superadmin'))
      and (normalized_search = '' or position(normalized_search in lower(coalesce(p.full_name, '') || ' ' || p.email || ' ' || coalesce(p.phone, ''))) > 0)
    order by p.created_at desc, p.id offset (safe_page - 1) * safe_size limit safe_size
  ) client_row;
  return jsonb_build_object('rows', result_rows, 'total', result_total, 'page', safe_page, 'page_size', safe_size);
end;
$$;

revoke all on function public.admin_list_clients(text, integer, integer) from public, anon;
grant execute on function public.admin_list_clients(text, integer, integer) to authenticated;

-- Una devolucion no repone puntos en otra cuenta tras eliminar al peluquero o cliente.

-- Una venta cubierta al 100% puede revertirse sin intentar insertar un
-- movimiento de caja por cero, importe que la tabla prohibe correctamente.

create or replace function public.reverse_counter_sale(target_sale_id uuid,reversal_reason text)
returns void language plpgsql security definer set search_path=''
as $$ declare sale public.sales%rowtype; shift uuid; item record; earning record; account_balance integer; reversal_points integer; clean_reason text:=trim(coalesce(reversal_reason,''));
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if length(clean_reason)<5 or length(clean_reason)>500 then raise exception 'La justificacion debe tener entre 5 y 500 caracteres'; end if;
  select * into sale from public.sales where id=target_sale_id for update;
  if not found or sale.status<>'paid' then raise exception 'La venta ya no esta disponible para reversion'; end if;
  if exists(select 1 from public.payout_items pi join public.barber_earnings be on be.id=pi.earning_id where be.sale_item_id in(select id from public.sale_items where sale_id=sale.id)) then raise exception 'La comision ya pertenece a una liquidacion; requiere ajuste administrativo'; end if;
  select id into shift from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift is null then raise exception 'Debes abrir caja antes de devolver un pago'; end if;

  for item in select * from public.sale_items where sale_id=sale.id loop
    if item.item_type='product' then update public.products set stock=stock+item.quantity where id=item.product_id; end if;
  end loop;
  for earning in select * from public.barber_earnings where sale_item_id in(select id from public.sale_items where sale_id=sale.id) and status in ('pending','approved') loop
    update public.barber_earnings set status='reversed' where id=earning.id;
    insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount,status)
    values(earning.barber_id,earning.sale_item_id,'reversal',earning.base_amount,earning.rate_percent,-earning.amount,'reversed') on conflict(sale_item_id,kind) do nothing;
  end loop;
  for earning in select * from public.loyalty_transactions where source_id=sale.id and points>0 and kind='earn' loop
    if earning.barber_id is not null then
      select balance into account_balance from public.customer_barber_loyalty_accounts where user_id=earning.user_id and barber_id=earning.barber_id for update;
      reversal_points:=least(coalesce(account_balance,0),earning.points);
      if reversal_points>0 then perform public.post_customer_barber_points(earning.user_id,earning.barber_id,-reversal_points,'reverse','Reversion: '||clean_reason,'reverse-sale:'||sale.id||':'||earning.id,'sale',sale.id); end if;
    elsif earning.barber_id_snapshot is null then
      select balance into account_balance from public.loyalty_accounts where user_id=earning.user_id for update;
      reversal_points:=least(coalesce(account_balance,0),earning.points);
      if reversal_points>0 then perform public.post_loyalty_points(earning.user_id,-reversal_points,'reverse','Reversion: '||clean_reason,'reverse-sale:'||sale.id||':'||earning.id,'sale',sale.id); end if;
    end if;
  end loop;
  for earning in select * from public.reward_redemptions where sale_id=sale.id and status='used' and user_id is not null loop
    if earning.barber_id is not null then
      perform public.post_customer_barber_points(earning.user_id,earning.barber_id,earning.points_spent,'reverse','Devolucion de canje por venta revertida','refund-redemption:'||earning.id,'reward',earning.reward_id);
    elsif earning.barber_id_snapshot is null then
      perform public.post_loyalty_points(earning.user_id,earning.points_spent,'reverse','Devolucion de canje por venta revertida','refund-redemption:'||earning.id,'reward',earning.reward_id);
    end if;
  end loop;
  update public.reward_redemptions set status='canceled',sale_id=null,used_at=null where sale_id=sale.id and status='used';
  update public.payments set status='refunded' where sale_id=sale.id and status='confirmed';
  if sale.paid_total<>0 then
    insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by)
    select shift,'refund',-sale.paid_total,method,'Devolucion: '||clean_reason,auth.uid() from public.payments where sale_id=sale.id order by created_at limit 1;
  end if;
  update public.sales set status='refunded',reversal_reason=clean_reason,reversed_at=now(),reversed_by=auth.uid(),updated_at=now() where id=sale.id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'sale_refunded','sales',sale.id::text,jsonb_build_object('reason',clean_reason,'amount',sale.paid_total));
end; $$;

revoke all on function public.reverse_counter_sale(uuid,text) from public;
grant execute on function public.reverse_counter_sale(uuid,text) to authenticated;


-- Los peluqueros eliminados permanecen en la analitica de ventas historicas.

-- Las estadisticas economicas se calculan desde ventas pagadas y sus lineas,
-- incluyendo cobros directos sin reserva y excluyendo ventas revertidas.

create or replace function public.admin_business_analytics()
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
  month_start date:=date_trunc('month',timezone('America/La_Paz',now()))::date;
  previous_start date:=(date_trunc('month',timezone('America/La_Paz',now()))-interval '1 month')::date;
  next_start date:=(date_trunc('month',timezone('America/La_Paz',now()))+interval '1 month')::date;
  year_start date:=(date_trunc('month',timezone('America/La_Paz',now()))-interval '11 months')::date;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  return jsonb_build_object(
    'generated_at',now(),
    'summary',jsonb_build_object(
      'registered_users',(select count(*) from public.profiles p where not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')),
      'new_users_current',(select count(*) from public.profiles p where timezone('America/La_Paz',p.created_at)>=month_start and timezone('America/La_Paz',p.created_at)<next_start and not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')),
      'new_users_previous',(select count(*) from public.profiles p where timezone('America/La_Paz',p.created_at)>=previous_start and timezone('America/La_Paz',p.created_at)<month_start and not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')),
      'completed_current',(select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=month_start and timezone('America/La_Paz',s.paid_at)<next_start),
      'completed_previous',(select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=previous_start and timezone('America/La_Paz',s.paid_at)<month_start),
      'service_value_current',(select coalesce(round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=month_start and timezone('America/La_Paz',s.paid_at)<next_start),
      'service_value_previous',(select coalesce(round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=previous_start and timezone('America/La_Paz',s.paid_at)<month_start),
      'average_ticket_current',(select coalesce(round(avg(s.paid_total),2),0) from public.sales s where s.status='paid' and timezone('America/La_Paz',s.paid_at)>=month_start and timezone('America/La_Paz',s.paid_at)<next_start),
      'product_units_current',(select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='product' and timezone('America/La_Paz',s.paid_at)>=month_start and timezone('America/La_Paz',s.paid_at)<next_start),
      'product_units_previous',(select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='product' and timezone('America/La_Paz',s.paid_at)>=previous_start and timezone('America/La_Paz',s.paid_at)<month_start),
      'cancellation_rate',(select coalesce(round(100.0*count(*) filter(where a.status='canceled')/nullif(count(*),0),1),0) from public.appointments a where timezone('America/La_Paz',a.starts_at)>=month_start and timezone('America/La_Paz',a.starts_at)<next_start),
      'no_show_rate',(select coalesce(round(100.0*count(*) filter(where a.status='no_show')/nullif(count(*),0),1),0) from public.appointments a where timezone('America/La_Paz',a.starts_at)>=month_start and timezone('America/La_Paz',a.starts_at)<next_start),
      'repeat_clients',(select count(*) from(select s.client_id from public.sales s where s.status='paid' and s.client_id is not null and exists(select 1 from public.sale_items si where si.sale_id=s.id and si.item_type='service') group by s.client_id having count(*)>=2) repeated)
    ),
    'monthly',(select coalesce(jsonb_agg(jsonb_build_object('month',to_char(series.month_start,'YYYY-MM'),'completed',series.completed,'service_value',series.service_value,'new_users',series.new_users,'product_units',series.product_units) order by series.month_start),'[]'::jsonb) from(
      select m.month_start,
        (select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=m.month_start and timezone('America/La_Paz',s.paid_at)<m.month_start+interval '1 month') completed,
        (select coalesce(round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=m.month_start and timezone('America/La_Paz',s.paid_at)<m.month_start+interval '1 month') service_value,
        (select count(*) from public.profiles p where timezone('America/La_Paz',p.created_at)>=m.month_start and timezone('America/La_Paz',p.created_at)<m.month_start+interval '1 month' and not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')) new_users,
        (select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='product' and timezone('America/La_Paz',s.paid_at)>=m.month_start and timezone('America/La_Paz',s.paid_at)<m.month_start+interval '1 month') product_units
      from generate_series(year_start::timestamp,month_start::timestamp,interval '1 month') m(month_start)
    ) series),
    'top_services',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.completed desc),'[]'::jsonb) from(
      select si.name_snapshot name,sum(si.quantity) completed,round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2) service_value
      from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=year_start group by si.name_snapshot order by completed desc limit 8
    ) row_data),
    'top_products',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.units desc),'[]'::jsonb) from(
      select si.name_snapshot name,sum(si.quantity) units,round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2) product_value
      from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='product' and timezone('America/La_Paz',s.paid_at)>=year_start group by si.name_snapshot order by units desc limit 8
    ) row_data),
    'top_barbers',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.completed desc),'[]'::jsonb) from(
      select coalesce(b.id,si.barber_id_snapshot) id,coalesce(b.display_name,si.barber_name_snapshot,'Peluquero eliminado') name,sum(si.quantity) completed,round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2) service_value
      from public.sales s join public.sale_items si on si.sale_id=s.id left join public.barber_profiles b on b.id=si.barber_id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=year_start group by coalesce(b.id,si.barber_id_snapshot),coalesce(b.display_name,si.barber_name_snapshot,'Peluquero eliminado') order by completed desc limit 8
    ) row_data),
    'busy_dates',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.total desc,row_data.date desc),'[]'::jsonb) from(
      select timezone('America/La_Paz',a.starts_at)::date date,count(*) total from public.appointments a where a.status not in ('canceled','needs_reschedule') and timezone('America/La_Paz',a.starts_at)>=year_start group by 1 order by total desc,date desc limit 10
    ) row_data),
    'weekdays',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.day_number),'[]'::jsonb) from(
      select extract(isodow from timezone('America/La_Paz',a.starts_at))::int day_number,case extract(isodow from timezone('America/La_Paz',a.starts_at))::int when 1 then 'Lunes' when 2 then 'Martes' when 3 then 'Miercoles' when 4 then 'Jueves' when 5 then 'Viernes' when 6 then 'Sabado' else 'Domingo' end label,count(*) total
      from public.appointments a where a.status not in ('canceled','needs_reschedule') and timezone('America/La_Paz',a.starts_at)>=year_start group by 1,2
    ) row_data),
    'hours',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.total desc),'[]'::jsonb) from(
      select extract(hour from timezone('America/La_Paz',a.starts_at))::int hour_number,lpad(extract(hour from timezone('America/La_Paz',a.starts_at))::int::text,2,'0')||':00' label,count(*) total
      from public.appointments a where a.status not in ('canceled','needs_reschedule') and timezone('America/La_Paz',a.starts_at)>=year_start group by 1,2 order by total desc limit 8
    ) row_data)
  );
end; $$;
