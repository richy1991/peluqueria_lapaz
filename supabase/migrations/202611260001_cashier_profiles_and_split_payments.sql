-- Cashier snapshots and split tenders for sales, reservation collection and payouts.

create or replace function public.cashier_client_loyalty_snapshot(target_client_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  points_total integer;
  account_rows jsonb;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if not exists(select 1 from public.profiles where id=target_client_id and status='active') then
    raise exception 'Cliente no disponible';
  end if;

  select coalesce(sum(a.balance),0)::integer into points_total
  from public.customer_barber_loyalty_accounts a where a.user_id=target_client_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'barber_id',a.barber_id,
    'barber_name',coalesce(b.display_name,'Peluquero'),
    'balance',a.balance
  ) order by b.display_name),'[]'::jsonb) into account_rows
  from public.customer_barber_loyalty_accounts a
  left join public.barber_profiles b on b.id=a.barber_id
  where a.user_id=target_client_id;

  return jsonb_build_object('points_balance',points_total,'barber_balances',account_rows);
end;
$$;

revoke all on function public.cashier_client_loyalty_snapshot(uuid) from public;
grant execute on function public.cashier_client_loyalty_snapshot(uuid) to authenticated;

create or replace function public.cashier_quote_promotion(target_code text,target_amount numeric)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  promotion public.promotions%rowtype;
  amount numeric:=greatest(coalesce(target_amount,0),0);
  discount_amount numeric;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  select * into promotion from public.promotions
  where lower(code)=lower(trim(coalesce(target_code,''))) and active
    and (starts_at is null or starts_at<=now())
    and (ends_at is null or ends_at>now())
    and (usage_limit is null or usage_count<usage_limit);
  if not found then
    return jsonb_build_object('valid',false,'discount',0,'total',amount,'message','Código no válido, vencido o agotado.');
  end if;
  discount_amount:=least(amount,
    case when promotion.discount_type='percent' then round(amount*promotion.discount_value/100,2) else promotion.discount_value end,
    coalesce(promotion.max_discount,amount));
  if discount_amount<=0 then
    return jsonb_build_object('valid',false,'discount',0,'total',amount,'message','Este código no genera descuento para la compra.');
  end if;
  return jsonb_build_object('valid',true,'name',promotion.name,'discount',discount_amount,'total',amount-discount_amount);
end;
$$;

revoke all on function public.cashier_quote_promotion(text,numeric) from public;
grant execute on function public.cashier_quote_promotion(text,numeric) to authenticated;

