-- Incentivo fijo de Bs 5 por unidad vendida y canje de 50 puntos por
-- descuento del 50% del servicio elegible.

create or replace function public.set_product_sales_commission()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.item_type='product' and new.recommended_by_barber_id is not null then
    new.commission_percent_snapshot:=0;
    new.commission_amount:=5 * new.quantity;
  end if;
  return new;
end;
$$;

create or replace function public.apply_equitable_sale_discount()
returns trigger language plpgsql security definer set search_path=''
as $$
declare gross_commission numeric; net_commission numeric; target_barber_share numeric; factor numeric;
begin
  if new.status='paid' and old.status<>'paid' then
    select coalesce(sum(commission_amount),0) into gross_commission
    from public.sale_items where sale_id=new.id and item_type='service';
    new.discount_total:=least(greatest(coalesce(new.discount_total,0),0),new.list_total);
    new.paid_total:=new.list_total-new.discount_total;
    if new.discount_total>=new.list_total then target_barber_share:=gross_commission;
    else target_barber_share:=least(round(new.discount_total/2,2),gross_commission); end if;
    factor:=case when gross_commission>0 then (gross_commission-target_barber_share)/gross_commission else 0 end;
    update public.sale_items set commission_amount=round(commission_amount*factor,2)
    where sale_id=new.id and item_type='service' and commission_amount<>0;
    select coalesce(sum(commission_amount),0) into net_commission from public.sale_items where sale_id=new.id;
    new.barber_commission_total:=net_commission;
    if new.discount_total>=new.list_total then new.business_share:=0;
    else new.business_share:=greatest(new.paid_total-new.barber_commission_total,0); end if;
    new.barber_discount_share:=gross_commission-(select coalesce(sum(commission_amount),0) from public.sale_items where sale_id=new.id and item_type='service');
    new.business_discount_share:=new.discount_total-new.barber_discount_share;
  end if;
  return new;
end;
$$;

insert into public.rewards(name,description,points_cost,reward_type,reward_value,max_discount,active)
select '50% de descuento en servicio','Canjea 50 puntos por 50% de descuento en un servicio.',50,'percent_discount',50,null,true
where not exists(select 1 from public.rewards where name='50% de descuento en servicio');

update public.rewards
set description='Canjea 50 puntos por 50% de descuento en un servicio.',
    points_cost=50,reward_type='percent_discount',reward_value=50,max_discount=null,active=true
where name='50% de descuento en servicio';

