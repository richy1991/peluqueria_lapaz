-- Nuevas reglas de negocio: descuentos compartidos, fidelidad por peluquero,
-- comision global de productos y galerias de hasta tres imagenes.

alter table public.loyalty_settings
  add column if not exists product_sales_commission_percent numeric(5,2) not null default 10
  check (product_sales_commission_percent between 0 and 100);

alter table public.products
  add column if not exists brand text,
  add column if not exists presentation text,
  add column if not exists image_paths text[] not null default '{}';

alter table public.gallery_posts
  add column if not exists image_paths text[] not null default '{}';

update public.products
set image_paths = array[image_path]
where image_path is not null and cardinality(image_paths) = 0;

update public.gallery_posts
set image_paths = array[image_path]
where image_path is not null and cardinality(image_paths) = 0;

alter table public.products drop constraint if exists products_max_three_images;
alter table public.products add constraint products_max_three_images
  check (cardinality(image_paths) <= 3);
alter table public.gallery_posts drop constraint if exists gallery_posts_max_three_images;
alter table public.gallery_posts add constraint gallery_posts_max_three_images
  check (cardinality(image_paths) between 1 and 3);

alter table public.sales
  add column if not exists barber_discount_share numeric(12,2) not null default 0,
  add column if not exists business_discount_share numeric(12,2) not null default 0;

alter table public.loyalty_transactions
  add column if not exists barber_id uuid references public.barber_profiles(id);
alter table public.reward_redemptions
  add column if not exists barber_id uuid references public.barber_profiles(id);

create table if not exists public.customer_barber_loyalty_accounts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0,
  lifetime_redeemed integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, barber_id)
);

create table if not exists public.customer_barber_streaks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  current_visits integer not null default 0,
  best_visits integer not null default 0,
  last_visit_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, barber_id)
);

alter table public.customer_barber_loyalty_accounts enable row level security;
alter table public.customer_barber_streaks enable row level security;

create policy "Customers read own barber balances"
  on public.customer_barber_loyalty_accounts for select
  using (user_id = auth.uid() or public.is_admin());
create policy "Customers read own barber streaks"
  on public.customer_barber_streaks for select
  using (user_id = auth.uid() or public.is_admin());

-- Los saldos anteriores se asignan al ultimo profesional que realmente atendio
-- al cliente. El libro global anterior se conserva como respaldo historico.
with last_barber as (
  select distinct on (s.client_id)
    s.client_id as user_id,
    si.barber_id
  from public.sales s
  join public.sale_items si on si.sale_id = s.id and si.item_type = 'service'
  where s.client_id is not null and s.status = 'paid' and si.barber_id is not null
  order by s.client_id, s.paid_at desc nulls last, s.created_at desc
)
insert into public.customer_barber_loyalty_accounts(user_id,barber_id,balance,lifetime_earned,lifetime_redeemed)
select a.user_id,l.barber_id,a.balance,a.lifetime_earned,a.lifetime_redeemed
from public.loyalty_accounts a
join last_barber l on l.user_id=a.user_id
where a.balance > 0 or a.lifetime_earned > 0
on conflict(user_id,barber_id) do nothing;

with last_barber as (
  select distinct on (s.client_id)
    s.client_id as user_id,
    si.barber_id
  from public.sales s
  join public.sale_items si on si.sale_id = s.id and si.item_type = 'service'
  where s.client_id is not null and s.status = 'paid' and si.barber_id is not null
  order by s.client_id, s.paid_at desc nulls last, s.created_at desc
)
update public.loyalty_transactions lt
set barber_id=lb.barber_id
from last_barber lb
where lt.user_id=lb.user_id and lt.barber_id is null;

create or replace function public.set_product_sales_commission()
returns trigger language plpgsql security definer set search_path=''
as $$ declare rate numeric;
begin
  if new.item_type='product' and new.recommended_by_barber_id is not null then
    select product_sales_commission_percent into rate from public.loyalty_settings where id=true;
    rate:=coalesce(rate,0);
    new.commission_percent_snapshot:=rate;
    new.commission_amount:=round(new.quantity*new.unit_price_snapshot*rate/100,2);
  end if;
  return new;