create or replace function public.cashier_quote_redemption(target_client_id uuid,target_code text,service_lines jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  redemption public.reward_redemptions%rowtype;
  eligible_amount numeric;
  discount_amount numeric;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if jsonb_typeof(service_lines) is distinct from 'array' then
    return jsonb_build_object('valid',false,'discount',0,'message','Selecciona las atenciones antes de aplicar el canje.');
  end if;
  select * into redemption from public.reward_redemptions
  where upper(code)=upper(trim(coalesce(target_code,''))) and user_id=target_client_id
    and status='pending' and expires_at>now();
  if not found then
    return jsonb_build_object('valid',false,'discount',0,'message','Canje no válido, vencido o de otra cuenta.');
  end if;
  select coalesce(sum(s.price),0) into eligible_amount
  from jsonb_array_elements(service_lines) as line(value)
  join public.services s on s.id=nullif(line.value->>'service_id','')::uuid and s.status='active'
  where (redemption.barber_id is null or nullif(line.value->>'barber_id','')::uuid=redemption.barber_id)
    and (redemption.service_id_snapshot is null or s.id=redemption.service_id_snapshot);
  if eligible_amount<=0 then
    return jsonb_build_object('valid',false,'discount',0,'message','Este canje no corresponde a los servicios elegidos.');
  end if;
  discount_amount:=least(eligible_amount,
    case when redemption.reward_type_snapshot='percent_discount' then round(eligible_amount*redemption.reward_value_snapshot/100,2) else redemption.reward_value_snapshot end,
    coalesce(redemption.max_discount_snapshot,eligible_amount));
  if discount_amount<=0 then
    return jsonb_build_object('valid',false,'discount',0,'message','Este canje no genera descuento para las atenciones elegidas.');
  end if;
  return jsonb_build_object('valid',true,'discount',discount_amount,'eligible_amount',eligible_amount,'reward_name',redemption.reward_name_snapshot);
end;
$$;

revoke all on function public.cashier_quote_redemption(uuid,text,jsonb) from public;
grant execute on function public.cashier_quote_redemption(uuid,text,jsonb) to authenticated;

create or replace function public.register_counter_product_sale_batch(
  product_lines jsonb,
  target_client_id uuid default null,
  recommended_by_barber_id uuid default null,
  manual_discount numeric default 0,
  payment_method text default 'cash',
  payment_reference text default null,
  promotion_code text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  shift_id uuid;
  v_sale_id uuid;
  receipt public.receipts%rowtype;
  product public.products%rowtype;
  promotion public.promotions%rowtype;
  line jsonb;
  product_id uuid;
  quantity integer;
  list_amount numeric:=0;
  discount_amount numeric:=greatest(coalesce(manual_discount,0),0);
  promotion_discount numeric:=0;
  paid_amount numeric;
  line_count integer:=0;
  item_id uuid;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_method not in ('cash','qr','transfer','card','other') then raise exception 'Forma de pago no permitida'; end if;
  if jsonb_typeof(product_lines)<>'array' or jsonb_array_length(product_lines)<1 or jsonb_array_length(product_lines)>100 then raise exception 'Agrega entre 1 y 100 productos'; end if;
  if target_client_id is not null and not exists(select 1 from public.profiles where id=target_client_id and status='active') then raise exception 'Cliente no disponible'; end if;
  if recommended_by_barber_id is not null and not exists(select 1 from public.barber_profiles where id=recommended_by_barber_id and active) then raise exception 'Peluquero no disponible'; end if;
  if target_client_id is not null and recommended_by_barber_id is null then raise exception 'Selecciona el peluquero asociado para acreditar los puntos'; end if;
  select id into shift_id from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift_id is null then raise exception 'Debes abrir caja antes de cobrar'; end if;

  insert into public.sales(shift_id,client_id,source,status,created_by) values(shift_id,target_client_id,'walk_in','draft',auth.uid()) returning id into v_sale_id;
  for line in select value from jsonb_array_elements(product_lines) loop
    product_id:=nullif(line->>'product_id','')::uuid;
    quantity:=coalesce((line->>'quantity')::integer,0);
    if product_id is null or quantity<1 or quantity>100 then raise exception 'Producto o cantidad no válidos'; end if;
    select * into product from public.products where id=product_id and status='active' for update;
    if product.id is null or product.stock<quantity then raise exception 'Stock insuficiente para %',coalesce(product.name,'producto'); end if;
    update public.products set stock=stock-quantity where id=product.id;
    insert into public.sale_items(sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'product',product.id,recommended_by_barber_id,product.name,false,quantity,product.price,0,0) returning id into item_id;
    list_amount:=list_amount+(product.price*quantity);
    line_count:=line_count+quantity;
  end loop;

  if nullif(trim(promotion_code),'') is not null then
    select * into promotion from public.promotions where lower(code)=lower(trim(promotion_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) and (usage_limit is null or usage_count<usage_limit) for update;
    if not found then raise exception 'Promoción inválida, vencida o agotada'; end if;
    promotion_discount:=case when promotion.discount_type='percent' then round(list_amount*promotion.discount_value/100,2) else promotion.discount_value end;
    if promotion.max_discount is not null then promotion_discount:=least(promotion_discount,promotion.max_discount); end if;
    discount_amount:=discount_amount+promotion_discount;
    update public.promotions set usage_count=usage_count+1 where id=promotion.id;
  end if;
  discount_amount:=least(discount_amount,list_amount);
  paid_amount:=list_amount-discount_amount;
  update public.sales set status='paid',list_total=list_amount,discount_total=discount_amount,paid_total=paid_amount,paid_at=now(),updated_at=now() where id=v_sale_id;
  insert into public.payments(sale_id,shift_id,amount,method,reference,confirmed_by) values(v_sale_id,shift_id,paid_amount,payment_method,nullif(trim(payment_reference),''),auth.uid());
  insert into public.receipts(sale_id,issued_by) values(v_sale_id,auth.uid()) returning * into receipt;
  if paid_amount<>0 then insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id) values(shift_id,'sale',paid_amount,payment_method,'Venta de productos · comprobante #'||receipt.number,auth.uid(),v_sale_id); end if;
  insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount)
  select si.recommended_by_barber_id,si.id,'product_incentive',si.quantity*si.unit_price_snapshot,0,si.commission_amount from public.sale_items si where si.sale_id=v_sale_id and si.recommended_by_barber_id is not null and si.commission_amount>0;
  update public.sales set loyalty_processed_at=now(),updated_at=now() where id=v_sale_id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'product_batch_sale_paid','sales',v_sale_id::text,jsonb_build_object('line_count',line_count,'list_total',list_amount,'paid_total',paid_amount,'client_id',target_client_id));
  return jsonb_build_object('sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,'product_quantity',line_count);
end;
$$;

revoke all on function public.register_counter_product_sale_batch(jsonb,uuid,uuid,numeric,text,text,text) from public;
grant execute on function public.register_counter_product_sale_batch(jsonb,uuid,uuid,numeric,text,text,text) to authenticated;

create or replace function public.register_counter_product_sale_batch_mixed(
  product_lines jsonb,
  target_client_id uuid,
  recommended_by_barber_id uuid,
  manual_discount numeric,
  promotion_code text,
  payment_splits jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  result jsonb;
  v_sale_id uuid;
  sale_shift uuid;
  paid_total numeric;
  split_total numeric:=0;
  split jsonb;
  split_method text;
  split_amount numeric;
  first_method text;
  inserted_payment boolean:=false;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_splits is null or jsonb_typeof(payment_splits) is distinct from 'array' then
    raise exception 'Distribuye el pago entre una y cinco formas de pago';
  end if;
  if jsonb_array_length(payment_splits)<1 or jsonb_array_length(payment_splits)>5 then
    raise exception 'Distribuye el pago entre una y cinco formas de pago';
  end if;
  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,-1);
    if split_method is null or split_method not in ('cash','qr','transfer','card','other') or split_amount<0 or round(split_amount,2)<>split_amount then
      raise exception 'Revisa las formas e importes de pago';
    end if;
    first_method:=coalesce(first_method,split_method);
    split_total:=split_total+split_amount;
  end loop;

  result:=public.register_counter_product_sale_batch(
    product_lines,target_client_id,recommended_by_barber_id,manual_discount,
    coalesce(first_method,'cash'),null,promotion_code
  );
  v_sale_id:=nullif(result->>'sale_id','')::uuid;
  paid_total:=coalesce(nullif(result->>'paid_total','')::numeric,0);
  if round(split_total,2)<>round(paid_total,2) then raise exception 'La suma de los pagos debe coincidir con el total a cobrar'; end if;
  if coalesce((result->>'duplicate')::boolean,false) then return result; end if;

  select shift_id into sale_shift from public.sales where id=v_sale_id;
  delete from public.payments where payments.sale_id=v_sale_id and payments.status='confirmed';
  delete from public.cash_movements where cash_movements.sale_id=v_sale_id and cash_movements.kind='sale';
  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,0);
    if split_amount>0 then
      insert into public.payments(sale_id,shift_id,amount,method,confirmed_by)
      values(v_sale_id,sale_shift,split_amount,split_method,auth.uid());
      insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id)
      values(sale_shift,'sale',split_amount,split_method,'Venta de productos · comprobante #'||coalesce(result->>'receipt_number',''),auth.uid(),v_sale_id);
      inserted_payment:=true;
    end if;
  end loop;
  if not inserted_payment then
    insert into public.payments(sale_id,shift_id,amount,method,confirmed_by)
    values(v_sale_id,sale_shift,0,coalesce(first_method,'cash'),auth.uid());
  end if;
  return result;
