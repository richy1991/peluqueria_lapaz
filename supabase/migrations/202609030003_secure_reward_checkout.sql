-- Canjes seguros: cotización en servidor, descuento por línea, snapshots e idempotencia.

alter table public.loyalty_settings
  add column if not exists reward_reservation_minutes integer not null default 10
  check (reward_reservation_minutes between 2 and 60);

alter table public.rewards
  add column if not exists usage_count integer not null default 0
  check (usage_count >= 0);

update public.rewards r set usage_count=greatest(r.usage_count,used.total)
from (select reward_id,count(*)::integer total from public.reward_redemptions where status='used' group by reward_id) used
where used.reward_id=r.id;

alter table public.reward_redemptions
  add column if not exists reward_name_snapshot text,
  add column if not exists reward_type_snapshot text,
  add column if not exists reward_value_snapshot numeric(12,2),
  add column if not exists max_discount_snapshot numeric(12,2),
  add column if not exists service_id_snapshot uuid references public.services(id),
  add column if not exists idempotency_key text,
  add column if not exists canceled_at timestamptz;

update public.reward_redemptions rr
set reward_name_snapshot = coalesce(rr.reward_name_snapshot,r.name),
    reward_type_snapshot = coalesce(rr.reward_type_snapshot,r.reward_type),
    reward_value_snapshot = coalesce(rr.reward_value_snapshot,r.reward_value),
    max_discount_snapshot = coalesce(rr.max_discount_snapshot,r.max_discount),
    service_id_snapshot = coalesce(rr.service_id_snapshot,r.service_id)
from public.rewards r
where r.id=rr.reward_id;

create unique index if not exists reward_redemptions_idempotency_unique
  on public.reward_redemptions(idempotency_key) where idempotency_key is not null;

alter table public.sale_items
  add column if not exists discount_amount numeric(12,2) not null default 0 check(discount_amount>=0),
  add column if not exists barber_discount_share numeric(12,2) not null default 0 check(barber_discount_share>=0),
  add column if not exists business_discount_share numeric(12,2) not null default 0 check(business_discount_share>=0);

alter table public.sales add column if not exists checkout_key text;
create unique index if not exists sales_cashier_checkout_key_unique
  on public.sales(created_by,checkout_key) where checkout_key is not null;

create table if not exists public.discount_applications (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  source_type text not null check(source_type in ('reward','promotion','manual')),
  source_id uuid,
  barber_id uuid references public.barber_profiles(id),
  name_snapshot text not null,
  rule_type_snapshot text not null,
  rule_value_snapshot numeric(12,2) not null,
  max_discount_snapshot numeric(12,2),
  eligible_base numeric(12,2) not null check(eligible_base>=0),
  discount_amount numeric(12,2) not null check(discount_amount>=0),
  barber_discount_share numeric(12,2) not null default 0 check(barber_discount_share>=0),
  business_discount_share numeric(12,2) not null default 0 check(business_discount_share>=0),
  created_at timestamptz not null default now()
);

alter table public.discount_applications enable row level security;
drop policy if exists "Admins read discount applications" on public.discount_applications;
create policy "Admins read discount applications" on public.discount_applications for select using(public.is_admin());
drop policy if exists "Barbers read own discount applications" on public.discount_applications;
create policy "Barbers read own discount applications" on public.discount_applications for select using(
  exists(select 1 from public.barber_profiles bp where bp.id=barber_id and bp.user_id=auth.uid())
);