end; $$;

drop trigger if exists sale_items_product_commission on public.sale_items;
create trigger sale_items_product_commission
  before insert on public.sale_items
  for each row execute function public.set_product_sales_commission();

create or replace function public.apply_equitable_sale_discount()
returns trigger language plpgsql security definer set search_path=''
as $$ declare gross_commission numeric; net_commission numeric; target_barber_share numeric; factor numeric;
begin
  if new.status='paid' and old.status<>'paid' then
    select coalesce(sum(commission_amount),0) into gross_commission
    from public.sale_items where sale_id=new.id;

    new.discount_total:=least(greatest(coalesce(new.discount_total,0),0),new.list_total);
    new.paid_total:=new.list_total-new.discount_total;

    if new.discount_total>=new.list_total then
      target_barber_share:=gross_commission;
    else
      target_barber_share:=least(round(new.discount_total/2,2),gross_commission);
    end if;

    factor:=case when gross_commission>0 then (gross_commission-target_barber_share)/gross_commission else 0 end;
    update public.sale_items
    set commission_amount=round(commission_amount*factor,2)
    where sale_id=new.id and commission_amount<>0;

    select coalesce(sum(commission_amount),0) into net_commission
    from public.sale_items where sale_id=new.id;
    new.barber_commission_total:=net_commission;

    if new.discount_total>=new.list_total then
      new.barber_commission_total:=0;
      new.business_share:=0;
    else
      new.business_share:=greatest(new.paid_total-new.barber_commission_total,0);
    end if;
    new.barber_discount_share:=gross_commission-new.barber_commission_total;
    new.business_discount_share:=new.discount_total-new.barber_discount_share;
  end if;
  return new;
end; $$;

drop trigger if exists sales_equitable_discount on public.sales;
create trigger sales_equitable_discount
  before update on public.sales
  for each row execute function public.apply_equitable_sale_discount();

