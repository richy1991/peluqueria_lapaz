-- Per-service cart lines, manual item prices, and one-service loyalty redemption.
alter table public.sale_items add column if not exists checkout_line_key text;
alter table public.sale_items add column if not exists parent_service_item_id uuid references public.sale_items(id) on delete set null;
create index if not exists sale_items_parent_service_item_id_idx on public.sale_items(parent_service_item_id) where parent_service_item_id is not null;

update public.rewards
set description='Canjea 100 puntos por el 100% de descuento en un servicio.',
    points_cost=100,reward_type='percent_discount',reward_value=100,max_discount=null,service_id=null,active=true
where name='Servicio por 100 puntos';
create or replace function public.register_counter_service_sale_v7(
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
  selected_reward_service_line_key text,
  redemption_code text,
  promotion_code text,
  checkout_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='extensions'
as $$
declare
  shift uuid;
  v_sale_id uuid;
  service public.services%rowtype;
  barber public.barber_profiles%rowtype;
  product public.products%rowtype;
  appt public.appointments%rowtype;
  existing_sale public.sales%rowtype;
  line jsonb;
  charge jsonb;
  product_line jsonb;
  nested_product jsonb;
  nested_key text;
  line_key text;
  checkout_keys text[]:=array[]::text[];
  line_service uuid;
  line_barber uuid;
  attendee text;
  charge_barber uuid;
  charge_description text;
  charge_amount numeric;
  line_product uuid;
  line_quantity integer;
  service_item_id uuid;
  line_unit_price numeric;
  charge_unit_price numeric;
  product_unit_price numeric;
  manual_line_discount numeric:=0;
  nested_product_count integer:=0;
  list_amount numeric:=0;
  discount_amount numeric:=0;
  benefit_discount numeric:=0;
  eligible_amount numeric:=0;
  allocated numeric:=0;
  residual numeric:=0;
  redemption public.reward_redemptions%rowtype;
  reward public.rewards%rowtype;
  promotion public.promotions%rowtype;
  reward_name text;
  reward_kind text;
  reward_value numeric;
  reward_cap numeric;
  reward_service uuid;
  reward_points integer;
  reward_barber uuid;
  paid_amount numeric;
  commission_total numeric;
  business_amount numeric;
  barber_discount numeric;
  business_discount numeric;
  receipt public.receipts%rowtype;
  claim text;
  service_count integer;
  target_line uuid;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if nullif(trim(checkout_idempotency_key),'') is null or length(checkout_idempotency_key)>100 then raise exception 'Identificador de cobro no valido'; end if;
  if payment_method not in ('cash','qr','transfer','card','other') then raise exception 'Forma de pago no permitida'; end if;
  if ((selected_reward_id is not null)::int+(nullif(trim(redemption_code),'') is not null)::int+(nullif(trim(promotion_code),'') is not null)::int)>1 then
    raise exception 'Solo se puede aplicar un beneficio por venta';
  end if;
  if coalesce(manual_discount,0)<0 or round(coalesce(manual_discount,0),2)<>coalesce(manual_discount,0) then raise exception 'Descuento manual no valido'; end if;
  if coalesce(manual_discount,0)>0 and (selected_reward_id is not null or nullif(trim(redemption_code),'') is not null or nullif(trim(promotion_code),'') is not null) then raise exception 'Solo se puede aplicar un beneficio por venta'; end if;

  select s.id into v_sale_id from public.sales s
    where s.created_by=auth.uid() and s.checkout_key=checkout_idempotency_key and s.status='paid' limit 1;
  if v_sale_id is not null then
    select * into receipt from public.receipts where sale_id=v_sale_id;
    select * into existing_sale from public.sales where id=v_sale_id;
    return jsonb_build_object('sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'list_total',existing_sale.list_total,'discount',existing_sale.discount_total,'paid_total',existing_sale.paid_total,'duplicate',true);
  end if;

  select id into shift from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift is null then raise exception 'Debes abrir caja antes de cobrar'; end if;
  if target_appointment_id is not null then
    select * into appt from public.appointments where id=target_appointment_id for update;
    if not found or appt.status not in ('confirmed','in_progress','pending_payment') then raise exception 'La cita no puede cobrarse'; end if;
    target_client_id:=appt.client_id;
  end if;
  if target_client_id is null and nullif(trim(guest_name),'') is null then raise exception 'Registra el nombre completo del titular'; end if;
  if target_client_id is not null and nullif(trim(provided_referral_code),'') is not null then raise exception 'El referido solo puede registrarse al crear un cliente nuevo'; end if;
  if jsonb_typeof(coalesce(service_lines,'[]'::jsonb))<>'array' then raise exception 'Las atenciones no tienen un formato valido'; end if;
  service_count:=jsonb_array_length(coalesce(service_lines,'[]'::jsonb));
  if service_count<1 or service_count>12 then raise exception 'Registra entre 1 y 12 atenciones'; end if;
  if jsonb_typeof(coalesce(custom_charges,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(custom_charges,'[]'::jsonb))>10 then raise exception 'Los cargos adicionales no tienen un formato valido'; end if;
  if product_lines is null then product_lines:='[]'::jsonb; end if;
  if jsonb_typeof(product_lines) is distinct from 'array' then raise exception 'Los productos no tienen un formato valido'; end if;
  if jsonb_array_length(product_lines)>100 then raise exception 'Agrega hasta 100 productos por cobro'; end if;
  if jsonb_array_length(product_lines)>0 and recommended_by_barber_id is not null
     and not exists(select 1 from public.barber_profiles where id=recommended_by_barber_id and active) then
    raise exception 'Peluquero no disponible';
  end if;

  claim:=case when target_client_id is null then upper(substr(encode(gen_random_bytes(8),'hex'),1,10)) else null end;
  insert into public.sales(shift_id,appointment_id,client_id,guest_name,guest_phone,referral_code,source,status,claim_code,created_by,checkout_key)
  values(shift,target_appointment_id,target_client_id,nullif(trim(guest_name),''),nullif(trim(guest_phone),''),nullif(trim(provided_referral_code),''),case when target_appointment_id is null then 'walk_in' else 'appointment' end,'draft',claim,auth.uid(),checkout_idempotency_key)
  on conflict(created_by,checkout_key) where checkout_key is not null do nothing returning id into v_sale_id;
  if v_sale_id is null then raise exception 'Este cobro ya esta siendo procesado'; end if;

  for line in select value from jsonb_array_elements(service_lines) loop
    line_service:=nullif(line->>'service_id','')::uuid;
    line_barber:=nullif(line->>'barber_id','')::uuid;
    line_key:=nullif(trim(line->>'line_id'),'');
    if line_key is null or length(line_key)>100 or line_key=any(checkout_keys) then raise exception 'Atencion sin identificador valido'; end if;
    checkout_keys:=array_append(checkout_keys,line_key);
    if jsonb_typeof(coalesce(line->'charges','[]'::jsonb)) is distinct from 'array' or jsonb_array_length(coalesce(line->'charges','[]'::jsonb))>10 then raise exception 'Cargos adicionales no validos'; end if;
    if jsonb_typeof(coalesce(line->'products','[]'::jsonb)) is distinct from 'array' then raise exception 'Productos de atencion no validos'; end if;
    attendee:=coalesce(nullif(trim(line->>'attendee_label'),''),'Titular');
    if attendee not in ('Titular','Hijo/a','Acompañante') then attendee:='Acompañante'; end if;
    select * into service from public.services where id=line_service and status='active';
    select * into barber from public.barber_profiles where id=line_barber and active;
    if service.id is null or barber.id is null then raise exception 'Servicio o peluquero no disponible'; end if;
    line_unit_price:=coalesce(nullif(line->>'unit_price','')::numeric,service.price);
    if line_unit_price<0 or line_unit_price>service.price or round(line_unit_price,2)<>line_unit_price then raise exception 'El precio del servicio no puede superar su precio de lista'; end if;
    list_amount:=list_amount+service.price;
    manual_line_discount:=manual_line_discount+(service.price-line_unit_price);
    insert into public.sale_items(sale_id,item_type,service_id,barber_id,name_snapshot,attendee_label,earns_loyalty,quantity,unit_price_snapshot,discount_amount,commission_percent_snapshot,commission_amount,checkout_line_key)
    values(v_sale_id,'service',service.id,barber.id,service.name,attendee,true,1,service.price,service.price-line_unit_price,barber.commission_percent,round(service.price*barber.commission_percent/100,2),line_key)
    returning id into service_item_id;

    for charge in select value from jsonb_array_elements(coalesce(line->'charges','[]'::jsonb)) loop
      nested_key:=nullif(trim(charge->>'line_id'),'');
      charge_description:=nullif(trim(charge->>'description'),'');
      charge_amount:=coalesce(nullif(charge->>'amount','')::numeric,0);
      charge_unit_price:=coalesce(nullif(charge->>'unit_price','')::numeric,charge_amount);
      if nested_key is null or length(nested_key)>100 or nested_key=any(checkout_keys) or charge_description is null or length(charge_description)<3 or length(charge_description)>160 or charge_amount<=0 or charge_amount>10000 then raise exception 'Revisa el cargo imprevisto y su justificacion'; end if;
      checkout_keys:=array_append(checkout_keys,nested_key);
      if charge_unit_price<0 or charge_unit_price>charge_amount or round(charge_unit_price,2)<>charge_unit_price then raise exception 'El precio ajustado del cargo no es valido'; end if;
      list_amount:=list_amount+charge_amount;
      manual_line_discount:=manual_line_discount+(charge_amount-charge_unit_price);
      insert into public.sale_items(sale_id,item_type,barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,discount_amount,commission_percent_snapshot,commission_amount,checkout_line_key,parent_service_item_id)
      values(v_sale_id,'custom_charge',line_barber,'Adicional: '||charge_description,false,1,charge_amount,charge_amount-charge_unit_price,barber.commission_percent,round(charge_amount*barber.commission_percent/100,2),nested_key,service_item_id);
    end loop;

    for nested_product in select value from jsonb_array_elements(coalesce(line->'products','[]'::jsonb)) loop
      nested_key:=nullif(trim(nested_product->>'line_id'),'');
      line_product:=nullif(nested_product->>'product_id','')::uuid;
      line_quantity:=coalesce(nullif(nested_product->>'quantity','')::integer,0);
      if nested_key is null or length(nested_key)>100 or nested_key=any(checkout_keys) or line_product is null or line_quantity<1 or line_quantity>100 then raise exception 'Producto o cantidad no validos'; end if;
      checkout_keys:=array_append(checkout_keys,nested_key);
      nested_product_count:=nested_product_count+line_quantity;
      if nested_product_count>100 then raise exception 'Agrega hasta 100 productos por cobro'; end if;
      select * into product from public.products where id=line_product and status='active' for update;
      if product.id is null or product.stock<line_quantity then raise exception 'Stock insuficiente para %',coalesce(product.name,'producto'); end if;
      product_unit_price:=coalesce(nullif(nested_product->>'unit_price','')::numeric,product.price);
      if product_unit_price<0 or product_unit_price>product.price or round(product_unit_price,2)<>product_unit_price then raise exception 'El precio ajustado del producto no es valido'; end if;
      update public.products set stock=stock-line_quantity where id=product.id;
      list_amount:=list_amount+product.price*line_quantity;
      manual_line_discount:=manual_line_discount+(product.price-product_unit_price)*line_quantity;
      insert into public.sale_items(sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,discount_amount,commission_percent_snapshot,commission_amount,checkout_line_key,parent_service_item_id)
      values(v_sale_id,'product',product.id,line_barber,product.name,false,line_quantity,product.price,(product.price-product_unit_price)*line_quantity,0,0,nested_key,service_item_id);
    end loop;
  end loop;

  for charge in select value from jsonb_array_elements(coalesce(custom_charges,'[]'::jsonb)) loop
    charge_description:=nullif(trim(charge->>'description'),'');
    charge_amount:=coalesce(nullif(charge->>'amount','')::numeric,0);
    charge_barber:=nullif(charge->>'barber_id','')::uuid;
    if charge_description is null or length(charge_description)<3 or length(charge_description)>160 or charge_amount<=0 or charge_amount>10000 then raise exception 'Revisa el cargo imprevisto y su justificacion'; end if;
    select * into barber from public.barber_profiles where id=charge_barber and active;
    if barber.id is null then raise exception 'Selecciona el peluquero responsable del cargo'; end if;
    list_amount:=list_amount+charge_amount;
    insert into public.sale_items(sale_id,item_type,barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'custom_charge',barber.id,'Adicional: '||charge_description,false,1,charge_amount,barber.commission_percent,round(charge_amount*barber.commission_percent/100,2));
  end loop;

  for product_line in select value from jsonb_array_elements(product_lines) loop
    line_product:=nullif(product_line->>'product_id','')::uuid;
    line_quantity:=coalesce(nullif(product_line->>'quantity','')::integer,0);
    if line_product is null or line_quantity<1 or line_quantity>100 then raise exception 'Producto o cantidad no validos'; end if;
    select * into product from public.products where id=line_product and status='active' for update;
    if product.id is null or product.stock<line_quantity then raise exception 'Stock insuficiente para %',coalesce(product.name,'producto'); end if;
    update public.products set stock=stock-line_quantity where id=product.id;
    list_amount:=list_amount+product.price*line_quantity;
    insert into public.sale_items(sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'product',product.id,recommended_by_barber_id,product.name,false,line_quantity,product.price,0,0);
  end loop;

  if manual_line_discount>0 and (selected_reward_id is not null or nullif(trim(redemption_code),'') is not null or nullif(trim(promotion_code),'') is not null or coalesce(manual_discount,0)>0) then
    raise exception 'El ajuste manual por producto o servicio se aplica por separado';
  end if;
  if manual_line_discount>0 then discount_amount:=manual_line_discount; end if;
  if coalesce(manual_discount,0)>0 then
    if manual_discount>list_amount then raise exception 'El descuento manual no puede superar el subtotal'; end if;
    update public.sale_items si set discount_amount=si.discount_amount+round(manual_discount*(si.quantity*si.unit_price_snapshot)/list_amount,2)
    where si.sale_id=v_sale_id;
    select coalesce(sum(si.discount_amount),0) into allocated from public.sale_items si where si.sale_id=v_sale_id;
    residual:=manual_discount-allocated;
    select id into target_line from public.sale_items where sale_id=v_sale_id order by quantity*unit_price_snapshot desc,id limit 1;
    if residual<>0 then update public.sale_items set discount_amount=discount_amount+residual where id=target_line; end if;
    discount_amount:=manual_discount;
  end if;

  if nullif(trim(redemption_code),'') is not null then
    if target_client_id is null then raise exception 'El canje requiere un cliente registrado'; end if;
    perform public.release_expired_reward_reservations();
    select * into redemption from public.reward_redemptions where upper(code)=upper(trim(redemption_code)) and user_id=target_client_id and status='pending' and expires_at>now() for update;
    if not found then raise exception 'Canje invalido, vencido o perteneciente a otra cuenta'; end if;
    reward_name:=redemption.reward_name_snapshot; reward_kind:=redemption.reward_type_snapshot; reward_value:=redemption.reward_value_snapshot;
    reward_cap:=redemption.max_discount_snapshot; reward_service:=redemption.service_id_snapshot; reward_points:=redemption.points_spent; reward_barber:=redemption.barber_id;
  elsif selected_reward_id is not null then
    if target_client_id is null or selected_reward_barber_id is null or nullif(trim(selected_reward_service_line_key),'') is null then raise exception 'Selecciona cliente, servicio y peluquero para el canje'; end if;
    select * into reward from public.rewards where id=selected_reward_id and active and reward_type in ('percent_discount','fixed_discount')
      and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) for update;
    if not found or (reward.usage_limit is not null and reward.usage_count+(select count(*) from public.reward_redemptions pending where pending.reward_id=reward.id and pending.status='pending')>=reward.usage_limit) then raise exception 'Recompensa no disponible'; end if;
    if reward.points_cost not in (50,100) or reward.reward_type<>'percent_discount' or reward.reward_value<>reward.points_cost then raise exception 'Recompensa no disponible'; end if;
    perform 1 from public.customer_barber_loyalty_accounts where user_id=target_client_id and barber_id=selected_reward_barber_id and ((reward.points_cost=50 and balance>50) or (reward.points_cost=100 and balance>=100)) for update;
    if not found then raise exception 'Saldo de puntos insuficiente con este peluquero'; end if;
    reward_name:=reward.name; reward_kind:=reward.reward_type; reward_value:=reward.reward_value; reward_cap:=reward.max_discount;
    reward_service:=reward.service_id; reward_points:=reward.points_cost; reward_barber:=selected_reward_barber_id;
  end if;

  if reward_kind is not null then
    select coalesce(sum(si.quantity*si.unit_price_snapshot),0) into eligible_amount from public.sale_items si
    where si.sale_id=v_sale_id and si.item_type='service' and si.barber_id=reward_barber and si.checkout_line_key=selected_reward_service_line_key and (reward_service is null or si.service_id=reward_service);
    if eligible_amount<=0 then raise exception 'La recompensa no corresponde a los servicios de este peluquero'; end if;
    benefit_discount:=least(eligible_amount,case when reward_kind='percent_discount' then round(eligible_amount*reward_value/100,2) else reward_value end,coalesce(reward_cap,eligible_amount));
    if benefit_discount<=0 then raise exception 'La recompensa no genera un descuento valido'; end if;
    update public.sale_items si set discount_amount=round(benefit_discount*(si.quantity*si.unit_price_snapshot)/eligible_amount,2)
      where si.sale_id=v_sale_id and si.item_type='service' and si.barber_id=reward_barber and si.checkout_line_key=selected_reward_service_line_key and (reward_service is null or si.service_id=reward_service);
    select coalesce(sum(si.discount_amount),0) into allocated from public.sale_items si where si.sale_id=v_sale_id;
    residual:=benefit_discount-allocated;
    select id into target_line from public.sale_items where sale_id=v_sale_id and item_type='service' and barber_id=reward_barber and checkout_line_key=selected_reward_service_line_key and (reward_service is null or service_id=reward_service) order by quantity*unit_price_snapshot desc,id limit 1;
    if residual<>0 then update public.sale_items si set discount_amount=si.discount_amount+residual where si.id=target_line; end if;
    discount_amount:=benefit_discount;
    if redemption.id is not null then
      update public.reward_redemptions set sale_id=v_sale_id,status='used',used_at=now() where id=redemption.id;
    else
      insert into public.reward_redemptions(user_id,barber_id,reward_id,sale_id,points_spent,status,expires_at,used_at,reward_name_snapshot,reward_type_snapshot,reward_value_snapshot,max_discount_snapshot,service_id_snapshot,idempotency_key)
      values(target_client_id,reward_barber,reward.id,v_sale_id,reward_points,'used',now(),now(),reward_name,reward_kind,reward_value,reward_cap,reward_service,'cashier:'||checkout_idempotency_key);
      perform public.post_customer_barber_points(target_client_id,reward_barber,-reward_points,'redeem','Canje aplicado en caja','checkout-reward:'||checkout_idempotency_key,'reward',reward.id);
    end if;
    update public.rewards set usage_count=usage_count+1 where id=coalesce(redemption.reward_id,reward.id);
  elsif nullif(trim(promotion_code),'') is not null then
    select * into promotion from public.promotions where lower(code)=lower(trim(promotion_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) and (usage_limit is null or usage_count<usage_limit) for update;
    if not found then raise exception 'Promocion invalida, vencida o agotada'; end if;
    benefit_discount:=least(list_amount,case when promotion.discount_type='percent' then round(list_amount*promotion.discount_value/100,2) else promotion.discount_value end,coalesce(promotion.max_discount,list_amount));
    update public.sale_items si set discount_amount=round(benefit_discount*(si.quantity*si.unit_price_snapshot)/list_amount,2) where si.sale_id=v_sale_id;
    select coalesce(sum(si.discount_amount),0) into allocated from public.sale_items si where si.sale_id=v_sale_id;
    residual:=benefit_discount-allocated;
    select id into target_line from public.sale_items where sale_id=v_sale_id order by quantity*unit_price_snapshot desc,id limit 1;
    if residual<>0 then update public.sale_items si set discount_amount=si.discount_amount+residual where si.id=target_line; end if;
    discount_amount:=benefit_discount;
    update public.promotions set usage_count=usage_count+1 where id=promotion.id;
  end if;

  paid_amount:=list_amount-discount_amount;
  update public.sales set status='paid',list_total=list_amount,discount_total=discount_amount,paid_total=paid_amount,paid_at=now(),updated_at=now() where id=v_sale_id
    returning barber_commission_total,business_share,barber_discount_share,business_discount_share into commission_total,business_amount,barber_discount,business_discount;
  update public.sale_items si set earns_loyalty=false where si.sale_id=v_sale_id and si.item_type='service' and si.discount_amount>=si.quantity*si.unit_price_snapshot;
  insert into public.payments(sale_id,shift_id,amount,method,reference,confirmed_by) values(v_sale_id,shift,paid_amount,payment_method,nullif(trim(payment_reference),''),auth.uid());
  insert into public.receipts(sale_id,issued_by) values(v_sale_id,auth.uid()) returning * into receipt;
  if paid_amount<>0 then insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id) values(shift,'sale',paid_amount,payment_method,'Venta de servicios · comprobante #'||receipt.number,auth.uid(),v_sale_id); end if;
  insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount)
  select coalesce(si.barber_id,si.recommended_by_barber_id),si.id,case when si.item_type='product' then 'product_incentive' else 'service_commission' end,si.quantity*si.unit_price_snapshot,si.commission_percent_snapshot,si.commission_amount
  from public.sale_items si where si.sale_id=v_sale_id and si.commission_amount>0;
  if discount_amount>0 and (reward_kind is not null or promotion.id is not null) then
    insert into public.discount_applications(sale_id,source_type,source_id,barber_id,name_snapshot,rule_type_snapshot,rule_value_snapshot,max_discount_snapshot,eligible_base,discount_amount,barber_discount_share,business_discount_share)
    select v_sale_id,case when reward_kind is not null then 'reward' else 'promotion' end,case when reward_kind is not null then coalesce(redemption.reward_id,reward.id) else promotion.id end,
      si.barber_id,case when reward_kind is not null then reward_name else promotion.name end,case when reward_kind is not null then reward_kind else promotion.discount_type end,
      case when reward_kind is not null then reward_value else promotion.discount_value end,case when reward_kind is not null then reward_cap else promotion.max_discount end,
      sum(si.quantity*si.unit_price_snapshot),sum(si.discount_amount),sum(si.barber_discount_share),sum(si.business_discount_share)
    from public.sale_items si where si.sale_id=v_sale_id and si.discount_amount>0 group by si.barber_id;
  end if;
  if target_appointment_id is not null then update public.appointments set status='completed',updated_at=now() where id=target_appointment_id; delete from public.appointment_checkout_details where appointment_id=target_appointment_id; end if;
  perform public.process_sale_loyalty(v_sale_id);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'secure_service_sale_paid','sales',v_sale_id::text,jsonb_build_object('idempotency_key',checkout_idempotency_key,'list_total',list_amount,'discount',discount_amount,'manual_line_discount',manual_line_discount,'paid_total',paid_amount,'product_quantity',nested_product_count));
  return jsonb_build_object('sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'claim_code',claim,'list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,'barber_commission',commission_total,'business_share',business_amount,'barber_discount_share',barber_discount,'business_discount_share',business_discount);
