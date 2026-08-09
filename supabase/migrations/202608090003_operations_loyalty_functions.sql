-- Seguridad y operaciones transaccionales de la ampliación.
create or replace function public.is_cashier()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('cashier','admin')); $$;

create or replace function public.can_access_conversation(target_conversation uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select public.is_admin() or exists(select 1 from public.conversation_participants where conversation_id=target_conversation and user_id=auth.uid()); $$;

create policy "Cashiers manage shifts" on public.cash_shifts for all using(public.is_cashier()) with check(public.is_cashier());
create policy "Cashiers read profiles" on public.profiles for select using(public.is_cashier());
create policy "Cashiers read appointments" on public.appointments for select using(public.is_cashier());
create policy "Cashiers manage movements" on public.cash_movements for all using(public.is_cashier()) with check(public.is_cashier());
create policy "Cashiers manage sales" on public.sales for all using(public.is_cashier()) with check(public.is_cashier());
create policy "Clients read own sales" on public.sales for select using(client_id=auth.uid());
create policy "Cashiers manage sale items" on public.sale_items for all using(public.is_cashier()) with check(public.is_cashier());
create policy "Clients read own sale items" on public.sale_items for select using(exists(select 1 from public.sales s where s.id=sale_id and s.client_id=auth.uid()));
create policy "Cashiers manage payments" on public.payments for all using(public.is_cashier()) with check(public.is_cashier());
create policy "Clients read own payments" on public.payments for select using(exists(select 1 from public.sales s where s.id=sale_id and s.client_id=auth.uid()));
create policy "Cashiers manage receipts" on public.receipts for all using(public.is_cashier()) with check(public.is_cashier());
create policy "Clients read own receipts" on public.receipts for select using(exists(select 1 from public.sales s where s.id=sale_id and s.client_id=auth.uid()));
create policy "Barbers read earnings" on public.barber_earnings for select using(public.is_admin() or exists(select 1 from public.barber_profiles b where b.id=barber_id and b.user_id=auth.uid()));
create policy "Admins manage earnings" on public.barber_earnings for all using(public.is_admin()) with check(public.is_admin());
create policy "Barbers manage own expenses" on public.barber_expenses for all using(public.is_admin() or exists(select 1 from public.barber_profiles b where b.id=barber_id and b.user_id=auth.uid())) with check(public.is_admin() or exists(select 1 from public.barber_profiles b where b.id=barber_id and b.user_id=auth.uid()));
create policy "Payouts visible to owner" on public.payouts for select using(public.is_admin() or exists(select 1 from public.barber_profiles b where b.id=barber_id and b.user_id=auth.uid()));
create policy "Admins manage payouts" on public.payouts for all using(public.is_admin()) with check(public.is_admin());
create policy "Payout items visible to owner" on public.payout_items for select using(public.is_admin() or exists(select 1 from public.payouts p join public.barber_profiles b on b.id=p.barber_id where p.id=payout_id and b.user_id=auth.uid()));
create policy "Admins manage payout items" on public.payout_items for all using(public.is_admin()) with check(public.is_admin());
create policy "Authenticated read loyalty settings" on public.loyalty_settings for select to authenticated using(true);
create policy "Admins manage loyalty settings" on public.loyalty_settings for all using(public.is_admin()) with check(public.is_admin());
create policy "Users read loyalty account" on public.loyalty_accounts for select using(user_id=auth.uid() or public.is_admin());
create policy "Users read loyalty history" on public.loyalty_transactions for select using(user_id=auth.uid() or public.is_admin());
create policy "Public read active rewards" on public.rewards for select using(active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) or public.is_admin());
create policy "Admins manage rewards" on public.rewards for all using(public.is_admin()) with check(public.is_admin());
create policy "Users read redemptions" on public.reward_redemptions for select using(user_id=auth.uid() or public.is_cashier());
create policy "Cashiers manage redemptions" on public.reward_redemptions for update using(public.is_cashier()) with check(public.is_cashier());
create policy "Read active promotions" on public.promotions for select using((active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())) or public.is_admin());
create policy "Admins manage promotions" on public.promotions for all using(public.is_admin()) with check(public.is_admin());
create policy "Users read referrals" on public.referrals for select using(referrer_id=auth.uid() or referred_id=auth.uid() or public.is_admin());
create policy "Users read streak" on public.customer_streaks for select using(user_id=auth.uid() or public.is_admin());
create policy "Conversation access" on public.conversations for select using(public.can_access_conversation(id));
create policy "Participants access" on public.conversation_participants for select using(user_id=auth.uid() or public.is_admin());
create policy "Message access" on public.messages for select using(public.can_access_conversation(conversation_id));
create policy "Anonymous records analytics" on public.web_events for insert to anon,authenticated with check(user_id is null or user_id=auth.uid());
create policy "Admins read analytics" on public.web_events for select using(public.is_admin());