create or replace function public.register_counter_sale_v3(
  target_appointment_id uuid,target_client_id uuid,guest_name text,guest_phone text,
  target_barber_id uuid,target_service_id uuid,target_extra_service_id uuid,target_product_id uuid,product_quantity integer,
  recommended_by_barber_id uuid,manual_discount numeric,payment_method text,payment_reference text,
  provided_referral_code text,redemption_code text,promotion_code text
) returns jsonb language plpgsql security definer set search_path='extensions'
as $$ declare shift uuid; v_sale_id uuid; service public.services%rowtype; extra public.services%rowtype;
  barber public.barber_profiles%rowtype; product public.products%rowtype; appt public.appointments%rowtype;
  checkout public.appointment_checkout_details%rowtype; list_amount numeric:=0; commission_total numeric:=0;
  discount_amount numeric:=greatest(coalesce(manual_discount,0),0); reward_discount numeric:=0; promotion_discount numeric:=0;
  redemption public.reward_redemptions%rowtype; reward public.rewards%rowtype; promotion public.promotions%rowtype;
  paid_amount numeric; business_amount numeric; barber_discount numeric; business_discount numeric;
  receipt public.receipts%rowtype; claim text; qty int:=greatest(coalesce(product_quantity,1),1);
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_method not in ('cash','qr','transfer','card','other') then raise exception 'Forma de pago no permitida'; end if;
  select id into shift from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift is null then raise exception 'Debes abrir caja antes de cobrar'; end if;
  if target_appointment_id is not null then
    select * into appt from public.appointments where id=target_appointment_id for update;
    if not found or appt.status not in ('confirmed','in_progress','pending_payment') then raise exception 'La cita no puede cobrarse'; end if;
    select * into checkout from public.appointment_checkout_details where appointment_id=appt.id;
    target_client_id:=appt.client_id; target_barber_id:=appt.barber_id;
    target_service_id:=coalesce(target_service_id,checkout.actual_service_id,appt.service_id);
    target_extra_service_id:=coalesce(target_extra_service_id,checkout.extra_service_id);
    target_product_id:=coalesce(target_product_id,checkout.suggested_product_id);
    if target_product_id=checkout.suggested_product_id then qty:=coalesce(checkout.product_quantity,qty); end if;
  end if;
  if target_service_id is null and target_extra_service_id is null and target_product_id is null then raise exception 'Agrega al menos un servicio o producto'; end if;
  if target_client_id is null and nullif(trim(guest_name),'') is null then raise exception 'Identifica al cliente o registra un nombre de invitado'; end if;
  claim:=case when target_client_id is null then upper(substr(encode(gen_random_bytes(8),'hex'),1,10)) else null end;
  insert into public.sales(shift_id,appointment_id,client_id,guest_name,guest_phone,referral_code,source,status,claim_code,created_by)
  values(shift,target_appointment_id,target_client_id,nullif(trim(guest_name),''),nullif(trim(guest_phone),''),nullif(trim(provided_referral_code),''),case when target_appointment_id is null then 'walk_in' else 'appointment' end,'draft',claim,auth.uid()) returning id into v_sale_id;

  if target_service_id is not null then
    select * into service from public.services where id=target_service_id and status='active';
    select * into barber from public.barber_profiles where id=target_barber_id and active;
    if service.id is null or barber.id is null then raise exception 'Servicio o peluquero no disponible'; end if;
    list_amount:=list_amount+service.price;
    insert into public.sale_items(sale_id,item_type,service_id,barber_id,name_snapshot,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'service',service.id,barber.id,service.name,1,service.price,barber.commission_percent,round(service.price*barber.commission_percent/100,2));
  end if;
  if target_extra_service_id is not null then
    select * into extra from public.services where id=target_extra_service_id and status='active';
    if extra.id is null or barber.id is null then raise exception 'Servicio extra o peluquero no disponible'; end if;
    list_amount:=list_amount+extra.price;
    insert into public.sale_items(sale_id,item_type,service_id,barber_id,name_snapshot,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'service',extra.id,barber.id,extra.name,1,extra.price,barber.commission_percent,round(extra.price*barber.commission_percent/100,2));
  end if;
  if target_product_id is not null then
    select * into product from public.products where id=target_product_id and status='active' for update;
    if product.id is null or product.stock<qty then raise exception 'Producto sin stock suficiente'; end if;
    update public.products set stock=stock-qty where id=product.id;
    list_amount:=list_amount+product.price*qty;
    insert into public.sale_items(sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'product',product.id,recommended_by_barber_id,product.name,qty,product.price,0,0);
    if target_client_id is not null then update public.product_reservations set status='collected',updated_at=now() where id=(select id from public.product_reservations where client_id=target_client_id and product_id=product.id and status='reserved' order by created_at limit 1); end if;
  end if;

  if nullif(trim(redemption_code),'') is not null then
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
  if paid_amount<>0 then
    insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id)
    values(shift,'sale',paid_amount,payment_method,'Venta · comprobante #'||receipt.number,auth.uid(),v_sale_id);
  end if;
  insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount)
  select coalesce(si.barber_id,si.recommended_by_barber_id),si.id,case when si.item_type='service' then 'service_commission' else 'product_incentive' end,
    si.quantity*si.unit_price_snapshot,si.commission_percent_snapshot,si.commission_amount
  from public.sale_items si where si.sale_id=v_sale_id and si.commission_amount>0;
  if target_appointment_id is not null then
    update public.appointments set status='completed',updated_at=now() where id=target_appointment_id;
    delete from public.appointment_checkout_details where appointment_id=target_appointment_id;
  end if;
  perform public.process_sale_loyalty(v_sale_id);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'sale_paid','sales',v_sale_id::text,
    jsonb_build_object('list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,'barber_commission',commission_total,'barber_discount_share',barber_discount,'business_discount_share',business_discount));
  return jsonb_build_object('sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'claim_code',claim,'list_total',list_amount,
    'discount',discount_amount,'paid_total',paid_amount,'barber_commission',commission_total,'business_share',business_amount,
    'barber_discount_share',barber_discount,'business_discount_share',business_discount);
end; $$;

-- Mantiene compatibles las versiones instaladas de la PWA durante el despliegue.
create or replace function public.register_counter_sale_v2(
  target_appointment_id uuid,target_client_id uuid,guest_name text,guest_phone text,
  target_barber_id uuid,target_service_id uuid,target_extra_service_id uuid,target_product_id uuid,product_quantity integer,
  recommended_by_barber_id uuid,manual_discount numeric,payment_method text,payment_reference text,
  provided_referral_code text,redemption_code text,promotion_code text
) returns jsonb language sql security definer set search_path=''
as $$ select public.register_counter_sale_v3($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16); $$;

create or replace function public.post_customer_barber_points(
  target_user uuid,target_barber uuid,point_amount integer,transaction_kind text,
  transaction_reason text,unique_key text,source_kind text default null,source_uuid uuid default null
) returns void language plpgsql security definer set search_path=''
as $$ declare current_balance integer; expiry timestamptz; settings public.loyalty_settings%rowtype;
begin
  if point_amount=0 or target_barber is null then return; end if;
  if exists(select 1 from public.loyalty_transactions where idempotency_key=unique_key) then return; end if;
  select * into settings from public.loyalty_settings where id=true;
  insert into public.customer_barber_loyalty_accounts(user_id,barber_id)
  values(target_user,target_barber) on conflict do nothing;
  select balance into current_balance from public.customer_barber_loyalty_accounts
  where user_id=target_user and barber_id=target_barber for update;
  if current_balance+point_amount<0 then raise exception 'Saldo de puntos insuficiente con este peluquero'; end if;
  expiry:=case when point_amount>0 then now()+make_interval(months=>settings.points_expiry_months) else null end;
  insert into public.loyalty_transactions(user_id,barber_id,points,kind,reason,idempotency_key,source_type,source_id,expires_at,created_by)
  values(target_user,target_barber,point_amount,transaction_kind,transaction_reason,unique_key,source_kind,source_uuid,expiry,auth.uid());
  update public.customer_barber_loyalty_accounts
  set balance=balance+point_amount,
      lifetime_earned=lifetime_earned+greatest(point_amount,0),
      lifetime_redeemed=lifetime_redeemed+greatest(-point_amount,0),updated_at=now()
  where user_id=target_user and barber_id=target_barber;
end; $$;

create or replace function public.process_sale_loyalty(target_sale uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare sale public.sales%rowtype; settings public.loyalty_settings%rowtype; primary_barber uuid;
  referrer uuid; paid_count int; streak public.customer_barber_streaks%rowtype; next_visits int; item_group record;
begin
  select * into sale from public.sales where id=target_sale and status='paid' for update;
  if not found or sale.client_id is null or sale.loyalty_processed_at is not null then return; end if;
  select * into settings from public.loyalty_settings where id=true;
  select coalesce(si.barber_id,si.recommended_by_barber_id) into primary_barber
  from public.sale_items si where si.sale_id=sale.id and coalesce(si.barber_id,si.recommended_by_barber_id) is not null
  order by case when si.item_type='service' then 0 else 1 end,si.created_at limit 1;

  if primary_barber is not null then
    perform public.post_customer_barber_points(sale.client_id,primary_barber,settings.welcome_points,'earn','Bienvenida con tu peluquero','welcome:'||sale.client_id||':'||primary_barber,'sale',sale.id);
  end if;

  for item_group in
    select barber_id,count(*)::int as item_count from public.sale_items
    where sale_id=sale.id and item_type='service' and barber_id is not null group by barber_id
  loop
    perform public.post_customer_barber_points(sale.client_id,item_group.barber_id,settings.service_points*item_group.item_count,'earn','Servicio completado con este peluquero','service-sale:'||sale.id||':'||item_group.barber_id,'sale',sale.id);
  end loop;

  for item_group in
    select recommended_by_barber_id as barber_id,coalesce(sum(quantity*unit_price_snapshot),0) as product_total
    from public.sale_items where sale_id=sale.id and item_type='product' and recommended_by_barber_id is not null
    group by recommended_by_barber_id
  loop
    if item_group.product_total>=settings.product_amount_per_point then
      perform public.post_customer_barber_points(sale.client_id,item_group.barber_id,floor(item_group.product_total/settings.product_amount_per_point)::int,'earn','Compra de productos recomendados','product-sale:'||sale.id||':'||item_group.barber_id,'sale',sale.id);
    end if;
  end loop;

  if primary_barber is not null and nullif(trim(sale.referral_code),'') is not null then
    select id into referrer from public.profiles where lower(referral_code)=lower(trim(sale.referral_code));
    if referrer is not null and referrer<>sale.client_id then
      select count(*) into paid_count from public.sales where client_id=sale.client_id and status='paid';
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
      update public.customer_barber_streaks set current_visits=0,updated_at=now()
      where user_id=sale.client_id and barber_id=primary_barber;
    end if;
  end if;
  update public.sales set loyalty_processed_at=now(),updated_at=now() where id=sale.id;
end; $$;

create or replace function public.request_reward_redemption(target_reward_id uuid,target_barber_id uuid)
returns text language plpgsql security definer set search_path=''
as $$ declare reward public.rewards%rowtype; result_code text; redemption_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesion para canjear'; end if;
  select * into reward from public.rewards where id=target_reward_id and active
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
  if not found then raise exception 'Recompensa no disponible'; end if;
  if not exists(select 1 from public.customer_barber_loyalty_accounts
    where user_id=auth.uid() and barber_id=target_barber_id and balance>=reward.points_cost) then
    raise exception 'No tienes puntos suficientes con este peluquero';
  end if;
  insert into public.reward_redemptions(user_id,barber_id,reward_id,points_spent)
  values(auth.uid(),target_barber_id,reward.id,reward.points_cost) returning id,code into redemption_id,result_code;
  perform public.post_customer_barber_points(auth.uid(),target_barber_id,-reward.points_cost,'redeem','Canje solicitado','redemption:'||redemption_id,'reward',reward.id);
  return result_code;
end; $$;

create or replace function public.cancel_reward_redemption(target_redemption_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare redemption public.reward_redemptions%rowtype;
begin
  select * into redemption from public.reward_redemptions where id=target_redemption_id and user_id=auth.uid() and status='pending' for update;
  if not found then raise exception 'El canje ya no puede cancelarse'; end if;
  update public.reward_redemptions set status='canceled' where id=redemption.id;
  if redemption.barber_id is not null then
    perform public.post_customer_barber_points(auth.uid(),redemption.barber_id,redemption.points_spent,'reverse','Devolucion por canje cancelado','cancel-redemption:'||redemption.id,'reward',redemption.reward_id);
  else
    perform public.post_loyalty_points(auth.uid(),redemption.points_spent,'reverse','Devolucion por canje cancelado','cancel-redemption:'||redemption.id,'reward',redemption.reward_id);
  end if;
end; $$;

create or replace function public.refresh_my_barber_loyalty()
returns integer language plpgsql security definer set search_path=''
as $$ declare account record; expired_earned integer; spent integer; already_expired integer; amount integer; total_expired integer:=0;
begin
  if auth.uid() is null then raise exception 'Inicia sesion para consultar tus puntos'; end if;
  for account in select * from public.customer_barber_loyalty_accounts where user_id=auth.uid() for update loop
    select coalesce(sum(points),0) into expired_earned from public.loyalty_transactions
      where user_id=auth.uid() and barber_id=account.barber_id and points>0 and expires_at<=now();
    select coalesce(-sum(points),0) into spent from public.loyalty_transactions
      where user_id=auth.uid() and barber_id=account.barber_id and points<0 and kind<>'expire';
    select coalesce(-sum(points),0) into already_expired from public.loyalty_transactions
      where user_id=auth.uid() and barber_id=account.barber_id and kind='expire';
    amount:=least(account.balance,greatest(expired_earned-spent-already_expired,0));
    if amount>0 then
      perform public.post_customer_barber_points(auth.uid(),account.barber_id,-amount,'expire','Puntos vencidos','expiry:'||auth.uid()||':'||account.barber_id||':'||expired_earned,null,null);
      total_expired:=total_expired+amount;
    end if;
  end loop;
  return total_expired;
end; $$;

create or replace function public.admin_adjust_barber_loyalty(target_email text,target_barber_id uuid,point_delta integer,adjustment_reason text)
returns void language plpgsql security definer set search_path=''
as $$ declare target_user uuid;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if point_delta=0 or nullif(trim(adjustment_reason),'') is null then raise exception 'Indica puntos y motivo'; end if;
  select id into target_user from public.profiles where lower(email)=lower(trim(target_email));
  if target_user is null then raise exception 'La cuenta debe iniciar sesion al menos una vez'; end if;
  if not exists(select 1 from public.barber_profiles where id=target_barber_id and active) then raise exception 'Peluquero no disponible'; end if;
  perform public.post_customer_barber_points(target_user,target_barber_id,point_delta,'adjust',trim(adjustment_reason),'admin-adjust:'||gen_random_uuid(),null,null);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data)
  values(auth.uid(),'barber_loyalty_adjusted','profiles',target_user::text,jsonb_build_object('barber_id',target_barber_id,'points',point_delta,'reason',trim(adjustment_reason)));
end; $$;

create or replace function public.validate_redemption_barber()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.sale_id is not null and new.barber_id is not null and (old.sale_id is null or old.sale_id<>new.sale_id) then
    if not exists(select 1 from public.sale_items si where si.sale_id=new.sale_id
      and coalesce(si.barber_id,si.recommended_by_barber_id)=new.barber_id) then
      raise exception 'Este canje pertenece a los puntos acumulados con otro peluquero';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.reverse_counter_sale(target_sale_id uuid,reversal_reason text)
returns void language plpgsql security definer set search_path=''
as $$ declare sale public.sales%rowtype; shift uuid; item record; earning record; account_balance integer; reversal_points integer;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if nullif(trim(reversal_reason),'') is null then raise exception 'El motivo es obligatorio'; end if;
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
    values(earning.barber_id,earning.sale_item_id,'reversal',earning.base_amount,earning.rate_percent,-earning.amount,'reversed')
    on conflict(sale_item_id,kind) do nothing;
  end loop;
  for earning in select * from public.loyalty_transactions where source_id=sale.id and points>0 and kind='earn' loop
    if earning.barber_id is not null then
      select balance into account_balance from public.customer_barber_loyalty_accounts where user_id=earning.user_id and barber_id=earning.barber_id for update;
      reversal_points:=least(coalesce(account_balance,0),earning.points);
      if reversal_points>0 then perform public.post_customer_barber_points(earning.user_id,earning.barber_id,-reversal_points,'reverse','Reversion: '||trim(reversal_reason),'reverse-sale:'||sale.id||':'||earning.id,'sale',sale.id); end if;
    else
      select balance into account_balance from public.loyalty_accounts where user_id=earning.user_id for update;
      reversal_points:=least(coalesce(account_balance,0),earning.points);
      if reversal_points>0 then perform public.post_loyalty_points(earning.user_id,-reversal_points,'reverse','Reversion: '||trim(reversal_reason),'reverse-sale:'||sale.id||':'||earning.id,'sale',sale.id); end if;
    end if;
  end loop;
  for earning in select * from public.reward_redemptions where sale_id=sale.id and status='used' loop
    if earning.barber_id is not null then
      perform public.post_customer_barber_points(earning.user_id,earning.barber_id,earning.points_spent,'reverse','Devolucion de canje por venta revertida','refund-redemption:'||earning.id,'reward',earning.reward_id);
    else
      perform public.post_loyalty_points(earning.user_id,earning.points_spent,'reverse','Devolucion de canje por venta revertida','refund-redemption:'||earning.id,'reward',earning.reward_id);
    end if;
  end loop;
  update public.reward_redemptions set status='canceled',sale_id=null,used_at=null where sale_id=sale.id and status='used';
  update public.payments set status='refunded' where sale_id=sale.id and status='confirmed';
  insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by)
  select shift,'refund',-sale.paid_total,method,'Devolucion: '||trim(reversal_reason),auth.uid() from public.payments where sale_id=sale.id order by created_at limit 1;
  update public.sales set status='refunded',updated_at=now() where id=sale.id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'sale_refunded','sales',sale.id::text,jsonb_build_object('reason',trim(reversal_reason),'amount',sale.paid_total));