create or replace function public.process_sale_loyalty(target_sale uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
  sale public.sales%rowtype;
  settings public.loyalty_settings%rowtype;
  primary_barber uuid;
  referrer uuid;
  prior_service_sales integer;
  item_group record;
begin
  select * into sale from public.sales where id=target_sale and status='paid' for update;
  if not found or sale.client_id is null or sale.loyalty_processed_at is not null then return; end if;
  select * into settings from public.loyalty_settings where id=true;
  select si.barber_id into primary_barber from public.sale_items si
  where si.sale_id=sale.id and si.item_type='service' and si.earns_loyalty and si.barber_id is not null
  order by si.created_at limit 1;

  if primary_barber is not null then
    select count(distinct s.id)::integer into prior_service_sales from public.sales s
    join public.sale_items si on si.sale_id=s.id and si.item_type='service' and si.earns_loyalty
    where s.client_id=sale.client_id and s.status='paid' and s.id<>sale.id;
    if prior_service_sales=0 then
      perform public.post_customer_barber_points(sale.client_id,primary_barber,10,'earn','Puntos iniciales con tu peluquero','welcome:'||sale.client_id||':'||primary_barber,'sale',sale.id);
    end if;
  end if;

  for item_group in
    select barber_id,count(*)::integer as item_count from public.sale_items
    where sale_id=sale.id and item_type='service' and earns_loyalty and barber_id is not null group by barber_id
  loop
    perform public.post_customer_barber_points(sale.client_id,item_group.barber_id,settings.service_points*item_group.item_count,'earn','Servicio completado con este peluquero','service-sale:'||sale.id||':'||item_group.barber_id,'sale',sale.id);
  end loop;

  if primary_barber is not null and nullif(trim(sale.referral_code),'') is not null then
    select id into referrer from public.profiles where lower(referral_code)=lower(trim(sale.referral_code));
    if referrer is not null and referrer<>sale.client_id and prior_service_sales=0 then
      insert into public.referrals(referrer_id,referred_id,first_sale_id,status,qualified_at)
      values(referrer,sale.client_id,sale.id,'rewarded',now()) on conflict(referred_id) do nothing;
      if found then
        perform public.post_customer_barber_points(referrer,primary_barber,10,'earn','Cliente referido atendido por tu peluquero','referrer:'||sale.client_id||':'||primary_barber,'referral',sale.id);
      end if;
    end if;
  end if;
  update public.sales set loyalty_processed_at=now(),updated_at=now() where id=sale.id;
end;
$$;

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
  sale_id uuid;
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

  insert into public.sales(shift_id,client_id,source,status,created_by) values(shift_id,target_client_id,'walk_in','draft',auth.uid()) returning id into sale_id;
  for line in select value from jsonb_array_elements(product_lines) loop
    product_id:=nullif(line->>'product_id','')::uuid;
    quantity:=coalesce((line->>'quantity')::integer,0);
    if product_id is null or quantity<1 or quantity>100 then raise exception 'Producto o cantidad no válidos'; end if;
    select * into product from public.products where id=product_id and status='active' for update;
    if product.id is null or product.stock<quantity then raise exception 'Stock insuficiente para %',coalesce(product.name,'producto'); end if;
    update public.products set stock=stock-quantity where id=product.id;
    insert into public.sale_items(sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(sale_id,'product',product.id,recommended_by_barber_id,product.name,false,quantity,product.price,0,0) returning id into item_id;
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
  update public.sales set status='paid',list_total=list_amount,discount_total=discount_amount,paid_total=paid_amount,paid_at=now(),updated_at=now() where id=sale_id;
  insert into public.payments(sale_id,shift_id,amount,method,reference,confirmed_by) values(sale_id,shift_id,paid_amount,payment_method,nullif(trim(payment_reference),''),auth.uid());
  insert into public.receipts(sale_id,issued_by) values(sale_id,auth.uid()) returning * into receipt;
  if paid_amount<>0 then insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id) values(shift_id,'sale',paid_amount,payment_method,'Venta de productos · comprobante #'||receipt.number,auth.uid(),sale_id); end if;
  insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount)
  select si.recommended_by_barber_id,si.id,'product_incentive',si.quantity*si.unit_price_snapshot,0,si.commission_amount from public.sale_items si where si.sale_id=sale_id and si.recommended_by_barber_id is not null and si.commission_amount>0;
  update public.sales set loyalty_processed_at=now(),updated_at=now() where id=sale_id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'product_batch_sale_paid','sales',sale_id::text,jsonb_build_object('line_count',line_count,'list_total',list_amount,'paid_total',paid_amount,'client_id',target_client_id));
  return jsonb_build_object('sale_id',sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,'product_quantity',line_count);
end;
$$;

revoke all on function public.register_counter_product_sale_batch(jsonb,uuid,uuid,numeric,text,text,text) from public;
grant execute on function public.register_counter_product_sale_batch(jsonb,uuid,uuid,numeric,text,text,text) to authenticated;

create or replace function public.award_product_purchase_points()
returns trigger language plpgsql security definer set search_path=''
as $$
declare product_sale public.sales%rowtype; sale_item public.sale_items%rowtype;
begin
  if new.kind<>'product_incentive' then return new; end if;
  select * into sale_item from public.sale_items where id=new.sale_item_id and item_type='product';
  if sale_item.id is null or sale_item.recommended_by_barber_id is null then return new; end if;
  select * into product_sale from public.sales where id=sale_item.sale_id and client_id is not null;
  if product_sale.id is not null then
    perform public.post_customer_barber_points(product_sale.client_id,sale_item.recommended_by_barber_id,5*sale_item.quantity,'earn','Compra de producto','product-item-points:'||sale_item.id,'sale',product_sale.id);
  end if;
  return new;
end;
$$;

drop trigger if exists barber_earning_product_points on public.barber_earnings;
create trigger barber_earning_product_points
after insert on public.barber_earnings
for each row execute function public.award_product_purchase_points();