create or replace function public.set_cashier_role(target_email text, enabled boolean default true)
returns void language plpgsql security definer set search_path=''
as $$ declare target_id uuid;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  select id into target_id from public.profiles where lower(email)=lower(trim(target_email));
  if target_id is null then raise exception 'La cuenta debe iniciar sesión con Google antes de recibir acceso de caja'; end if;
  if enabled then
    insert into public.user_roles(user_id,role) values(target_id,'client') on conflict do nothing;
    insert into public.user_roles(user_id,role) values(target_id,'cashier') on conflict do nothing;
  else delete from public.user_roles where user_id=target_id and role='cashier'; end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),case when enabled then 'cashier_granted' else 'cashier_revoked' end,'user_roles',target_id::text,jsonb_build_object('email',lower(trim(target_email))));
end; $$;

create or replace function public.open_cash_shift(opening numeric default 0, shift_notes text default null)
returns uuid language plpgsql security definer set search_path=''
as $$ declare result_id uuid;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if opening<0 then raise exception 'El monto inicial no puede ser negativo'; end if;
  insert into public.cash_shifts(opened_by,opening_amount,notes) values(auth.uid(),opening,nullif(trim(shift_notes),'')) returning id into result_id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'cash_shift_opened','cash_shifts',result_id::text,jsonb_build_object('opening_amount',opening));
  return result_id;
end; $$;

create or replace function public.record_cash_movement(movement_kind text, movement_amount numeric, payment_method text, movement_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare shift uuid; result_id uuid; signed_amount numeric;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if movement_kind not in ('income','expense','adjustment') then raise exception 'Tipo de movimiento no permitido'; end if;
  if payment_method not in ('cash','qr','transfer','card','other') then raise exception 'Forma de pago no permitida'; end if;
  if movement_amount<=0 or nullif(trim(movement_reason),'') is null then raise exception 'Monto y motivo son obligatorios'; end if;
  select id into shift from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift is null then raise exception 'Debes abrir caja antes de registrar movimientos'; end if;
  signed_amount:=case when movement_kind='expense' then -movement_amount else movement_amount end;
  insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by) values(shift,movement_kind,signed_amount,payment_method,trim(movement_reason),auth.uid()) returning id into result_id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'cash_movement_created','cash_movements',result_id::text,jsonb_build_object('kind',movement_kind,'amount',signed_amount,'reason',trim(movement_reason)));
  return result_id;
end; $$;

create or replace function public.close_cash_shift(counted numeric, shift_notes text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare shift public.cash_shifts%rowtype; expected numeric;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if counted<0 then raise exception 'El monto contado no puede ser negativo'; end if;
  select * into shift from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1 for update;
  if not found then raise exception 'No existe una caja abierta'; end if;
  select shift.opening_amount+coalesce(sum(amount) filter (where payment_method='cash'),0) into expected from public.cash_movements where shift_id=shift.id;
  update public.cash_shifts set status='closed',closed_by=auth.uid(),closed_at=now(),expected_amount=expected,counted_amount=counted,difference_amount=counted-expected,notes=coalesce(nullif(trim(shift_notes),''),notes) where id=shift.id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'cash_shift_closed','cash_shifts',shift.id::text,jsonb_build_object('expected',expected,'counted',counted,'difference',counted-expected));
  return jsonb_build_object('shift_id',shift.id,'expected',expected,'counted',counted,'difference',counted-expected);
