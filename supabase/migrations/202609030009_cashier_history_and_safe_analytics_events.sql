-- Historial trazable y reactivacion segura de analitica consentida.

alter table public.sales
  add column if not exists reversal_reason text,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references public.profiles(id);

with history as(
  select distinct on(a.entity_id) a.entity_id,a.data,a.created_at,a.actor_id from public.audit_logs a
  where a.action='sale_refunded' and a.entity='sales' order by a.entity_id,a.created_at desc
)
update public.sales s set reversal_reason=history.data->>'reason',reversed_at=history.created_at,reversed_by=history.actor_id
from history where s.status='refunded' and s.reversed_at is null and history.entity_id=s.id::text;

create index if not exists web_events_created_at_idx on public.web_events(created_at desc);
create index if not exists web_events_session_created_idx on public.web_events(session_id,created_at desc);

create or replace function public.record_public_web_event(
  event_session text,event_name text,event_path text default null,event_referrer text default null,
  event_campaign jsonb default '{}'::jsonb,event_data jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=''
as $$ declare clean_session text:=lower(trim(coalesce(event_session,''))); clean_name text:=lower(trim(coalesce(event_name,'')));
begin
  if clean_session !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Sesion de analitica invalida'; end if;
  if clean_name not in ('page_view','click') then raise exception 'Evento no permitido'; end if;
  if event_path is null or length(event_path) not between 1 and 300 then raise exception 'Ruta no valida'; end if;
  if length(coalesce(event_referrer,''))>500 then raise exception 'Referencia demasiado extensa'; end if;
  if jsonb_typeof(coalesce(event_campaign,'{}'::jsonb))<>'object' or length(coalesce(event_campaign,'{}'::jsonb)::text)>1500 then raise exception 'Campana no valida'; end if;
  if jsonb_typeof(coalesce(event_data,'{}'::jsonb))<>'object' or length(coalesce(event_data,'{}'::jsonb)::text)>2000 then raise exception 'Datos no validos'; end if;
  if (select count(*) from public.web_events where session_id=clean_session and created_at>now()-interval '1 minute')>=60 then raise exception 'Demasiados eventos'; end if;
  if (select count(*) from public.web_events where created_at>now()-interval '1 minute')>=5000 then raise exception 'Analitica temporalmente limitada'; end if;
  insert into public.web_events(user_id,session_id,event_name,path,referrer,campaign,data)
  values(auth.uid(),clean_session,clean_name,left(event_path,300),nullif(left(coalesce(event_referrer,''),500),''),coalesce(event_campaign,'{}'::jsonb),coalesce(event_data,'{}'::jsonb));
end; $$;

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
    values(earning.barber_id,earning.sale_item_id,'reversal',earning.base_amount,earning.rate_percent,-earning.amount,'reversed')
    on conflict(sale_item_id,kind) do nothing;
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
  insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by)
  select shift,'refund',-sale.paid_total,method,'Devolucion: '||clean_reason,auth.uid() from public.payments where sale_id=sale.id order by created_at limit 1;
  update public.sales set status='refunded',reversal_reason=clean_reason,reversed_at=now(),reversed_by=auth.uid(),updated_at=now() where id=sale.id;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'sale_refunded','sales',sale.id::text,jsonb_build_object('reason',clean_reason,'amount',sale.paid_total));
end; $$;

revoke all on function public.record_public_web_event(text,text,text,text,jsonb,jsonb) from public;
grant execute on function public.record_public_web_event(text,text,text,text,jsonb,jsonb) to anon,authenticated;
revoke all on function public.reverse_counter_sale(uuid,text) from public;
grant execute on function public.reverse_counter_sale(uuid,text) to authenticated;
