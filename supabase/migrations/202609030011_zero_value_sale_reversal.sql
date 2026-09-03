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
    else
      select balance into account_balance from public.loyalty_accounts where user_id=earning.user_id for update;
      reversal_points:=least(coalesce(account_balance,0),earning.points);
      if reversal_points>0 then perform public.post_loyalty_points(earning.user_id,-reversal_points,'reverse','Reversion: '||clean_reason,'reverse-sale:'||sale.id||':'||earning.id,'sale',sale.id); end if;
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
  if sale.paid_total<>0 then
    insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by)
    select shift,'refund',-sale.paid_total,method,'Devolucion: '||clean_reason,auth.uid() from public.payments where sale_id=sale.id order by created_at limit 1;
  end if;
  update public.sales set status='refunded',reversal_reason=clean_reason,reversed_at=now(),reversed_by=auth.uid(),updated_at=now() where id=sale.id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'sale_refunded','sales',sale.id::text,jsonb_build_object('reason',clean_reason,'amount',sale.paid_total));
end; $$;

revoke all on function public.reverse_counter_sale(uuid,text) from public;
grant execute on function public.reverse_counter_sale(uuid,text) to authenticated;