end; $$;

create or replace function public.post_loyalty_points(target_user uuid, point_amount integer, transaction_kind text, transaction_reason text, unique_key text, source_kind text default null, source_uuid uuid default null)
returns void language plpgsql security definer set search_path=''
as $$ declare current_balance integer; expiry timestamptz; settings public.loyalty_settings%rowtype;
begin
  if point_amount=0 then return; end if;
  if exists(select 1 from public.loyalty_transactions where idempotency_key=unique_key) then return; end if;
  select * into settings from public.loyalty_settings where id=true;
  insert into public.loyalty_accounts(user_id) values(target_user) on conflict do nothing;
  select balance into current_balance from public.loyalty_accounts where user_id=target_user for update;
  if current_balance+point_amount<0 then raise exception 'Saldo de puntos insuficiente'; end if;
  expiry:=case when point_amount>0 then now()+make_interval(months=>settings.points_expiry_months) else null end;
  insert into public.loyalty_transactions(user_id,points,kind,reason,idempotency_key,source_type,source_id,expires_at,created_by) values(target_user,point_amount,transaction_kind,transaction_reason,unique_key,source_kind,source_uuid,expiry,auth.uid());
  update public.loyalty_accounts set balance=balance+point_amount,lifetime_earned=lifetime_earned+greatest(point_amount,0),lifetime_redeemed=lifetime_redeemed+greatest(-point_amount,0),updated_at=now() where user_id=target_user;
end; $$;

