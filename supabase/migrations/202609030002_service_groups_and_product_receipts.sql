-- Separa ventas de producto de la fidelidad y permite varias atenciones por titular.

alter table public.sale_items add column if not exists attendee_label text;
alter table public.sale_items add column if not exists earns_loyalty boolean not null default true;
update public.sale_items set earns_loyalty = (item_type = 'service');

alter table public.sale_items drop constraint if exists sale_items_item_type_check;
alter table public.sale_items drop constraint if exists sale_items_check;
alter table public.sale_items add constraint sale_items_item_type_check
  check(item_type in ('service','product','custom_charge'));
alter table public.sale_items add constraint sale_items_kind_fields_check check(
  (item_type='service' and service_id is not null and product_id is null and barber_id is not null)
  or (item_type='product' and product_id is not null and service_id is null)
  or (item_type='custom_charge' and service_id is null and product_id is null and barber_id is not null)
);

create or replace function public.register_counter_service_sale_v4(
  target_appointment_id uuid,target_client_id uuid,guest_name text,guest_phone text,
  service_lines jsonb,custom_charges jsonb,target_product_id uuid,product_quantity integer,
  recommended_by_barber_id uuid,manual_discount numeric,payment_method text,payment_reference text,
  provided_referral_code text,redemption_code text,promotion_code text
) returns jsonb language plpgsql security definer set search_path='extensions'
as $$ declare
  shift uuid; v_sale_id uuid; service public.services%rowtype; barber public.barber_profiles%rowtype;
  product public.products%rowtype; appt public.appointments%rowtype; line jsonb; charge jsonb;
  line_service uuid; line_barber uuid; attendee text; charge_barber uuid; charge_description text; charge_amount numeric;
  list_amount numeric:=0; commission_total numeric:=0; discount_amount numeric:=greatest(coalesce(manual_discount,0),0);
  reward_discount numeric:=0; promotion_discount numeric:=0; redemption public.reward_redemptions%rowtype;
  reward public.rewards%rowtype; promotion public.promotions%rowtype; paid_amount numeric; business_amount numeric;
  barber_discount numeric; business_discount numeric; receipt public.receipts%rowtype; claim text;
  qty int:=greatest(coalesce(product_quantity,1),1); service_count int;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_method not in ('cash','qr','transfer','card','other') then raise exception 'Forma de pago no permitida'; end if;
  select id into shift from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift is null then raise exception 'Debes abrir caja antes de cobrar'; end if;

  if target_appointment_id is not null then
    select * into appt from public.appointments where id=target_appointment_id for update;
    if not found or appt.status not in ('confirmed','in_progress','pending_payment') then raise exception 'La cita no puede cobrarse'; end if;
    target_client_id:=appt.client_id;
  end if;
  if target_client_id is null and nullif(trim(guest_name),'') is null then raise exception 'Registra el nombre completo del titular'; end if;
  if target_client_id is not null and nullif(trim(provided_referral_code),'') is not null then
    raise exception 'El referido solo puede registrarse al crear un cliente nuevo';
  end if;
  if jsonb_typeof(coalesce(service_lines,'[]'::jsonb))<>'array' then raise exception 'Las atenciones no tienen un formato valido'; end if;
  service_count:=jsonb_array_length(coalesce(service_lines,'[]'::jsonb));
  if service_count<1 or service_count>12 then raise exception 'Registra entre 1 y 12 atenciones'; end if;
  if jsonb_typeof(coalesce(custom_charges,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(custom_charges,'[]'::jsonb))>10 then
    raise exception 'Los cargos adicionales no tienen un formato valido';
  end if;

  claim:=case when target_client_id is null then upper(substr(encode(gen_random_bytes(8),'hex'),1,10)) else null end;
  insert into public.sales(shift_id,appointment_id,client_id,guest_name,guest_phone,referral_code,source,status,claim_code,created_by)
  values(shift,target_appointment_id,target_client_id,nullif(trim(guest_name),''),nullif(trim(guest_phone),''),nullif(trim(provided_referral_code),''),case when target_appointment_id is null then 'walk_in' else 'appointment' end,'draft',claim,auth.uid())
  returning id into v_sale_id;

  for line in select value from jsonb_array_elements(service_lines) loop
    line_service:=nullif(line->>'service_id','')::uuid;
    line_barber:=nullif(line->>'barber_id','')::uuid;
    attendee:=coalesce(nullif(trim(line->>'attendee_label'),''),'Titular');
    if attendee not in ('Titular','Hijo/a','Acompañante') then attendee:='Acompañante'; end if;
    select * into service from public.services where id=line_service and status='active';
    if service.id is null then raise exception 'Uno de los servicios ya no esta disponible'; end if;
    select * into barber from public.barber_profiles where id=line_barber and active;
    if barber.id is null then raise exception 'Selecciona un peluquero disponible para cada atencion'; end if;
    list_amount:=list_amount+service.price;
    insert into public.sale_items(sale_id,item_type,service_id,barber_id,name_snapshot,attendee_label,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'service',service.id,barber.id,service.name,attendee,true,1,service.price,barber.commission_percent,round(service.price*barber.commission_percent/100,2));
  end loop;

  for charge in select value from jsonb_array_elements(coalesce(custom_charges,'[]'::jsonb)) loop
    charge_description:=nullif(trim(charge->>'description'),'');
    charge_amount:=coalesce(nullif(charge->>'amount','')::numeric,0);
    charge_barber:=nullif(charge->>'barber_id','')::uuid;
    if charge_description is null or length(charge_description)<3 or length(charge_description)>160 then raise exception 'Cada cargo necesita una justificacion clara'; end if;
    if charge_amount<=0 or charge_amount>10000 then raise exception 'El monto del cargo adicional no es valido'; end if;
    select * into barber from public.barber_profiles where id=charge_barber and active;
    if barber.id is null then raise exception 'Selecciona el peluquero responsable del cargo'; end if;
    list_amount:=list_amount+charge_amount;
    insert into public.sale_items(sale_id,item_type,barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'custom_charge',barber.id,'Adicional: '||charge_description,false,1,charge_amount,barber.commission_percent,round(charge_amount*barber.commission_percent/100,2));
  end loop;

  if target_product_id is not null then
    select * into product from public.products where id=target_product_id and status='active' for update;
    if product.id is null or product.stock<qty then raise exception 'Producto sin stock suficiente'; end if;
    update public.products set stock=stock-qty where id=product.id;
    list_amount:=list_amount+product.price*qty;
    insert into public.sale_items(sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'product',product.id,recommended_by_barber_id,product.name,false,qty,product.price,0,0);
    if target_client_id is not null then update public.product_reservations set status='collected',updated_at=now() where id=(select id from public.product_reservations where client_id=target_client_id and product_id=product.id and status='reserved' order by created_at limit 1); end if;
  end if;

  if nullif(trim(redemption_code),'') is not null then
    if target_client_id is null then raise exception 'Un cliente nuevo debe vincular su cuenta antes de usar un canje'; end if;
    select rr.* into redemption from public.reward_redemptions rr where upper(rr.code)=upper(trim(redemption_code)) and rr.user_id=target_client_id and rr.status='pending' and rr.expires_at>now() for update;
    if not found then raise exception 'Canje invalido, vencido o perteneciente a otra cuenta'; end if;
    select * into reward from public.rewards where id=redemption.reward_id and active;
    reward_discount:=case when reward.reward_type='percent_discount' then round(list_amount*reward.reward_value/100,2) when reward.reward_type='fixed_discount' then reward.reward_value else 0 end;
    if reward.max_discount is not null then reward_discount:=least(reward_discount,reward.max_discount); end if;
    discount_amount:=discount_amount+reward_discount;
    update public.reward_redemptions set sale_id=v_sale_id,status='used',used_at=now() where id=redemption.id;
  end if;
  if nullif(trim(promotion_code),'') is not null then
    select * into promotion from public.promotions where lower(code)=lower(trim(promotion_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) and (usage_limit is null or usage_count<usage_limit) for update;
    if not found then raise exception 'Promocion invalida, vencida o agotada'; end if;
    promotion_discount:=case when promotion.discount_type='percent' then round(list_amount*promotion.discount_value/100,2) else promotion.discount_value end;
    if promotion.max_discount is not null then promotion_discount:=least(promotion_discount,promotion.max_discount); end if;
    discount_amount:=discount_amount+promotion_discount;
    update public.promotions set usage_count=usage_count+1 where id=promotion.id;
  end if;

  discount_amount:=least(discount_amount,list_amount); paid_amount:=list_amount-discount_amount;
  update public.sales set status='paid',list_total=list_amount,discount_total=discount_amount,paid_total=paid_amount,paid_at=now(),updated_at=now()
  where id=v_sale_id returning barber_commission_total,business_share,barber_discount_share,business_discount_share
  into commission_total,business_amount,barber_discount,business_discount;
  insert into public.payments(sale_id,shift_id,amount,method,reference,confirmed_by)
  values(v_sale_id,shift,paid_amount,payment_method,nullif(trim(payment_reference),''),auth.uid());
  insert into public.receipts(sale_id,issued_by) values(v_sale_id,auth.uid()) returning * into receipt;
  if paid_amount<>0 then insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id)
    values(shift,'sale',paid_amount,payment_method,'Venta de servicios · comprobante #'||receipt.number,auth.uid(),v_sale_id); end if;
  insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount)
  select coalesce(si.barber_id,si.recommended_by_barber_id),si.id,case when si.item_type='product' then 'product_incentive' else 'service_commission' end,
    si.quantity*si.unit_price_snapshot,si.commission_percent_snapshot,si.commission_amount
  from public.sale_items si where si.sale_id=v_sale_id and si.commission_amount>0;
  if target_appointment_id is not null then
    update public.appointments set status='completed',updated_at=now() where id=target_appointment_id;
    delete from public.appointment_checkout_details where appointment_id=target_appointment_id;
  end if;
  perform public.process_sale_loyalty(v_sale_id);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'service_group_sale_paid','sales',v_sale_id::text,
    jsonb_build_object('services',service_count,'custom_charges',jsonb_array_length(coalesce(custom_charges,'[]'::jsonb)),'list_total',list_amount,'paid_total',paid_amount));
  return jsonb_build_object('sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'claim_code',claim,'list_total',list_amount,
    'discount',discount_amount,'paid_total',paid_amount,'barber_commission',commission_total,'business_share',business_amount,
    'barber_discount_share',barber_discount,'business_discount_share',business_discount);