end;
$$;

revoke all on function public.register_counter_product_sale_batch_mixed(jsonb,uuid,uuid,numeric,text,jsonb) from public;
grant execute on function public.register_counter_product_sale_batch_mixed(jsonb,uuid,uuid,numeric,text,jsonb) to authenticated;

create or replace function public.register_counter_service_sale_v6_mixed(
  target_appointment_id uuid,
  target_client_id uuid,
  guest_name text,
  guest_phone text,
  service_lines jsonb,
  custom_charges jsonb,
  product_lines jsonb,
  recommended_by_barber_id uuid,
  manual_discount numeric,
  payment_method text,
  payment_reference text,
  provided_referral_code text,
  selected_reward_id uuid,
  selected_reward_barber_id uuid,
  redemption_code text,
  promotion_code text,
  checkout_idempotency_key text,
  payment_splits jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  result jsonb;
  v_sale_id uuid;
  sale_shift uuid;
  paid_total numeric;
  split_total numeric:=0;
  split jsonb;
  split_method text;
  split_amount numeric;
  first_method text;
  inserted_payment boolean:=false;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_splits is null or jsonb_typeof(payment_splits) is distinct from 'array' then
    raise exception 'Distribuye el pago entre una y cinco formas de pago';
  end if;
  if jsonb_array_length(payment_splits)<1 or jsonb_array_length(payment_splits)>5 then
    raise exception 'Distribuye el pago entre una y cinco formas de pago';
  end if;
  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,-1);
    if split_method is null or split_method not in ('cash','qr','transfer','card','other') or split_amount<0 or round(split_amount,2)<>split_amount then
      raise exception 'Revisa las formas e importes de pago';
    end if;
    first_method:=coalesce(first_method,split_method);
    split_total:=split_total+split_amount;
  end loop;

  result:=public.register_counter_service_sale_v6(
    target_appointment_id,target_client_id,guest_name,guest_phone,service_lines,custom_charges,
    product_lines,recommended_by_barber_id,manual_discount,coalesce(first_method,payment_method,'cash'),
    payment_reference,provided_referral_code,selected_reward_id,selected_reward_barber_id,
    redemption_code,promotion_code,checkout_idempotency_key
  );
  v_sale_id:=nullif(result->>'sale_id','')::uuid;
  paid_total:=coalesce(nullif(result->>'paid_total','')::numeric,0);
  if round(split_total,2)<>round(paid_total,2) then raise exception 'La suma de los pagos debe coincidir con el total a cobrar'; end if;
  if coalesce((result->>'duplicate')::boolean,false) then return result; end if;

  select shift_id into sale_shift from public.sales where id=v_sale_id;
  delete from public.payments where payments.sale_id=v_sale_id and payments.status='confirmed';
  delete from public.cash_movements where cash_movements.sale_id=v_sale_id and cash_movements.kind='sale';
  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,0);
    if split_amount>0 then
      insert into public.payments(sale_id,shift_id,amount,method,confirmed_by)
      values(v_sale_id,sale_shift,split_amount,split_method,auth.uid());
      insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id)
      values(sale_shift,'sale',split_amount,split_method,'Venta de servicios · comprobante #'||coalesce(result->>'receipt_number',''),auth.uid(),v_sale_id);
      inserted_payment:=true;
    end if;
  end loop;
  if not inserted_payment then
    insert into public.payments(sale_id,shift_id,amount,method,confirmed_by)
    values(v_sale_id,sale_shift,0,coalesce(first_method,payment_method,'cash'),auth.uid());
  end if;
  return result;