create or replace function public.process_sale_loyalty(target_sale uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare sale public.sales%rowtype; settings public.loyalty_settings%rowtype; service_count int; product_total numeric; referrer uuid; paid_count int; streak public.customer_streaks%rowtype; next_visits int;
begin
  select * into sale from public.sales where id=target_sale and status='paid' for update;
  if not found or sale.client_id is null or sale.loyalty_processed_at is not null then return; end if;
  select * into settings from public.loyalty_settings where id=true;
  select count(*) filter (where item_type='service'),coalesce(sum(quantity*unit_price_snapshot) filter (where item_type='product'),0) into service_count,product_total from public.sale_items where sale_id=sale.id;
  perform public.post_loyalty_points(sale.client_id,settings.welcome_points,'earn','Bienvenida a LEGEND CLUB','welcome:'||sale.client_id,'sale',sale.id);
  if service_count>0 then perform public.post_loyalty_points(sale.client_id,settings.service_points*service_count,'earn','Servicio completado','service-sale:'||sale.id,'sale',sale.id); end if;
  if product_total>=settings.product_amount_per_point then perform public.post_loyalty_points(sale.client_id,floor(product_total/settings.product_amount_per_point)::int,'earn','Compra de productos','product-sale:'||sale.id,'sale',sale.id); end if;

  if nullif(trim(sale.referral_code),'') is not null then
    select id into referrer from public.profiles where lower(referral_code)=lower(trim(sale.referral_code));
    if referrer is not null and referrer<>sale.client_id then
      select count(*) into paid_count from public.sales where client_id=sale.client_id and status='paid';
      if paid_count=1 then
        insert into public.referrals(referrer_id,referred_id,first_sale_id,status,qualified_at) values(referrer,sale.client_id,sale.id,'rewarded',now()) on conflict(referred_id) do nothing;
        if found then
          perform public.post_loyalty_points(referrer,settings.referral_referrer_points,'earn','Cliente referido','referrer:'||sale.client_id,'referral',sale.id);
          perform public.post_loyalty_points(sale.client_id,settings.referral_referred_points,'earn','Bienvenida por referido','referred:'||sale.client_id,'referral',sale.id);
        end if;
      end if;
    end if;
  end if;

  select * into streak from public.customer_streaks where user_id=sale.client_id for update;
  if not found then next_visits:=1;
  elsif streak.last_visit_at is null or streak.last_visit_at<now()-make_interval(days=>settings.streak_days) then next_visits:=1;
  else next_visits:=streak.current_visits+1; end if;
  insert into public.customer_streaks(user_id,current_visits,best_visits,last_visit_at) values(sale.client_id,next_visits,next_visits,now()) on conflict(user_id) do update set current_visits=next_visits,best_visits=greatest(public.customer_streaks.best_visits,next_visits),last_visit_at=now(),updated_at=now();
  if next_visits>=settings.streak_visits then
    perform public.post_loyalty_points(sale.client_id,settings.streak_bonus_points,'earn','Racha de asistencia completada','streak:'||sale.id,'sale',sale.id);
    update public.customer_streaks set current_visits=0,updated_at=now() where user_id=sale.client_id;
  end if;
  update public.sales set loyalty_processed_at=now(),updated_at=now() where id=sale.id;
end; $$;

create or replace function public.register_counter_sale(
  target_appointment_id uuid,target_client_id uuid,guest_name text,guest_phone text,
  target_barber_id uuid,target_service_id uuid,target_product_id uuid,product_quantity integer,
  recommended_by_barber_id uuid,manual_discount numeric,payment_method text,payment_reference text,
  provided_referral_code text,redemption_code text,promotion_code text
) returns jsonb language plpgsql security definer set search_path=''
as $$ declare shift uuid; v_sale_id uuid; service public.services%rowtype; barber public.barber_profiles%rowtype; product public.products%rowtype; appt public.appointments%rowtype; item_id uuid; list_amount numeric:=0; commission_total numeric:=0; discount_amount numeric:=greatest(coalesce(manual_discount,0),0); reward_discount numeric:=0; promotion_discount numeric:=0; redemption public.reward_redemptions%rowtype; reward public.rewards%rowtype; promotion public.promotions%rowtype; paid_amount numeric; business_amount numeric; receipt public.receipts%rowtype; claim text; qty int:=greatest(coalesce(product_quantity,1),1);
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_method not in ('cash','qr','transfer','card','other') then raise exception 'Forma de pago no permitida'; end if;
  select id into shift from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift is null then raise exception 'Debes abrir caja antes de cobrar'; end if;

  if target_appointment_id is not null then
    select * into appt from public.appointments where id=target_appointment_id for update;
    if not found or appt.status in ('canceled','no_show','needs_reschedule') then raise exception 'La cita no puede cobrarse'; end if;
    target_client_id:=appt.client_id; target_barber_id:=appt.barber_id; target_service_id:=appt.service_id;
  end if;
  if target_service_id is null and target_product_id is null then raise exception 'Agrega al menos un servicio o producto'; end if;
  if target_client_id is null and nullif(trim(guest_name),'') is null then raise exception 'Identifica al cliente o registra un nombre de invitado'; end if;
  claim:=case when target_client_id is null then upper(substr(encode(gen_random_bytes(8),'hex'),1,10)) else null end;
  insert into public.sales(shift_id,appointment_id,client_id,guest_name,guest_phone,referral_code,source,status,claim_code,created_by)
  values(shift,target_appointment_id,target_client_id,nullif(trim(guest_name),''),nullif(trim(guest_phone),''),nullif(trim(provided_referral_code),''),case when target_appointment_id is null then 'walk_in' else 'appointment' end,'draft',claim,auth.uid()) returning id into v_sale_id;

  if target_service_id is not null then
    select * into service from public.services where id=target_service_id and status='active';
    select * into barber from public.barber_profiles where id=target_barber_id and active;
    if service.id is null or barber.id is null then raise exception 'Servicio o peluquero no disponible'; end if;
    list_amount:=list_amount+service.price;
    commission_total:=commission_total+round(service.price*barber.commission_percent/100,2);
    insert into public.sale_items(sale_id,item_type,service_id,barber_id,name_snapshot,quantity,unit_price_snapshot,commission_percent_snapshot,commission_amount)
    values(v_sale_id,'service',service.id,barber.id,service.name,1,service.price,barber.commission_percent,round(service.price*barber.commission_percent/100,2)) returning id into item_id;
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
    discount_amount:=discount_amount+reward_discount;
    update public.reward_redemptions set sale_id=v_sale_id,status='used',used_at=now() where id=redemption.id;
  end if;
  if nullif(trim(promotion_code),'') is not null then
    select * into promotion from public.promotions where lower(code)=lower(trim(promotion_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) and (usage_limit is null or usage_count<usage_limit) for update;
    if not found then raise exception 'Promoción inválida, vencida o agotada'; end if;
    promotion_discount:=case when promotion.discount_type='percent' then round(list_amount*promotion.discount_value/100,2) else promotion.discount_value end;
    if promotion.max_discount is not null then promotion_discount:=least(promotion_discount,promotion.max_discount); end if;
    discount_amount:=discount_amount+promotion_discount;
    update public.promotions set usage_count=usage_count+1 where id=promotion.id;
  end if;
  discount_amount:=least(discount_amount,list_amount);
  business_amount:=list_amount-discount_amount-commission_total;
  if business_amount<0 and not public.is_admin() then raise exception 'El descuento supera la participación del negocio y requiere autorización administrativa'; end if;
  paid_amount:=list_amount-discount_amount;
  update public.sales set status='paid',list_total=list_amount,discount_total=discount_amount,paid_total=paid_amount,barber_commission_total=commission_total,business_share=business_amount,paid_at=now(),updated_at=now() where id=v_sale_id;
  insert into public.payments(sale_id,shift_id,amount,method,reference,confirmed_by) values(v_sale_id,shift,paid_amount,payment_method,nullif(trim(payment_reference),''),auth.uid());
  insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by) values(shift,'sale',paid_amount,payment_method,'Venta '||v_sale_id,auth.uid());
  insert into public.receipts(sale_id,issued_by) values(v_sale_id,auth.uid()) returning * into receipt;
  insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount)
    select coalesce(si.barber_id,si.recommended_by_barber_id),si.id,case when si.item_type='service' then 'service_commission' else 'product_incentive' end,si.quantity*si.unit_price_snapshot,si.commission_percent_snapshot,si.commission_amount from public.sale_items si where si.sale_id=v_sale_id and si.commission_amount>0;
  if target_appointment_id is not null then update public.appointments set status='completed',updated_at=now() where id=target_appointment_id; end if;
  perform public.process_sale_loyalty(v_sale_id);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'sale_paid','sales',v_sale_id::text,jsonb_build_object('list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,'commission',commission_total));
  return jsonb_build_object('sale_id',v_sale_id,'receipt_id',receipt.id,'receipt_number',receipt.number,'claim_code',claim,'list_total',list_amount,'discount',discount_amount,'paid_total',paid_amount,'barber_commission',commission_total,'business_share',business_amount);
end; $$;

create or replace function public.claim_guest_sale(provided_code text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare sale_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para vincular tu atención'; end if;
  select id into sale_id from public.sales where upper(claim_code)=upper(trim(provided_code)) and client_id is null and status='paid' for update;
  if sale_id is null then raise exception 'Código inválido o ya utilizado'; end if;
  update public.sales set client_id=auth.uid(),claim_code=null,updated_at=now() where id=sale_id;
  perform public.process_sale_loyalty(sale_id);
  return sale_id;
end; $$;

create or replace function public.reverse_counter_sale(target_sale_id uuid,reversal_reason text)
returns void language plpgsql security definer set search_path=''
as $$ declare sale public.sales%rowtype; shift uuid; item record; earning record; account_balance integer; reversal_points integer;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if nullif(trim(reversal_reason),'') is null then raise exception 'El motivo es obligatorio'; end if;
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
    insert into public.barber_earnings(barber_id,sale_item_id,kind,base_amount,rate_percent,amount,status) values(earning.barber_id,earning.sale_item_id,'reversal',earning.base_amount,earning.rate_percent,-earning.amount,'reversed') on conflict(sale_item_id,kind) do nothing;
  end loop;
  for earning in select * from public.loyalty_transactions where source_id=sale.id and points>0 and kind='earn' loop
    select balance into account_balance from public.loyalty_accounts where user_id=earning.user_id for update;
    reversal_points:=least(coalesce(account_balance,0),earning.points);
    if reversal_points>0 then perform public.post_loyalty_points(earning.user_id,-reversal_points,'reverse','Reversión: '||trim(reversal_reason),'reverse-sale:'||sale.id||':'||earning.id,'sale',sale.id); end if;
  end loop;
  for earning in select * from public.reward_redemptions where sale_id=sale.id and status='used' loop
    perform public.post_loyalty_points(earning.user_id,earning.points_spent,'reverse','Devolución de canje por venta revertida','refund-redemption:'||earning.id,'reward',earning.reward_id);
  end loop;
  update public.reward_redemptions set status='canceled',sale_id=null,used_at=null where sale_id=sale.id and status='used';
  update public.payments set status='refunded' where sale_id=sale.id and status='confirmed';
  insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by) select shift,'refund',-sale.paid_total,method,'Devolución: '||trim(reversal_reason),auth.uid() from public.payments where sale_id=sale.id order by created_at limit 1;
  update public.sales set status='refunded',updated_at=now() where id=sale.id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'sale_refunded','sales',sale.id::text,jsonb_build_object('reason',trim(reversal_reason),'amount',sale.paid_total));