end; $$;

drop trigger if exists reward_redemption_barber_match on public.reward_redemptions;
create trigger reward_redemption_barber_match before update of sale_id on public.reward_redemptions
for each row execute function public.validate_redemption_barber();

create or replace function public.barber_publish_gallery_v2(
  post_title text,post_description text,post_image_paths text[],post_source_type text default 'own_work',
  post_source_url text default null,has_client_consent boolean default false
) returns uuid language plpgsql security definer set search_path=''
as $$ declare barber_id uuid; post_id uuid; clean_title text:=trim(coalesce(post_title,''));
  clean_source text:=lower(trim(coalesce(post_source_type,'own_work'))); clean_url text:=nullif(trim(coalesce(post_source_url,'')),''); image_path text;
begin
  select id into barber_id from public.barber_profiles where user_id=auth.uid() and active;
  if barber_id is null then raise exception 'No existe un perfil de peluquero activo para esta cuenta'; end if;
  if length(clean_title)<2 or length(clean_title)>120 then raise exception 'El titulo debe tener entre 2 y 120 caracteres'; end if;
  if cardinality(post_image_paths) not between 1 and 3 then raise exception 'Publica entre 1 y 3 imagenes'; end if;
  foreach image_path in array post_image_paths loop
    if image_path is null or image_path not like ('barbers/'||auth.uid()::text||'/%') then raise exception 'Una imagen no pertenece a tu carpeta personal'; end if;
  end loop;
  if clean_source not in ('own_work','reference') then raise exception 'El tipo de publicacion no es valido'; end if;
  if clean_source='own_work' and not has_client_consent then raise exception 'Debes confirmar la autorizacion del cliente'; end if;
  if clean_source='reference' and (clean_url is null or clean_url !~* '^https?://') then raise exception 'Una referencia debe incluir el enlace de la fuente'; end if;
  insert into public.gallery_posts(title,description,image_path,image_paths,barber_id,status,client_consent,consent_date,created_by,source_type,source_url)
  values(clean_title,nullif(trim(coalesce(post_description,'')),''),post_image_paths[1],post_image_paths,barber_id,'published',has_client_consent,
    case when has_client_consent then now() else null end,auth.uid(),clean_source,clean_url) returning id into post_id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'barber_gallery_published','gallery_posts',post_id::text,jsonb_build_object('source_type',clean_source,'images',cardinality(post_image_paths)));
  return post_id;