end;
$$;

revoke all on function public.register_counter_service_sale_v6_mixed(uuid,uuid,text,text,jsonb,jsonb,jsonb,uuid,numeric,text,text,text,uuid,uuid,text,text,text,jsonb) from public;
grant execute on function public.register_counter_service_sale_v6_mixed(uuid,uuid,text,text,jsonb,jsonb,jsonb,uuid,numeric,text,text,text,uuid,uuid,text,text,text,jsonb) to authenticated;

create or replace function public.collect_product_reservation_mixed(
  target_reservation_id uuid,
  recommended_by_barber_id uuid,
  promotion_code text,
  payment_splits jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  result jsonb;
  v_sale_id uuid;
  sale_shift uuid;
  paid_total numeric;
  split_total numeric:=0;
  split jsonb;
  split_method text;
  split_amount numeric;
  first_method text;
  inserted_payment boolean:=false;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_splits is null or jsonb_typeof(payment_splits) is distinct from 'array' then
    raise exception 'Distribuye el pago entre una y cinco formas de pago';
  end if;
  if jsonb_array_length(payment_splits)<1 or jsonb_array_length(payment_splits)>5 then
    raise exception 'Distribuye el pago entre una y cinco formas de pago';
  end if;
  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,-1);
    if split_method is null or split_method not in ('cash','qr','transfer','card','other') or split_amount<0 or round(split_amount,2)<>split_amount then
      raise exception 'Revisa las formas e importes de pago';
    end if;
    first_method:=coalesce(first_method,split_method);
    split_total:=split_total+split_amount;
  end loop;

  result:=public.collect_product_reservation(target_reservation_id,recommended_by_barber_id,coalesce(first_method,'cash'),null,promotion_code);
  v_sale_id:=nullif(result->>'sale_id','')::uuid;
  paid_total:=coalesce(nullif(result->>'paid_total','')::numeric,0);
  if round(split_total,2)<>round(paid_total,2) then raise exception 'La suma de los pagos debe coincidir con el total a cobrar'; end if;

  select shift_id into sale_shift from public.sales where id=v_sale_id;
  delete from public.payments where payments.sale_id=v_sale_id and payments.status='confirmed';
  delete from public.cash_movements where cash_movements.sale_id=v_sale_id and cash_movements.kind='sale';
  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,0);
    if split_amount>0 then
      insert into public.payments(sale_id,shift_id,amount,method,confirmed_by)
      values(v_sale_id,sale_shift,split_amount,split_method,auth.uid());
      insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id)
      values(sale_shift,'sale',split_amount,split_method,'Retiro de producto apartado · comprobante #'||coalesce(result->>'receipt_number',''),auth.uid(),v_sale_id);
      inserted_payment:=true;
    end if;
  end loop;
  if not inserted_payment then
    insert into public.payments(sale_id,shift_id,amount,method,confirmed_by)
    values(v_sale_id,sale_shift,0,coalesce(first_method,'cash'),auth.uid());
  end if;
  return result;