end; $$;

create or replace function public.register_counter_product_sale_v2(
  target_product_id uuid,product_quantity integer,recommended_by_barber_id uuid,manual_discount numeric,
  payment_method text,payment_reference text,promotion_code text
) returns jsonb language plpgsql security definer set search_path='extensions'
as $$ declare
  shift uuid; v_sale_id uuid; product public.products%rowtype; promotion public.promotions%rowtype;
  receipt public.receipts%rowtype; qty int:=greatest(coalesce(product_quantity,1),1);
  list_amount numeric; discount_amount numeric:=greatest(coalesce(manual_discount,0),0); promotion_discount numeric:=0;
  paid_amount numeric; commission_total numeric; business_amount numeric; barber_discount numeric; business_discount numeric;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_method not in ('cash','qr','transfer','card','other') then raise exception 'Forma de pago no permitida'; end if;
  if qty>100 then raise exception 'Cantidad de producto no valida'; end if;
  select id into shift from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift is null then raise exception 'Debes abrir caja antes de cobrar'; end if;
  select * into product from public.products where id=target_product_id and status='active' for update;
  if product.id is null or product.stock<qty then raise exception 'Producto sin stock suficiente'; end if;
  if recommended_by_barber_id is not null and not exists(select 1 from public.barber_profiles where id=recommended_by_barber_id and active) then raise exception 'Peluquero no disponible'; end if;

  insert into public.sales(shift_id,source,status,created_by) values(shift,'walk_in','draft',auth.uid()) returning id into v_sale_id;
  update public.products set stock=stock-qty where id=product.id;
  list_amount:=product.price*qty;
  insert into public.sale_items(sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
  values(v_sale_id,'product',product.id,recommended_by_barber_id,product.name,false,qty,product.price,0,0);
  if nullif(trim(promotion_code),'') is not null then
    select * into promotion from public.promotions where lower(code)=lower(trim(promotion_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) and (usage_limit is null or usage_count<usage_limit) for update;
    if not found then raise exception 'Promocion invalida, vencida o agotada'; end if;
    promotion_discount:=case when promotion.discount_type='percent' then round(list_amount*promotion.discount_value/100,2) else promotion.discount_value end;
    if promotion.max_discount is not null then promotion_discount:=least(promotion_discount,promotion.max_discount); end if;
    discount_amount:=discount_amount+promotion_discount;
    update public.promotions set usage_count=usage_count+1 where id=promotion.id;
  end if;
  discount_amount:=least(discount_amount,list_amount); paid_amount:=list_amount-discount_amount;
  update public.sales set status='paid',list_total=list_amount,discount_total=discount_amount,paid_total=paid_amount,paid_at=now(),updated_at=now()
  where id=v_sale_id returning barber_commission_total,business_share,barber_discount_share,business_discount_share
  into commission_total,business_amount,barber_discount,business_discount;
  insert into public.payments(sale_id,shift_id,amount,method,reference,confirmed_by)
  values(v_sale_id,shift,paid_amount,payment_method,nullif(trim(payment_reference),''),auth.uid());
  insert into public.receipts(sale_id,issued_by) values(v_sale_id,auth.uid()) returning * into receipt;
  if paid_amount<>0 then insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id)
    values(shift,'sale',paid_amount,payment_method,'Venta de producto · comprobante #'||receipt.number,auth.uid(),v_sale_id); end if;
  insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount)
  select si.recommended_by_barber_id,si.id,'product_incentive',si.quantity*si.unit_price_snapshot,si.commission_percent_snapshot,si.commission_amount
  from public.sale_items si where si.sale_id=v_sale_id and si.recommended_by_barber_id is not null and si.commission_amount>0;
  update public.sales set loyalty_processed_at=now(),updated_at=now() where id=v_sale_id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'product_receipt_paid','sales',v_sale_id::text,
    jsonb_build_object('product_id',product.id,'quantity',qty,'list_total',list_amount,'paid_total',paid_amount));
  return jsonb_build_object('sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'list_total',list_amount,
    'discount',discount_amount,'paid_total',paid_amount,'barber_commission',commission_total,'business_share',business_amount,
    'barber_discount_share',barber_discount,'business_discount_share',business_discount);