end; $$;

revoke execute on function public.request_reward_redemption(uuid) from authenticated;
revoke execute on function public.admin_adjust_loyalty(text,integer,text) from authenticated;
revoke execute on function public.register_counter_sale(uuid,uuid,text,text,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text) from authenticated;
revoke execute on function public.barber_publish_gallery(text,text,text,text,text,boolean) from authenticated;
revoke all on function public.post_customer_barber_points(uuid,uuid,integer,text,text,text,text,uuid) from public;
revoke all on function public.refresh_my_barber_loyalty() from public;
revoke all on function public.request_reward_redemption(uuid,uuid) from public;
revoke all on function public.admin_adjust_barber_loyalty(text,uuid,integer,text) from public;
revoke all on function public.barber_publish_gallery_v2(text,text,text[],text,text,boolean) from public;
revoke all on function public.register_counter_sale_v3(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text) from public;
grant execute on function public.refresh_my_barber_loyalty() to authenticated;
grant execute on function public.request_reward_redemption(uuid,uuid) to authenticated;
grant execute on function public.admin_adjust_barber_loyalty(text,uuid,integer,text) to authenticated;
grant execute on function public.barber_publish_gallery_v2(text,text,text[],text,text,boolean) to authenticated;
grant execute on function public.register_counter_sale_v3(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text) to authenticated;