-- Extiende el checkout vigente con un descuento manual autorizado por Caja.
-- Se conserva la firma anterior para no romper clientes ya desplegados.
do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.register_counter_service_sale_v5(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,text,text,text,uuid,uuid,text,text,text)'::regprocedure
  ) into definition;
  definition:=regexp_replace(
    definition,
    'recommended_by_barber_id uuid[[:space:]]*,[[:space:]]*payment_method text',
    'recommended_by_barber_id uuid, manual_discount numeric, payment_method text'
  );
  definition:=regexp_replace(
    definition,
    'discount_amount numeric[[:space:]]*:=[[:space:]]*0;',
    'discount_amount numeric:=greatest(coalesce(manual_discount,0),0);'
  );
  execute definition;
end;
$$;

revoke all on function public.register_counter_service_sale_v5(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,numeric,text,text,text,uuid,uuid,text,text,text) from public;
grant execute on function public.register_counter_service_sale_v5(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,numeric,text,text,text,uuid,uuid,text,text,text) to authenticated;

-- Las liquidaciones nuevas ya no dependen de gastos del peluquero. Los
-- registros históricos se conservan para auditoría, pero no bloquean ni
-- descuentan pagos posteriores.
create or replace function public.create_daily_barber_payout_v2(
  target_barber uuid, work_date date default null, include_accumulated_incentives boolean default false
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
  result_id uuid;
  shift_id uuid;
  business_day date:=coalesce(work_date,(now() at time zone 'America/La_Paz')::date);
  day_start timestamptz:=(business_day::timestamp at time zone 'America/La_Paz');
  day_end timestamptz:=((business_day+1)::timestamp at time zone 'America/La_Paz');
  commissions numeric:=0;
  incentives numeric:=0;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if not public.is_admin() and business_day<>(now() at time zone 'America/La_Paz')::date then raise exception 'Caja solo puede liquidar la jornada actual'; end if;
  select id into shift_id from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift_id is null then raise exception 'Debes abrir caja antes de preparar liquidaciones'; end if;
  if not exists(select 1 from public.barber_profiles where id=target_barber and active) then raise exception 'El peluquero no está activo'; end if;
  if exists(select 1 from public.payouts where barber_id=target_barber and period_start=business_day and period_end=business_day and status<>'canceled') then raise exception 'Este peluquero ya tiene una liquidación para la jornada'; end if;

  select coalesce(sum(e.amount),0) into commissions
  from public.barber_earnings e
  where e.barber_id=target_barber and e.kind='service_commission' and e.status='pending'
    and e.created_at>=day_start and e.created_at<day_end;
  if include_accumulated_incentives then
    select coalesce(sum(e.amount),0) into incentives
    from public.barber_earnings e
    where e.barber_id=target_barber and e.kind='product_incentive' and e.status='pending' and e.created_at<day_end;
  end if;
  if commissions+incentives<=0 then raise exception 'No existen comisiones pendientes para liquidar'; end if;

  insert into public.payouts(
    barber_id,period_start,period_end,commission_amount,incentive_amount,
    reimbursement_amount,deduction_amount,total_amount,includes_accumulated_incentives,status,created_by
  )
  values(target_barber,business_day,business_day,commissions,incentives,0,0,commissions+incentives,include_accumulated_incentives,'approved',auth.uid())
  returning id into result_id;

  insert into public.payout_items(payout_id,earning_id,amount)
  select result_id,e.id,e.amount
  from public.barber_earnings e
  where e.barber_id=target_barber and e.status='pending'
    and ((e.kind='service_commission' and e.created_at>=day_start and e.created_at<day_end)
      or (include_accumulated_incentives and e.kind='product_incentive' and e.created_at<day_end));
  update public.barber_earnings set status='approved'
  where id in(select earning_id from public.payout_items where payout_id=result_id and earning_id is not null);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data)
  values(auth.uid(),'daily_barber_payout_v2_created','payouts',result_id::text,
    jsonb_build_object('work_date',business_day,'commissions',commissions,'incentives',incentives,'deductions',0,'total',commissions+incentives,'shift_id',shift_id));
  return result_id;
end;
$$;

revoke all on function public.submit_barber_expense(text,numeric,text) from authenticated;
revoke all on function public.cashier_review_barber_expense(uuid,text) from authenticated;