end; $$;

create or replace function public.process_sale_loyalty(target_sale uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare sale public.sales%rowtype; settings public.loyalty_settings%rowtype; primary_barber uuid;
  referrer uuid; paid_count int; streak public.customer_barber_streaks%rowtype; next_visits int; item_group record;
begin
  select * into sale from public.sales where id=target_sale and status='paid' for update;
  if not found or sale.client_id is null or sale.loyalty_processed_at is not null then return; end if;
  select * into settings from public.loyalty_settings where id=true;
  select si.barber_id into primary_barber from public.sale_items si
  where si.sale_id=sale.id and si.item_type='service' and si.earns_loyalty and si.barber_id is not null
  order by si.created_at limit 1;

  if primary_barber is not null then
    perform public.post_customer_barber_points(sale.client_id,primary_barber,settings.welcome_points,'earn','Bienvenida con tu peluquero','welcome:'||sale.client_id||':'||primary_barber,'sale',sale.id);
  end if;
  for item_group in
    select barber_id,count(*)::int as item_count from public.sale_items
    where sale_id=sale.id and item_type='service' and earns_loyalty and barber_id is not null group by barber_id
  loop
    perform public.post_customer_barber_points(sale.client_id,item_group.barber_id,settings.service_points*item_group.item_count,'earn','Servicio completado con este peluquero','service-sale:'||sale.id||':'||item_group.barber_id,'sale',sale.id);
  end loop;

  if primary_barber is not null and nullif(trim(sale.referral_code),'') is not null then
    select id into referrer from public.profiles where lower(referral_code)=lower(trim(sale.referral_code));
    if referrer is not null and referrer<>sale.client_id then
      select count(distinct s.id) into paid_count from public.sales s join public.sale_items si on si.sale_id=s.id
      where s.client_id=sale.client_id and s.status='paid' and si.item_type='service' and si.earns_loyalty;
      if paid_count=1 then
        insert into public.referrals(referrer_id,referred_id,first_sale_id,status,qualified_at)
        values(referrer,sale.client_id,sale.id,'rewarded',now()) on conflict(referred_id) do nothing;
        if found then
          perform public.post_customer_barber_points(referrer,primary_barber,settings.referral_referrer_points,'earn','Cliente referido','referrer:'||sale.client_id||':'||primary_barber,'referral',sale.id);
          perform public.post_customer_barber_points(sale.client_id,primary_barber,settings.referral_referred_points,'earn','Bienvenida por referido','referred:'||sale.client_id||':'||primary_barber,'referral',sale.id);
        end if;
      end if;
    end if;
  end if;

  if primary_barber is not null then
    select * into streak from public.customer_barber_streaks where user_id=sale.client_id and barber_id=primary_barber for update;
    if not found then next_visits:=1;
    elsif streak.last_visit_at is null or streak.last_visit_at<now()-make_interval(days=>settings.streak_days) then next_visits:=1;
    else next_visits:=streak.current_visits+1; end if;
    insert into public.customer_barber_streaks(user_id,barber_id,current_visits,best_visits,last_visit_at)
    values(sale.client_id,primary_barber,next_visits,next_visits,now())
    on conflict(user_id,barber_id) do update set current_visits=next_visits,
      best_visits=greatest(public.customer_barber_streaks.best_visits,next_visits),last_visit_at=now(),updated_at=now();
    if next_visits>=settings.streak_visits then
      perform public.post_customer_barber_points(sale.client_id,primary_barber,settings.streak_bonus_points,'earn','Racha con este peluquero completada','streak:'||sale.id||':'||primary_barber,'sale',sale.id);
      update public.customer_barber_streaks set current_visits=0,updated_at=now() where user_id=sale.client_id and barber_id=primary_barber;
    end if;
  end if;
  update public.sales set loyalty_processed_at=now(),updated_at=now() where id=sale.id;
end; $$;

revoke all on function public.register_counter_service_sale_v4(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,numeric,text,text,text,text,text) from public;
revoke all on function public.register_counter_product_sale_v2(uuid,integer,uuid,numeric,text,text,text) from public;
grant execute on function public.register_counter_service_sale_v4(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,numeric,text,text,text,text,text) to authenticated;
grant execute on function public.register_counter_product_sale_v2(uuid,integer,uuid,numeric,text,text,text) to authenticated;