-- La comisión se reduce únicamente en las líneas que recibieron descuento.
create or replace function public.apply_equitable_sale_discount()
returns trigger language plpgsql security definer set search_path=''
as $$ declare line_total numeric; allocated numeric; residual numeric; first_item uuid;
begin
  if new.status='paid' and old.status<>'paid' then
    new.discount_total:=least(greatest(coalesce(new.discount_total,0),0),new.list_total);
    new.paid_total:=new.list_total-new.discount_total;
    select coalesce(sum(discount_amount),0) into allocated from public.sale_items where sale_id=new.id;

    -- Compatibilidad temporal: las versiones antiguas distribuyen el descuento sobre toda la venta.
    if abs(allocated-new.discount_total)>0.009 and new.list_total>0 then
      update public.sale_items
      set discount_amount=least(quantity*unit_price_snapshot,round(new.discount_total*(quantity*unit_price_snapshot)/new.list_total,2))
      where sale_id=new.id;
      select coalesce(sum(discount_amount),0) into allocated from public.sale_items where sale_id=new.id;
      residual:=new.discount_total-allocated;
      select id into first_item from public.sale_items where sale_id=new.id order by quantity*unit_price_snapshot desc,id limit 1;
      if first_item is not null and residual<>0 then
        update public.sale_items set discount_amount=greatest(discount_amount+residual,0) where id=first_item;
      end if;
    end if;

    update public.sale_items
    set commission_amount=greatest(
          round(quantity*unit_price_snapshot*commission_percent_snapshot/100,2)
          - least(
              case when discount_amount>=quantity*unit_price_snapshot then round(quantity*unit_price_snapshot*commission_percent_snapshot/100,2) else round(discount_amount/2,2) end,
              round(quantity*unit_price_snapshot*commission_percent_snapshot/100,2)
            ),0),
        barber_discount_share=least(
          case when discount_amount>=quantity*unit_price_snapshot then round(quantity*unit_price_snapshot*commission_percent_snapshot/100,2) else round(discount_amount/2,2) end,
          round(quantity*unit_price_snapshot*commission_percent_snapshot/100,2)
        ),
        business_discount_share=greatest(discount_amount-least(
          case when discount_amount>=quantity*unit_price_snapshot then round(quantity*unit_price_snapshot*commission_percent_snapshot/100,2) else round(discount_amount/2,2) end,
          round(quantity*unit_price_snapshot*commission_percent_snapshot/100,2)
        ),0)
    where sale_id=new.id;

    select coalesce(sum(commission_amount),0),coalesce(sum(barber_discount_share),0),coalesce(sum(business_discount_share),0)
    into new.barber_commission_total,new.barber_discount_share,new.business_discount_share
    from public.sale_items where sale_id=new.id;
    new.business_share:=greatest(new.paid_total-new.barber_commission_total,0);
  end if;
  return new;
end; $$;

-- Devuelve únicamente recompensas realmente utilizables con las líneas actuales.
create or replace function public.cashier_quote_loyalty(target_client_id uuid,service_lines jsonb)
returns table(
  reward_id uuid,barber_id uuid,barber_name text,balance integer,reward_name text,points_cost integer,
  eligible_base numeric,discount_amount numeric,reward_type text,reward_value numeric,max_discount numeric
) language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if target_client_id is null then return; end if;
  if jsonb_typeof(coalesce(service_lines,'[]'::jsonb))<>'array' then raise exception 'Atenciones no válidas'; end if;
  perform public.release_expired_reward_reservations();
  return query
  with requested as (
    select nullif(value->>'service_id','')::uuid service_id,nullif(value->>'barber_id','')::uuid barber_id
    from jsonb_array_elements(coalesce(service_lines,'[]'::jsonb))
  ), priced as (
    select q.barber_id,q.service_id,sum(s.price)::numeric eligible_line_total
    from requested q join public.services s on s.id=q.service_id and s.status='active'
    where q.barber_id is not null group by q.barber_id,q.service_id
  ), candidates as (
    select r.id reward_id,a.barber_id,b.display_name barber_name,a.balance,r.name reward_name,r.points_cost,
      sum(case when r.service_id is null or r.service_id=p.service_id then p.eligible_line_total else 0 end)::numeric eligible_base,
      r.reward_type,r.reward_value,r.max_discount
    from public.customer_barber_loyalty_accounts a
    join public.barber_profiles b on b.id=a.barber_id and b.active
    join priced p on p.barber_id=a.barber_id
    cross join public.rewards r
    where a.user_id=target_client_id and a.balance>=r.points_cost and r.active
      and r.reward_type in ('percent_discount','fixed_discount')
      and (r.starts_at is null or r.starts_at<=now()) and (r.ends_at is null or r.ends_at>now())
      and (r.usage_limit is null or r.usage_count+(select count(*) from public.reward_redemptions pending where pending.reward_id=r.id and pending.status='pending')<r.usage_limit)
    group by r.id,a.barber_id,b.display_name,a.balance,r.name,r.points_cost,r.reward_type,r.reward_value,r.max_discount
  )
  select c.reward_id,c.barber_id,c.barber_name,c.balance,c.reward_name,c.points_cost,c.eligible_base,
    least(c.eligible_base,case when c.reward_type='percent_discount' then round(c.eligible_base*c.reward_value/100,2) else c.reward_value end,coalesce(c.max_discount,c.eligible_base))::numeric,
    c.reward_type,c.reward_value,c.max_discount
  from candidates c where c.eligible_base>0
  order by 8 desc,6,5;
end; $$;