end;
$$;

revoke all on function public.collect_product_reservation_mixed(uuid,uuid,text,jsonb) from public;
grant execute on function public.collect_product_reservation_mixed(uuid,uuid,text,jsonb) to authenticated;

drop index if exists public.cash_movements_payout_unique;

create or replace function public.pay_daily_barber_payout_mixed(
  target_payout uuid,
  payment_splits jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  payout public.payouts%rowtype;
  shift_id uuid;
  barber_name text;
  split jsonb;
  split_method text;
  split_amount numeric;
  split_total numeric:=0;
  movement_id uuid;
  movement_rows jsonb:='[]'::jsonb;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_splits is null or jsonb_typeof(payment_splits) is distinct from 'array' then
    raise exception 'Distribuye el pago entre una y cinco formas de pago';
  end if;
  if jsonb_array_length(payment_splits)<1 or jsonb_array_length(payment_splits)>5 then
    raise exception 'Distribuye el pago entre una y cinco formas de pago';
  end if;
  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,-1);
    if split_method is null or split_method not in ('cash','qr','transfer','card','other') or split_amount<0 or round(split_amount,2)<>split_amount then
      raise exception 'Revisa las formas e importes de pago';
    end if;
    split_total:=split_total+split_amount;
  end loop;

  select * into payout from public.payouts where id=target_payout for update;
  if not found or payout.status<>'approved' or payout.period_start<>payout.period_end then raise exception 'La liquidación diaria no está disponible'; end if;
  if payout.total_amount<=0 then raise exception 'La liquidación no tiene un importe pagable'; end if;
  if round(split_total,2)<>round(payout.total_amount,2) then raise exception 'La suma de los pagos debe coincidir con el total de la liquidación'; end if;
  if not public.is_admin() and payout.period_start<>(now() at time zone 'America/La_Paz')::date then raise exception 'Caja solo puede pagar liquidaciones de la jornada actual'; end if;
  select id into shift_id from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift_id is null then raise exception 'Debes abrir caja antes de pagar una liquidación'; end if;
  select display_name into barber_name from public.barber_profiles where id=payout.barber_id;

  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,0);
    if split_amount>0 then
      insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,payout_id)
      values(shift_id,'expense',-split_amount,split_method,'Liquidación diaria: '||coalesce(barber_name,'peluquero'),auth.uid(),payout.id)
      returning id into movement_id;
      movement_rows:=movement_rows||jsonb_build_array(jsonb_build_object('movement_id',movement_id,'method',split_method,'amount',split_amount));
    end if;
  end loop;

  update public.payouts set status='paid',paid_at=now() where id=payout.id;
  update public.barber_earnings set status='paid' where id in(select earning_id from public.payout_items where payout_id=payout.id and earning_id is not null);
  update public.barber_expenses set status=case when payout.reimbursement_amount>0 and payout.deduction_amount=0 then 'reimbursed' else 'deducted' end,
    reviewed_at=now(),reviewed_by=auth.uid()
  where id in(select expense_id from public.payout_items where payout_id=payout.id and expense_id is not null);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data)
  values(auth.uid(),'daily_barber_payout_paid','payouts',payout.id::text,
    jsonb_build_object('total',payout.total_amount,'deductions',payout.deduction_amount,'payment_splits',payment_splits,'movements',movement_rows,'shift_id',shift_id));
  return jsonb_build_object('payout_id',payout.id,'movements',movement_rows,'total',payout.total_amount,'barber',barber_name);