end;
$$;


create or replace function public.register_counter_service_sale_v7_mixed(
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
  selected_reward_service_line_key text,
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

  result:=public.register_counter_service_sale_v7(
    target_appointment_id,target_client_id,guest_name,guest_phone,service_lines,custom_charges,
    product_lines,recommended_by_barber_id,manual_discount,coalesce(first_method,payment_method,'cash'),
    payment_reference,provided_referral_code,selected_reward_id,selected_reward_barber_id,selected_reward_service_line_key,
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


revoke all on function public.register_counter_service_sale_v7(uuid,uuid,text,text,jsonb,jsonb,jsonb,uuid,numeric,text,text,text,uuid,uuid,text,text,text,text) from public;
grant execute on function public.register_counter_service_sale_v7(uuid,uuid,text,text,jsonb,jsonb,jsonb,uuid,numeric,text,text,text,uuid,uuid,text,text,text,text) to authenticated;

revoke all on function public.register_counter_service_sale_v7_mixed(uuid,uuid,text,text,jsonb,jsonb,jsonb,uuid,numeric,text,text,text,uuid,uuid,text,text,text,text,jsonb) from public;
grant execute on function public.register_counter_service_sale_v7_mixed(uuid,uuid,text,text,jsonb,jsonb,jsonb,uuid,numeric,text,text,text,uuid,uuid,text,text,text,text,jsonb) to authenticated;
