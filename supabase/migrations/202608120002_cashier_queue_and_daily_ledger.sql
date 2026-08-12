-- Flujo operativo: peluquero -> cola de cobro -> caja, con servicios extra y libro diario.
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check (
  status in ('requested','confirmed','in_progress','pending_payment','completed','canceled','no_show','needs_reschedule','pending_client_confirmation')
);

create table if not exists public.appointment_checkout_details (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  actual_service_id uuid references public.services(id),
  extra_service_id uuid references public.services(id),
  suggested_product_id uuid references public.products(id),
  product_quantity integer not null default 1 check(product_quantity between 1 and 20),
  notes text,
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointment_checkout_details enable row level security;
drop policy if exists "Staff read checkout details" on public.appointment_checkout_details;
create policy "Staff read checkout details" on public.appointment_checkout_details for select to authenticated
using (
  public.is_cashier() or public.is_admin() or exists (
    select 1 from public.appointments a join public.barber_profiles b on b.id=a.barber_id
    where a.id=appointment_id and b.user_id=auth.uid() and b.active
  )
);

alter table public.cash_movements add column if not exists sale_id uuid references public.sales(id);
create index if not exists cash_movements_shift_created_idx on public.cash_movements(shift_id,created_at);

create or replace function public.send_appointment_to_cashier(
  target_appointment_id uuid,
  actual_service uuid default null,
  extra_service uuid default null,
  suggested_product uuid default null,
  suggested_quantity integer default 1,
  checkout_note text default null
) returns void language plpgsql security definer set search_path=''
as $$ declare appt public.appointments%rowtype; allowed boolean;
begin
  select * into appt from public.appointments where id=target_appointment_id for update;
  if not found then raise exception 'Cita no encontrada'; end if;
  allowed:=public.is_admin() or exists(select 1 from public.barber_profiles b where b.id=appt.barber_id and b.user_id=auth.uid() and b.active);
  if not allowed then raise exception 'No tienes acceso a esta cita'; end if;
  if appt.status not in ('confirmed','in_progress') then raise exception 'La atención no está lista para enviarse a caja'; end if;
  actual_service:=coalesce(actual_service,appt.service_id);
  if not exists(select 1 from public.services where id=actual_service and status='active') then raise exception 'Selecciona un servicio disponible'; end if;
  if extra_service is not null and not exists(select 1 from public.services where id=extra_service and status='active') then raise exception 'El servicio extra no está disponible'; end if;
  if suggested_product is not null and not exists(select 1 from public.products where id=suggested_product and status='active' and stock>=greatest(coalesce(suggested_quantity,1),1)) then raise exception 'El producto no tiene stock suficiente'; end if;
  insert into public.appointment_checkout_details(appointment_id,actual_service_id,extra_service_id,suggested_product_id,product_quantity,notes,submitted_by)
  values(appt.id,actual_service,extra_service,suggested_product,greatest(coalesce(suggested_quantity,1),1),nullif(trim(checkout_note),''),auth.uid())
  on conflict(appointment_id) do update set actual_service_id=excluded.actual_service_id,extra_service_id=excluded.extra_service_id,
    suggested_product_id=excluded.suggested_product_id,product_quantity=excluded.product_quantity,notes=excluded.notes,
    submitted_by=excluded.submitted_by,submitted_at=now(),updated_at=now();
  update public.appointments set status='pending_payment',updated_at=now() where id=appt.id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'appointment_sent_to_cashier','appointments',appt.id::text,jsonb_build_object('actual_service_id',actual_service,'extra_service_id',extra_service,'product_id',suggested_product));
end; $$;