create or replace function public.release_expired_reward_reservations()
returns integer language plpgsql security definer set search_path=''
as $$ declare item public.reward_redemptions%rowtype; released integer:=0;
begin
  for item in select * from public.reward_redemptions where status='pending' and expires_at<=now() for update skip locked loop
    update public.reward_redemptions set status='expired',canceled_at=now() where id=item.id and status='pending';
    if found then
      if item.barber_id is not null then
        perform public.post_customer_barber_points(item.user_id,item.barber_id,item.points_spent,'reverse','Devolución por canje vencido','expire-redemption:'||item.id,'reward',item.reward_id);
      else
        perform public.post_loyalty_points(item.user_id,item.points_spent,'reverse','Devolución por canje vencido','expire-redemption:'||item.id,'reward',item.reward_id);
      end if;
      released:=released+1;
    end if;
  end loop;
  return released;
end; $$;

create or replace function public.request_reward_redemption(target_reward_id uuid,target_barber_id uuid)
returns text language plpgsql security definer set search_path=''
as $$ declare reward public.rewards%rowtype; result_code text; redemption_id uuid; reservation_minutes integer;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para canjear'; end if;
  perform public.release_expired_reward_reservations();
  select * into reward from public.rewards where id=target_reward_id and active
    and reward_type in ('percent_discount','fixed_discount')
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) for update;
  if not found or (reward.usage_limit is not null and reward.usage_count+(select count(*) from public.reward_redemptions where reward_id=reward.id and status='pending')>=reward.usage_limit)
    then raise exception 'Recompensa no disponible'; end if;
  perform 1 from public.customer_barber_loyalty_accounts where user_id=auth.uid() and barber_id=target_barber_id and balance>=reward.points_cost for update;
  if not found then raise exception 'No tienes puntos suficientes con este peluquero'; end if;
  select reward_reservation_minutes into reservation_minutes from public.loyalty_settings where id=true;
  insert into public.reward_redemptions(user_id,barber_id,reward_id,points_spent,expires_at,reward_name_snapshot,reward_type_snapshot,reward_value_snapshot,max_discount_snapshot,service_id_snapshot,idempotency_key)
  values(auth.uid(),target_barber_id,reward.id,reward.points_cost,now()+make_interval(mins=>coalesce(reservation_minutes,10)),reward.name,reward.reward_type,reward.reward_value,reward.max_discount,reward.service_id,'client:'||gen_random_uuid())
  returning id,code into redemption_id,result_code;
  perform public.post_customer_barber_points(auth.uid(),target_barber_id,-reward.points_cost,'redeem','Canje reservado','redemption:'||redemption_id,'reward',reward.id);
  return result_code;
end; $$;