end; $$;

create or replace function public.request_reward_redemption(target_reward_id uuid)
returns text language plpgsql security definer set search_path=''
as $$ declare reward public.rewards%rowtype; result_code text; redemption_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para canjear'; end if;
  select * into reward from public.rewards where id=target_reward_id and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
  if not found then raise exception 'Recompensa no disponible'; end if;
  insert into public.reward_redemptions(user_id,reward_id,points_spent) values(auth.uid(),reward.id,reward.points_cost) returning id,code into redemption_id,result_code;
  perform public.post_loyalty_points(auth.uid(),-reward.points_cost,'redeem','Canje solicitado','redemption:'||redemption_id,'reward',reward.id);
  return result_code;
end; $$;

create or replace function public.cancel_reward_redemption(target_redemption_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare redemption public.reward_redemptions%rowtype;
begin
  select * into redemption from public.reward_redemptions where id=target_redemption_id and user_id=auth.uid() and status='pending' for update;
  if not found then raise exception 'El canje ya no puede cancelarse'; end if;
  update public.reward_redemptions set status='canceled' where id=redemption.id;
  perform public.post_loyalty_points(auth.uid(),redemption.points_spent,'reverse','Devolución por canje cancelado','cancel-redemption:'||redemption.id,'reward',redemption.reward_id);
end; $$;

create or replace function public.refresh_my_loyalty()
returns integer language plpgsql security definer set search_path=''
as $$ declare available integer; expired_earned integer; spent integer; already_expired integer; amount integer;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para consultar tus puntos'; end if;
  insert into public.loyalty_accounts(user_id) values(auth.uid()) on conflict do nothing;
  select balance into available from public.loyalty_accounts where user_id=auth.uid() for update;
  select coalesce(sum(points),0) into expired_earned from public.loyalty_transactions where user_id=auth.uid() and points>0 and expires_at<=now();
  select coalesce(-sum(points),0) into spent from public.loyalty_transactions where user_id=auth.uid() and points<0 and kind<>'expire';
  select coalesce(-sum(points),0) into already_expired from public.loyalty_transactions where user_id=auth.uid() and kind='expire';
  amount:=least(available,greatest(expired_earned-spent-already_expired,0));
  if amount>0 then perform public.post_loyalty_points(auth.uid(),-amount,'expire','Puntos vencidos','expiry-total:'||auth.uid()||':'||expired_earned,null,null); end if;
  return amount;
end; $$;

create or replace function public.admin_adjust_loyalty(target_email text,point_delta integer,adjustment_reason text)
returns void language plpgsql security definer set search_path=''
as $$ declare target_user uuid;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if point_delta=0 or nullif(trim(adjustment_reason),'') is null then raise exception 'Indica puntos y motivo'; end if;
  select id into target_user from public.profiles where lower(email)=lower(trim(target_email));
  if target_user is null then raise exception 'La cuenta debe iniciar sesión al menos una vez'; end if;
  perform public.post_loyalty_points(target_user,point_delta,'adjust',trim(adjustment_reason),'admin-adjust:'||gen_random_uuid(),null,null);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'loyalty_adjusted','profiles',target_user::text,jsonb_build_object('points',point_delta,'reason',trim(adjustment_reason)));