end;
$$;

revoke all on function public.pay_daily_barber_payout_mixed(uuid,jsonb) from public;
grant execute on function public.pay_daily_barber_payout_mixed(uuid,jsonb) to authenticated;

create or replace function public.reverse_counter_sale(target_sale_id uuid,reversal_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare
  sale public.sales%rowtype;
  shift uuid;
  item record;
  earning record;
  payment_row record;
  account_balance integer;
  reversal_points integer;
  clean_reason text:=trim(coalesce(reversal_reason,''));
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if length(clean_reason)<5 or length(clean_reason)>500 then raise exception 'La justificación debe tener entre 5 y 500 caracteres'; end if;
  select * into sale from public.sales where id=target_sale_id for update;
  if not found or sale.status<>'paid' then raise exception 'La venta ya no está disponible para reversión'; end if;
  if exists(select 1 from public.payout_items pi join public.barber_earnings be on be.id=pi.earning_id where be.sale_item_id in(select id from public.sale_items where sale_id=sale.id)) then raise exception 'La comisión ya pertenece a una liquidación; requiere ajuste administrativo'; end if;
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
      if reversal_points>0 then perform public.post_customer_barber_points(earning.user_id,earning.barber_id,-reversal_points,'reverse','Reversión: '||clean_reason,'reverse-sale:'||sale.id||':'||earning.id,'sale',sale.id); end if;
    elsif earning.barber_id_snapshot is null then
      select balance into account_balance from public.loyalty_accounts where user_id=earning.user_id for update;
      reversal_points:=least(coalesce(account_balance,0),earning.points);
      if reversal_points>0 then perform public.post_loyalty_points(earning.user_id,-reversal_points,'reverse','Reversión: '||clean_reason,'reverse-sale:'||sale.id||':'||earning.id,'sale',sale.id); end if;
    end if;
  end loop;
  for earning in select * from public.reward_redemptions where sale_id=sale.id and status='used' and user_id is not null loop
    if earning.barber_id is not null then
      perform public.post_customer_barber_points(earning.user_id,earning.barber_id,earning.points_spent,'reverse','Devolución de canje por venta revertida','refund-redemption:'||earning.id,'reward',earning.reward_id);
    elsif earning.barber_id_snapshot is null then
      perform public.post_loyalty_points(earning.user_id,earning.points_spent,'reverse','Devolución de canje por venta revertida','refund-redemption:'||earning.id,'reward',earning.reward_id);
    end if;
  end loop;
  update public.reward_redemptions set status='canceled',sale_id=null,used_at=null where sale_id=sale.id and status='used';
  update public.payments set status='refunded' where sale_id=sale.id and status='confirmed';
  for payment_row in select * from public.payments where sale_id=sale.id and status='refunded' and amount>0 order by created_at loop
    insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id)
    values(shift,'refund',-payment_row.amount,payment_row.method,'Devolución: '||clean_reason,auth.uid(),sale.id);
  end loop;
  update public.sales set status='refunded',reversal_reason=clean_reason,reversed_at=now(),reversed_by=auth.uid(),updated_at=now() where id=sale.id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data)
  values(auth.uid(),'sale_refunded','sales',sale.id::text,jsonb_build_object('reason',clean_reason,'amount',sale.paid_total,'payment_splits',(select coalesce(jsonb_agg(jsonb_build_object('method',method,'amount',amount) order by created_at),'[]'::jsonb) from public.payments where sale_id=sale.id)));
end;
$$;

revoke all on function public.reverse_counter_sale(uuid,text) from public;
grant execute on function public.reverse_counter_sale(uuid,text) to authenticated;