create or replace function public.cancel_reward_redemption(target_redemption_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare redemption public.reward_redemptions%rowtype;
begin
  select * into redemption from public.reward_redemptions where id=target_redemption_id and user_id=auth.uid() and status='pending' for update;
  if not found then raise exception 'El canje ya no puede cancelarse'; end if;
  update public.reward_redemptions set status='canceled',canceled_at=now() where id=redemption.id;
  perform public.post_customer_barber_points(auth.uid(),redemption.barber_id,redemption.points_spent,'reverse','Devolución por canje cancelado','cancel-redemption:'||redemption.id,'reward',redemption.reward_id);
end; $$;

-- Cobro nuevo: un único beneficio, alcance por peluquero y confirmación idempotente.
create or replace function public.register_counter_service_sale_v5(
  target_appointment_id uuid,target_client_id uuid,guest_name text,guest_phone text,
  service_lines jsonb,custom_charges jsonb,target_product_id uuid,product_quantity integer,
  recommended_by_barber_id uuid,payment_method text,payment_reference text,provided_referral_code text,
  selected_reward_id uuid,selected_reward_barber_id uuid,redemption_code text,promotion_code text,checkout_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='extensions'
as $$ declare
  shift uuid; v_sale_id uuid; service public.services%rowtype; barber public.barber_profiles%rowtype;
  product public.products%rowtype; appt public.appointments%rowtype; existing_sale public.sales%rowtype; line jsonb; charge jsonb;
  line_service uuid; line_barber uuid; attendee text; charge_barber uuid; charge_description text; charge_amount numeric;
  list_amount numeric:=0; discount_amount numeric:=0; benefit_discount numeric:=0; eligible_amount numeric:=0; allocated numeric:=0; residual numeric:=0;
  redemption public.reward_redemptions%rowtype; reward public.rewards%rowtype; promotion public.promotions%rowtype;
  reward_name text; reward_kind text; reward_value numeric; reward_cap numeric; reward_service uuid; reward_points integer; reward_barber uuid;
  paid_amount numeric; commission_total numeric; business_amount numeric; barber_discount numeric; business_discount numeric;
  receipt public.receipts%rowtype; claim text; qty int:=greatest(coalesce(product_quantity,1),1); service_count int; target_line uuid;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if nullif(trim(checkout_idempotency_key),'') is null or length(checkout_idempotency_key)>100 then raise exception 'Identificador de cobro no válido'; end if;
  if payment_method not in ('cash','qr','transfer','card','other') then raise exception 'Forma de pago no permitida'; end if;
  if ((selected_reward_id is not null)::int+(nullif(trim(redemption_code),'') is not null)::int+(nullif(trim(promotion_code),'') is not null)::int)>1 then
    raise exception 'Solo se puede aplicar un beneficio por venta';
  end if;
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
  if jsonb_typeof(coalesce(service_lines,'[]'::jsonb))<>'array' then raise exception 'Las atenciones no tienen un formato válido'; end if;
  service_count:=jsonb_array_length(coalesce(service_lines,'[]'::jsonb));
  if service_count<1 or service_count>12 then raise exception 'Registra entre 1 y 12 atenciones'; end if;
  if jsonb_typeof(coalesce(custom_charges,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(custom_charges,'[]'::jsonb))>10 then raise exception 'Los cargos adicionales no tienen un formato válido'; end if;

  claim:=case when target_client_id is null then upper(substr(encode(gen_random_bytes(8),'hex'),1,10)) else null end;
  insert into public.sales(shift_id,appointment_id,client_id,guest_name,guest_phone,referral_code,source,status,claim_code,created_by,checkout_key)
  values(shift,target_appointment_id,target_client_id,nullif(trim(guest_name),''),nullif(trim(guest_phone),''),nullif(trim(provided_referral_code),''),case when target_appointment_id is null then 'walk_in' else 'appointment' end,'draft',claim,auth.uid(),checkout_idempotency_key)
  on conflict(created_by,checkout_key) where checkout_key is not null do nothing returning id into v_sale_id;
  if v_sale_id is null then raise exception 'Este cobro ya está siendo procesado'; end if;

  for line in select value from jsonb_array_elements(service_lines) loop
    line_service:=nullif(line->>'service_id','')::uuid; line_barber:=nullif(line->>'barber_id','')::uuid;
    attendee:=coalesce(nullif(trim(line->>'attendee_label'),''),'Titular');
    if attendee not in ('Titular','Hijo/a','Acompañante') then attendee:='Acompañante'; end if;
    select * into service from public.services where id=line_service and status='active';
    select * into barber from public.barber_profiles where id=line_barber and active;
    if service.id is null or barber.id is null then raise exception 'Servicio o peluquero no disponible'; end if;
    list_amount:=list_amount+service.price;
    insert into public.sale_items(sale_id,item_type,service_id,barber_id,name_snapshot,attendee_label,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'service',service.id,barber.id,service.name,attendee,true,1,service.price,barber.commission_percent,round(service.price*barber.commission_percent/100,2));
  end loop;
  for charge in select value from jsonb_array_elements(coalesce(custom_charges,'[]'::jsonb)) loop
    charge_description:=nullif(trim(charge->>'description'),''); charge_amount:=coalesce(nullif(charge->>'amount','')::numeric,0); charge_barber:=nullif(charge->>'barber_id','')::uuid;
    if charge_description is null or length(charge_description)<3 or length(charge_description)>160 or charge_amount<=0 or charge_amount>10000 then raise exception 'Revisa el cargo imprevisto y su justificación'; end if;
    select * into barber from public.barber_profiles where id=charge_barber and active;
    if barber.id is null then raise exception 'Selecciona el peluquero responsable del cargo'; end if;
    list_amount:=list_amount+charge_amount;
    insert into public.sale_items(sale_id,item_type,barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'custom_charge',barber.id,'Adicional: '||charge_description,false,1,charge_amount,barber.commission_percent,round(charge_amount*barber.commission_percent/100,2));
  end loop;
  if target_product_id is not null then
    select * into product from public.products where id=target_product_id and status='active' for update;
    if product.id is null or product.stock<qty then raise exception 'Producto sin stock suficiente'; end if;
    update public.products set stock=stock-qty where id=product.id; list_amount:=list_amount+product.price*qty;
    insert into public.sale_items(sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,earns_loyalty,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'product',product.id,recommended_by_barber_id,product.name,false,qty,product.price,0,0);
  end if;

  if nullif(trim(redemption_code),'') is not null then
    if target_client_id is null then raise exception 'El canje requiere un cliente registrado'; end if;
    perform public.release_expired_reward_reservations();
    select * into redemption from public.reward_redemptions where upper(code)=upper(trim(redemption_code)) and user_id=target_client_id and status='pending' and expires_at>now() for update;
    if not found then raise exception 'Canje inválido, vencido o perteneciente a otra cuenta'; end if;
    reward_name:=redemption.reward_name_snapshot; reward_kind:=redemption.reward_type_snapshot; reward_value:=redemption.reward_value_snapshot;
    reward_cap:=redemption.max_discount_snapshot; reward_service:=redemption.service_id_snapshot; reward_points:=redemption.points_spent; reward_barber:=redemption.barber_id;
  elsif selected_reward_id is not null then
    if target_client_id is null or selected_reward_barber_id is null then raise exception 'Selecciona cliente y peluquero para el canje'; end if;
    select * into reward from public.rewards where id=selected_reward_id and active and reward_type in ('percent_discount','fixed_discount')
      and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) for update;
    if not found or (reward.usage_limit is not null and reward.usage_count+(select count(*) from public.reward_redemptions pending where pending.reward_id=reward.id and pending.status='pending')>=reward.usage_limit) then raise exception 'Recompensa no disponible'; end if;
    perform 1 from public.customer_barber_loyalty_accounts where user_id=target_client_id and barber_id=selected_reward_barber_id and balance>=reward.points_cost for update;
    if not found then raise exception 'Saldo de puntos insuficiente con este peluquero'; end if;
    reward_name:=reward.name; reward_kind:=reward.reward_type; reward_value:=reward.reward_value; reward_cap:=reward.max_discount;
    reward_service:=reward.service_id; reward_points:=reward.points_cost; reward_barber:=selected_reward_barber_id;
  end if;

  if reward_kind is not null then
    select coalesce(sum(si.quantity*si.unit_price_snapshot),0) into eligible_amount from public.sale_items si
    where si.sale_id=v_sale_id and si.item_type='service' and si.barber_id=reward_barber and (reward_service is null or si.service_id=reward_service);
    if eligible_amount<=0 then raise exception 'La recompensa no corresponde a los servicios de este peluquero'; end if;
    benefit_discount:=least(eligible_amount,case when reward_kind='percent_discount' then round(eligible_amount*reward_value/100,2) else reward_value end,coalesce(reward_cap,eligible_amount));
    if benefit_discount<=0 then raise exception 'La recompensa no genera un descuento válido'; end if;
    update public.sale_items si set discount_amount=round(benefit_discount*(si.quantity*si.unit_price_snapshot)/eligible_amount,2)
      where si.sale_id=v_sale_id and si.item_type='service' and si.barber_id=reward_barber and (reward_service is null or si.service_id=reward_service);
    select coalesce(sum(si.discount_amount),0) into allocated from public.sale_items si where si.sale_id=v_sale_id;
    residual:=benefit_discount-allocated;
    select id into target_line from public.sale_items where sale_id=v_sale_id and item_type='service' and barber_id=reward_barber and (reward_service is null or service_id=reward_service) order by quantity*unit_price_snapshot desc,id limit 1;
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
    if not found then raise exception 'Promoción inválida, vencida o agotada'; end if;
    benefit_discount:=least(list_amount,case when promotion.discount_type='percent' then round(list_amount*promotion.discount_value/100,2) else promotion.discount_value end,coalesce(promotion.max_discount,list_amount));
    update public.sale_items si set discount_amount=round(benefit_discount*(si.quantity*si.unit_price_snapshot)/list_amount,2) where si.sale_id=v_sale_id;
    select coalesce(sum(si.discount_amount),0) into allocated from public.sale_items si where si.sale_id=v_sale_id; residual:=benefit_discount-allocated;
    select id into target_line from public.sale_items where sale_id=v_sale_id order by quantity*unit_price_snapshot desc,id limit 1;
    if residual<>0 then update public.sale_items si set discount_amount=si.discount_amount+residual where si.id=target_line; end if;
    discount_amount:=benefit_discount; update public.promotions set usage_count=usage_count+1 where id=promotion.id;
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
  if discount_amount>0 then
    insert into public.discount_applications(sale_id,source_type,source_id,barber_id,name_snapshot,rule_type_snapshot,rule_value_snapshot,max_discount_snapshot,eligible_base,discount_amount,barber_discount_share,business_discount_share)
    select v_sale_id,case when reward_kind is not null then 'reward' else 'promotion' end,case when reward_kind is not null then coalesce(redemption.reward_id,reward.id) else promotion.id end,
      si.barber_id,case when reward_kind is not null then reward_name else promotion.name end,case when reward_kind is not null then reward_kind else promotion.discount_type end,
      case when reward_kind is not null then reward_value else promotion.discount_value end,case when reward_kind is not null then reward_cap else promotion.max_discount end,
      sum(si.quantity*si.unit_price_snapshot),sum(si.discount_amount),sum(si.barber_discount_share),sum(si.business_discount_share)
    from public.sale_items si where si.sale_id=v_sale_id and si.discount_amount>0 group by si.barber_id;
  end if;
  if target_appointment_id is not null then update public.appointments set status='completed',updated_at=now() where id=target_appointment_id; delete from public.appointment_checkout_details where appointment_id=target_appointment_id; end if;
  perform public.process_sale_loyalty(v_sale_id);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'secure_service_sale_paid','sales',v_sale_id::text,jsonb_build_object('idempotency_key',checkout_idempotency_key,'list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount));
  return jsonb_build_object('sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'claim_code',claim,'list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,'barber_commission',commission_total,'business_share',business_amount,'barber_discount_share',barber_discount,'business_discount_share',business_discount);
end; $$;

-- La PWA anterior conserva su firma, pero ya no puede aplicar descuentos manuales
-- y delega las mismas validaciones financieras al cobro seguro.
create or replace function public.register_counter_service_sale_v4(
  target_appointment_id uuid,target_client_id uuid,guest_name text,guest_phone text,
  service_lines jsonb,custom_charges jsonb,target_product_id uuid,product_quantity integer,
  recommended_by_barber_id uuid,manual_discount numeric,payment_method text,payment_reference text,
  provided_referral_code text,redemption_code text,promotion_code text
) returns jsonb language plpgsql security definer set search_path='extensions'
as $$
begin
  if coalesce(manual_discount,0)<>0 then raise exception 'El descuento manual requiere autorización administrativa y ya no está disponible en caja'; end if;
  return public.register_counter_service_sale_v5(target_appointment_id,target_client_id,guest_name,guest_phone,service_lines,custom_charges,target_product_id,product_quantity,recommended_by_barber_id,payment_method,payment_reference,provided_referral_code,null,null,redemption_code,promotion_code,'legacy-v4:'||gen_random_uuid());
end; $$;

-- Se conserva el nombre consumido por la interfaz de productos, aislando la
-- implementación anterior y bloqueando también el descuento manual libre.
alter function public.register_counter_product_sale_v2(uuid,integer,uuid,numeric,text,text,text) rename to register_counter_product_sale_legacy;
revoke all on function public.register_counter_product_sale_legacy(uuid,integer,uuid,numeric,text,text,text) from public,authenticated;
create or replace function public.register_counter_product_sale_v2(
  target_product_id uuid,product_quantity integer,recommended_by_barber_id uuid,manual_discount numeric,
  payment_method text,payment_reference text,promotion_code text
) returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  if coalesce(manual_discount,0)<>0 then raise exception 'El descuento manual requiere autorización administrativa y ya no está disponible en caja'; end if;
  return public.register_counter_product_sale_legacy(target_product_id,product_quantity,recommended_by_barber_id,0,payment_method,payment_reference,promotion_code);
end; $$;

-- Versiones previas sin líneas familiares ya no tienen consumidores.
drop function if exists public.register_counter_sale_v2(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text);
drop function if exists public.register_counter_sale_v3(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text);

revoke all on function public.cashier_quote_loyalty(uuid,jsonb) from public;
revoke all on function public.release_expired_reward_reservations() from public;
revoke all on function public.register_counter_service_sale_v5(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,text,text,text,uuid,uuid,text,text,text) from public;
grant execute on function public.cashier_quote_loyalty(uuid,jsonb) to authenticated;
grant execute on function public.release_expired_reward_reservations() to authenticated;
grant execute on function public.register_counter_service_sale_v5(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,text,text,text,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.register_counter_service_sale_v4(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,numeric,text,text,text,text,text) to authenticated;
grant execute on function public.register_counter_product_sale_v2(uuid,integer,uuid,numeric,text,text,text) to authenticated;