end; $$;

create or replace function public.submit_barber_expense(expense_concept text,expense_amount numeric,expense_notes text default null)
returns uuid language plpgsql security definer set search_path=''
as $$ declare barber uuid; result_id uuid;
begin
  select id into barber from public.barber_profiles where user_id=auth.uid() and active;
  if barber is null then raise exception 'Perfil de peluquero requerido'; end if;
  if expense_amount<=0 or nullif(trim(expense_concept),'') is null then raise exception 'Concepto y monto son obligatorios'; end if;
  insert into public.barber_expenses(barber_id,concept,amount,notes) values(barber,trim(expense_concept),expense_amount,nullif(trim(expense_notes),'')) returning id into result_id;
  return result_id;
end; $$;

create or replace function public.review_barber_expense(target_expense uuid,next_status text)
returns void language plpgsql security definer set search_path=''
as $$ begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if next_status not in ('approved','rejected','reimbursed') then raise exception 'Estado no permitido'; end if;
  update public.barber_expenses set status=next_status,reviewed_by=auth.uid(),reviewed_at=now() where id=target_expense;
  if not found then raise exception 'Gasto no encontrado'; end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'barber_expense_reviewed','barber_expenses',target_expense::text,jsonb_build_object('status',next_status));
end; $$;

create or replace function public.create_barber_payout(target_barber uuid,start_date date,end_date date)
returns uuid language plpgsql security definer set search_path=''
as $$ declare result_id uuid; commissions numeric; incentives numeric; reimbursements numeric;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if start_date is null or end_date is null or start_date>end_date then raise exception 'Periodo inválido'; end if;
  select coalesce(sum(amount) filter (where kind='service_commission'),0),coalesce(sum(amount) filter (where kind='product_incentive'),0) into commissions,incentives from public.barber_earnings where barber_id=target_barber and status='pending' and created_at::date between start_date and end_date;
  select coalesce(sum(e.amount),0) into reimbursements from public.barber_expenses e where e.barber_id=target_barber and e.status='approved' and e.created_at::date between start_date and end_date and not exists(select 1 from public.payout_items pi where pi.expense_id=e.id);
  if commissions+incentives+reimbursements<=0 then raise exception 'No existen conceptos pendientes en el periodo'; end if;
  insert into public.payouts(barber_id,period_start,period_end,commission_amount,incentive_amount,reimbursement_amount,total_amount,status,created_by) values(target_barber,start_date,end_date,commissions,incentives,reimbursements,commissions+incentives+reimbursements,'approved',auth.uid()) returning id into result_id;
  insert into public.payout_items(payout_id,earning_id,amount) select result_id,id,amount from public.barber_earnings where barber_id=target_barber and status='pending' and created_at::date between start_date and end_date;
  insert into public.payout_items(payout_id,expense_id,amount) select result_id,e.id,e.amount from public.barber_expenses e where e.barber_id=target_barber and e.status='approved' and e.created_at::date between start_date and end_date and not exists(select 1 from public.payout_items pi where pi.expense_id=e.id);
  update public.barber_earnings set status='approved' where id in(select earning_id from public.payout_items where payout_id=result_id);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'barber_payout_created','payouts',result_id::text,jsonb_build_object('total',commissions+incentives+reimbursements,'period_start',start_date,'period_end',end_date));
  return result_id;
