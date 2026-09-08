-- Caja puede consultar y cobrar apartados de productos conservando su trazabilidad.
drop policy if exists "Cashiers read product reservations" on public.product_reservations;
create policy "Cashiers read product reservations"
  on public.product_reservations for select
  using (public.is_cashier());

create or replace function public.collect_product_reservation(
  target_reservation_id uuid,
  recommended_by_barber_id uuid default null,
  payment_method text default 'cash',
  payment_reference text default null,
  promotion_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'extensions'
as $$
declare
  shift uuid;
  reservation public.product_reservations%rowtype;
  product public.products%rowtype;
  promotion public.promotions%rowtype;
  receipt public.receipts%rowtype;
  v_sale_id uuid;
  list_amount numeric;
  discount_amount numeric := 0;
  promotion_discount numeric := 0;
  paid_amount numeric;
  commission_total numeric;
  business_amount numeric;
  barber_discount numeric;
  business_discount numeric;
begin
  if not public.is_cashier() then
    raise exception 'Acceso de caja requerido';
  end if;
  if payment_method not in ('cash','qr','transfer','card','other') then
    raise exception 'Forma de pago no permitida';
  end if;

  select id into shift
  from public.cash_shifts
  where opened_by = auth.uid() and status = 'open'
  order by opened_at desc
  limit 1;
  if shift is null then
    raise exception 'Debes abrir caja antes de cobrar';
  end if;

  select * into reservation
  from public.product_reservations
  where id = target_reservation_id
  for update;
  if reservation.id is null then
    raise exception 'El apartado no existe';
  end if;
  if reservation.status <> 'reserved' then
    raise exception 'El apartado ya fue procesado';
  end if;
  if reservation.expires_at <= now() then
    raise exception 'El apartado venció y no puede cobrarse';
  end if;

  select * into product
  from public.products
  where id = reservation.product_id and status = 'active'
  for update;
  if product.id is null or product.stock < reservation.quantity then
    raise exception 'Producto sin stock suficiente';
  end if;
  if recommended_by_barber_id is not null and not exists (
    select 1 from public.barber_profiles
    where id = recommended_by_barber_id and active
  ) then
    raise exception 'Peluquero no disponible';
  end if;

  list_amount := reservation.price_snapshot * reservation.quantity;
  insert into public.sales(shift_id, client_id, source, status, created_by)
  values(shift, reservation.client_id, 'product_reservation', 'draft', auth.uid())
  returning id into v_sale_id;

  update public.products
  set stock = stock - reservation.quantity
  where id = product.id;

  insert into public.sale_items(
    sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,
    earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount
  ) values (
    v_sale_id,'product',product.id,recommended_by_barber_id,product.name,
    false,reservation.quantity,reservation.price_snapshot,0,0
  );

  if nullif(trim(promotion_code),'') is not null then
    select * into promotion
    from public.promotions
    where lower(code) = lower(trim(promotion_code))
      and active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and (usage_limit is null or usage_count < usage_limit)
    for update;
    if not found then
      raise exception 'Promoción inválida, vencida o agotada';
    end if;
    promotion_discount := case
      when promotion.discount_type = 'percent' then round(list_amount * promotion.discount_value / 100, 2)
      else promotion.discount_value
    end;
    if promotion.max_discount is not null then
      promotion_discount := least(promotion_discount, promotion.max_discount);
    end if;
    discount_amount := least(promotion_discount, list_amount);
    update public.promotions set usage_count = usage_count + 1 where id = promotion.id;
  end if;

  paid_amount := list_amount - discount_amount;
  update public.sales
  set status = 'paid', list_total = list_amount, discount_total = discount_amount,
      paid_total = paid_amount, paid_at = now(), updated_at = now()
  where id = v_sale_id
  returning barber_commission_total,business_share,barber_discount_share,business_discount_share
  into commission_total,business_amount,barber_discount,business_discount;

  insert into public.payments(sale_id,shift_id,amount,method,reference,confirmed_by)
  values(v_sale_id,shift,paid_amount,payment_method,nullif(trim(payment_reference),''),auth.uid());
  insert into public.receipts(sale_id,issued_by)
  values(v_sale_id,auth.uid()) returning * into receipt;
  if paid_amount <> 0 then
    insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id)
    values(shift,'sale',paid_amount,payment_method,'Retiro de producto apartado · comprobante #'||receipt.number,auth.uid(),v_sale_id);
  end if;

  insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount)
  select si.recommended_by_barber_id,si.id,'product_incentive',
         si.quantity*si.unit_price_snapshot,si.commission_percent_snapshot,si.commission_amount
  from public.sale_items si
  where si.sale_id = v_sale_id
    and si.recommended_by_barber_id is not null
    and si.commission_amount > 0;

  update public.product_reservations
  set status = 'collected', updated_at = now()
  where id = reservation.id;
  update public.sales set loyalty_processed_at = now(), updated_at = now() where id = v_sale_id;

  insert into public.audit_logs(actor_id,action,entity,entity_id,data)
  values(auth.uid(),'product_reservation_collected','product_reservations',reservation.id::text,
    jsonb_build_object(
      'sale_id',v_sale_id,'client_id',reservation.client_id,'product_id',product.id,
      'quantity',reservation.quantity,'list_total',list_amount,'paid_total',paid_amount
    ));

  return jsonb_build_object(
    'sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,
    'client_id',reservation.client_id,'reservation_id',reservation.id,
    'list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,
    'barber_commission',commission_total,'business_share',business_amount,
    'barber_discount_share',barber_discount,'business_discount_share',business_discount
  );
end;
$$;

revoke all on function public.collect_product_reservation(uuid,uuid,text,text,text) from public;
grant execute on function public.collect_product_reservation(uuid,uuid,text,text,text) to authenticated;