create or replace function public.register_counter_sale_v2(
  target_appointment_id uuid,target_client_id uuid,guest_name text,guest_phone text,
  target_barber_id uuid,target_service_id uuid,target_extra_service_id uuid,target_product_id uuid,product_quantity integer,
  recommended_by_barber_id uuid,manual_discount numeric,payment_method text,payment_reference text,
  provided_referral_code text,redemption_code text,promotion_code text
) returns jsonb language plpgsql security definer set search_path=''
as $$ declare shift uuid; v_sale_id uuid; service public.services%rowtype; extra public.services%rowtype; barber public.barber_profiles%rowtype; product public.products%rowtype; appt public.appointments%rowtype; checkout public.appointment_checkout_details%rowtype; list_amount numeric:=0; commission_total numeric:=0; discount_amount numeric:=greatest(coalesce(manual_discount,0),0); reward_discount numeric:=0; promotion_discount numeric:=0; redemption public.reward_redemptions%rowtype; reward public.rewards%rowtype; promotion public.promotions%rowtype; paid_amount numeric; business_amount numeric; receipt public.receipts%rowtype; claim text; qty int:=greatest(coalesce(product_quantity,1),1);
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
    list_amount:=list_amount+service.price; commission_total:=commission_total+round(service.price*barber.commission_percent/100,2);
    insert into public.sale_items(sale_id,item_type,service_id,barber_id,name_snapshot,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'service',service.id,barber.id,service.name,1,service.price,barber.commission_percent,round(service.price*barber.commission_percent/100,2));
  end if;
  if target_extra_service_id is not null then
    select * into extra from public.services where id=target_extra_service_id and status='active';
    if extra.id is null or barber.id is null then raise exception 'Servicio extra o peluquero no disponible'; end if;
    list_amount:=list_amount+extra.price; commission_total:=commission_total+round(extra.price*barber.commission_percent/100,2);
    insert into public.sale_items(sale_id,item_type,service_id,barber_id,name_snapshot,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'service',extra.id,barber.id,extra.name,1,extra.price,barber.commission_percent,round(extra.price*barber.commission_percent/100,2));
  end if;
  if target_product_id is not null then
    select * into product from public.products where id=target_product_id and status='active' for update;
    if product.id is null or product.stock<qty then raise exception 'Producto sin stock suficiente'; end if;
    update public.products set stock=stock-qty where id=product.id;
    list_amount:=list_amount+product.price*qty;
    if recommended_by_barber_id is not null then commission_total:=commission_total+round(product.price*qty*product.incentive_percent/100,2); end if;
    insert into public.sale_items(sale_id,item_type,product_id,recommended_by_barber_id,name_snapshot,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'product',product.id,recommended_by_barber_id,product.name,qty,product.price,case when recommended_by_barber_id is null then 0 else product.incentive_percent end,case when recommended_by_barber_id is null then 0 else round(product.price*qty*product.incentive_percent/100,2) end);
    if target_client_id is not null then update public.product_reservations set status='collected',updated_at=now() where id=(select id from public.product_reservations where client_id=target_client_id and product_id=product.id and status='reserved' order by created_at limit 1); end if;
  end if;
  if nullif(trim(redemption_code),'') is not null then
    select rr.* into redemption from public.reward_redemptions rr where upper(rr.code)=upper(trim(redemption_code)) and rr.user_id=target_client_id and rr.status='pending' and rr.expires_at>now() for update;
    if not found then raise exception 'Canje inválido, vencido o perteneciente a otra cuenta'; end if;
    select * into reward from public.rewards where id=redemption.reward_id and active;
    reward_discount:=case when reward.reward_type='percent_discount' then round(list_amount*reward.reward_value/100,2) when reward.reward_type='fixed_discount' then reward.reward_value else 0 end;
    if reward.max_discount is not null then reward_discount:=least(reward_discount,reward.max_discount); end if;
    discount_amount:=discount_amount+reward_discount; update public.reward_redemptions set sale_id=v_sale_id,status='used',used_at=now() where id=redemption.id;
  end if;
  if nullif(trim(promotion_code),'') is not null then
    select * into promotion from public.promotions where lower(code)=lower(trim(promotion_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) and (usage_limit is null or usage_count<usage_limit) for update;
    if not found then raise exception 'Promoción inválida, vencida o agotada'; end if;
    promotion_discount:=case when promotion.discount_type='percent' then round(list_amount*promotion.discount_value/100,2) else promotion.discount_value end;
    if promotion.max_discount is not null then promotion_discount:=least(promotion_discount,promotion.max_discount); end if;
    discount_amount:=discount_amount+promotion_discount; update public.promotions set usage_count=usage_count+1 where id=promotion.id;
  end if;
  discount_amount:=least(discount_amount,list_amount); business_amount:=list_amount-discount_amount-commission_total;
  if business_amount<0 and not public.is_admin() then raise exception 'El descuento supera la participación del negocio y requiere autorización administrativa'; end if;
  paid_amount:=list_amount-discount_amount;
  update public.sales set status='paid',list_total=list_amount,discount_total=discount_amount,paid_total=paid_amount,barber_commission_total=commission_total,business_share=business_amount,paid_at=now(),updated_at=now() where id=v_sale_id;
  insert into public.payments(sale_id,shift_id,amount,method,reference,confirmed_by) values(v_sale_id,shift,paid_amount,payment_method,nullif(trim(payment_reference),''),auth.uid());
  insert into public.receipts(sale_id,issued_by) values(v_sale_id,auth.uid()) returning * into receipt;
  insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,sale_id) values(shift,'sale',paid_amount,payment_method,'Venta · comprobante #'||receipt.number,auth.uid(),v_sale_id);
  insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount)
    select coalesce(si.barber_id,si.recommended_by_barber_id),si.id,case when si.item_type='service' then 'service_commission' else 'product_incentive' end,si.quantity*si.unit_price_snapshot,si.commission_percent_snapshot,si.commission_amount from public.sale_items si where si.sale_id=v_sale_id and si.commission_amount>0;
  if target_appointment_id is not null then update public.appointments set status='completed',updated_at=now() where id=target_appointment_id; delete from public.appointment_checkout_details where appointment_id=target_appointment_id; end if;
  perform public.process_sale_loyalty(v_sale_id);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'sale_paid','sales',v_sale_id::text,jsonb_build_object('list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,'commission',commission_total));
  return jsonb_build_object('sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'claim_code',claim,'list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,'barber_commission',commission_total,'business_share',business_amount);
end; $$;

revoke all on function public.send_appointment_to_cashier(uuid,uuid,uuid,uuid,integer,text) from public;
revoke all on function public.register_counter_sale_v2(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text) from public;
grant execute on function public.send_appointment_to_cashier(uuid,uuid,uuid,uuid,integer,text) to authenticated;
grant execute on function public.register_counter_sale_v2(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text) to authenticated;
alter function public.send_appointment_to_cashier(uuid,uuid,uuid,uuid,integer,text) set search_path='';
alter function public.register_counter_sale_v2(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text) set search_path='extensions';

do $$ begin
  alter publication supabase_realtime add table public.appointment_checkout_details;
exception when duplicate_object then null;
end $$;