end; $$;

create or replace function public.mark_payout_paid(target_payout uuid)
returns void language plpgsql security definer set search_path=''
as $$ begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  update public.payouts set status='paid',paid_at=now() where id=target_payout and status='approved';
  if not found then raise exception 'Liquidación no disponible'; end if;
  update public.barber_earnings set status='paid' where id in(select earning_id from public.payout_items where payout_id=target_payout and earning_id is not null);
  update public.barber_expenses set status='reimbursed',reviewed_at=now(),reviewed_by=auth.uid() where id in(select expense_id from public.payout_items where payout_id=target_payout and expense_id is not null);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'barber_payout_paid','payouts',target_payout::text,'{}'::jsonb);
end; $$;

create or replace function public.get_or_create_support_conversation()
returns uuid language plpgsql security definer set search_path=''
as $$ declare result_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para enviar mensajes'; end if;
  select c.id into result_id from public.conversations c join public.conversation_participants cp on cp.conversation_id=c.id where cp.user_id=auth.uid() and c.status='open' order by c.created_at limit 1;
  if result_id is null then
    insert into public.conversations(created_by) values(auth.uid()) returning id into result_id;
    insert into public.conversation_participants(conversation_id,user_id) values(result_id,auth.uid());
  end if;
  return result_id;
end; $$;

create or replace function public.send_chat_message(target_conversation uuid,message_body text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare result_id uuid;
begin
  if not public.can_access_conversation(target_conversation) then raise exception 'Conversación no disponible'; end if;
  if nullif(trim(message_body),'') is null or length(trim(message_body))>2000 then raise exception 'Mensaje inválido'; end if;
  if (select count(*) from public.messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=10 then raise exception 'Espera un momento antes de enviar más mensajes'; end if;
  insert into public.messages(conversation_id,sender_id,body) values(target_conversation,auth.uid(),trim(message_body)) returning id into result_id;
  update public.conversations set updated_at=now() where id=target_conversation;
  return result_id;
end; $$;

revoke all on function public.is_cashier() from public;
revoke all on function public.set_cashier_role(text,boolean) from public;
revoke all on function public.open_cash_shift(numeric,text) from public;
revoke all on function public.record_cash_movement(text,numeric,text,text) from public;
revoke all on function public.close_cash_shift(numeric,text) from public;
revoke all on function public.register_counter_sale(uuid,uuid,text,text,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text) from public;
revoke all on function public.claim_guest_sale(text) from public;
revoke all on function public.reverse_counter_sale(uuid,text) from public;
revoke all on function public.request_reward_redemption(uuid) from public;
revoke all on function public.cancel_reward_redemption(uuid) from public;
revoke all on function public.refresh_my_loyalty() from public;
revoke all on function public.admin_adjust_loyalty(text,integer,text) from public;
revoke all on function public.submit_barber_expense(text,numeric,text) from public;
revoke all on function public.review_barber_expense(uuid,text) from public;
revoke all on function public.create_barber_payout(uuid,date,date) from public;
revoke all on function public.mark_payout_paid(uuid) from public;
revoke all on function public.get_or_create_support_conversation() from public;
revoke all on function public.send_chat_message(uuid,text) from public;
revoke all on function public.post_loyalty_points(uuid,integer,text,text,text,text,uuid) from public;
revoke all on function public.process_sale_loyalty(uuid) from public;
grant execute on function public.is_cashier() to authenticated;
grant execute on function public.set_cashier_role(text,boolean) to authenticated;
grant execute on function public.open_cash_shift(numeric,text) to authenticated;
grant execute on function public.record_cash_movement(text,numeric,text,text) to authenticated;
grant execute on function public.close_cash_shift(numeric,text) to authenticated;
grant execute on function public.register_counter_sale(uuid,uuid,text,text,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text) to authenticated;
grant execute on function public.claim_guest_sale(text) to authenticated;
grant execute on function public.reverse_counter_sale(uuid,text) to authenticated;
grant execute on function public.request_reward_redemption(uuid) to authenticated;
grant execute on function public.cancel_reward_redemption(uuid) to authenticated;
grant execute on function public.refresh_my_loyalty() to authenticated;
grant execute on function public.admin_adjust_loyalty(text,integer,text) to authenticated;
grant execute on function public.submit_barber_expense(text,numeric,text) to authenticated;
grant execute on function public.review_barber_expense(uuid,text) to authenticated;
grant execute on function public.create_barber_payout(uuid,date,date) to authenticated;
grant execute on function public.mark_payout_paid(uuid) to authenticated;
grant execute on function public.get_or_create_support_conversation() to authenticated;
grant execute on function public.send_chat_message(uuid,text) to authenticated;
