-- Pagos directos por servicios e incentivos, con soporte para anticipos parciales.
-- Una comisión puede aparecer en más de un pago hasta completar su importe.
drop index if exists public.payout_items_earning_unique;
create index if not exists payout_items_earning_lookup on public.payout_items(earning_id) where earning_id is not null;

-- Permite varios abonos en la misma jornada para un mismo peluquero.
drop index if exists public.payouts_one_daily_settlement;

create or replace function public.cashier_get_barber_settlement_detail_v3(target_barber uuid,work_date date default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  business_day date:=coalesce(work_date,(now() at time zone 'America/La_Paz')::date);
  day_end timestamptz:=((business_day+1)::timestamp at time zone 'America/La_Paz');
  barber public.barber_profiles%rowtype;
  services jsonb:='[]'::jsonb;
  incentives jsonb:='[]'::jsonb;
  commissions numeric:=0;
  incentive_total numeric:=0;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  select * into barber from public.barber_profiles where id=target_barber;
  if not found then raise exception 'Peluquero no encontrado'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'name',coalesce(si.name_snapshot,'Servicio'),'base_amount',e.base_amount,
    'rate_percent',e.rate_percent,'amount',remaining.amount,'created_at',e.created_at
  ) order by e.created_at,e.id),'[]'::jsonb),coalesce(sum(remaining.amount),0)
  into services,commissions
  from public.barber_earnings e
  left join public.sale_items si on si.id=e.sale_item_id
  cross join lateral (
    select greatest(e.amount-coalesce(sum(pi.amount),0),0)::numeric(12,2) as amount
    from public.payout_items pi join public.payouts p on p.id=pi.payout_id and p.status='paid'
    where pi.earning_id=e.id
  ) remaining
  where e.barber_id=target_barber and e.kind='service_commission' and e.status<>'reversed'
    and e.created_at<day_end and remaining.amount>0;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'name',coalesce(si.name_snapshot,'Producto'),'base_amount',e.base_amount,
    'rate_percent',e.rate_percent,'amount',remaining.amount,'created_at',e.created_at
  ) order by e.created_at,e.id),'[]'::jsonb),coalesce(sum(remaining.amount),0)
  into incentives,incentive_total
  from public.barber_earnings e
  left join public.sale_items si on si.id=e.sale_item_id
  cross join lateral (
    select greatest(e.amount-coalesce(sum(pi.amount),0),0)::numeric(12,2) as amount
    from public.payout_items pi join public.payouts p on p.id=pi.payout_id and p.status='paid'
    where pi.earning_id=e.id
  ) remaining
  where e.barber_id=target_barber and e.kind='product_incentive' and e.status<>'reversed'
    and e.created_at<day_end and remaining.amount>0;

  return jsonb_build_object(
    'barber',jsonb_build_object('id',barber.id,'name',barber.display_name),
    'work_date',business_day,'payout',null,
    'services',services,'new_services',services,'new_commission_total',commissions,
    'incentives',incentives,'expenses','[]'::jsonb,
    'commission_total',commissions,'incentive_total',incentive_total,
    'deduction_total',0,'daily_total',commissions,
    'total_with_incentives',commissions+incentive_total,
    'remaining_incentive_total',incentive_total
  );
end;
$$;

revoke all on function public.cashier_get_barber_settlement_detail_v3(uuid,date) from public;
grant execute on function public.cashier_get_barber_settlement_detail_v3(uuid,date) to authenticated;

create or replace function public.cashier_pay_barber_settlement_mixed(
  target_barber uuid,
  work_date date,
  service_amount numeric,
  include_accumulated_incentives boolean,
  payment_splits jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  business_day date:=coalesce(work_date,(now() at time zone 'America/La_Paz')::date);
  shift_id uuid;
  result_payout_id uuid;
  barber_name text;
  earning record;
  split jsonb;
  split_method text;
  split_amount numeric;
  split_total numeric:=0;
  services_available numeric:=0;
  incentives_available numeric:=0;
  amount_left numeric:=0;
  allocation numeric:=0;
  incentive_to_pay numeric:=0;
  total_to_pay numeric:=0;
  movement_id uuid;
  movement_rows jsonb:='[]'::jsonb;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if not public.is_admin() and business_day<>(now() at time zone 'America/La_Paz')::date then
    raise exception 'Caja solo puede pagar liquidaciones de la jornada actual';
  end if;
  if service_amount is null or service_amount<0 or round(service_amount,2)<>service_amount then
    raise exception 'El monto de servicios debe ser válido y tener máximo dos decimales';
  end if;
  if payment_splits is null or jsonb_typeof(payment_splits) is distinct from 'array'
      or jsonb_array_length(payment_splits)<1 or jsonb_array_length(payment_splits)>5 then
    raise exception 'Distribuye el pago entre una y cinco formas de pago';
  end if;
  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,-1);
    if split_method is null or split_method not in ('cash','qr','transfer','card','other')
      or split_amount<0 or round(split_amount,2)<>split_amount then
      raise exception 'Revisa las formas e importes de pago';
    end if;
    split_total:=split_total+split_amount;
  end loop;

  perform 1 from public.barber_profiles where id=target_barber and active for update;
  if not found then raise exception 'El peluquero no está activo'; end if;
  select display_name into barber_name from public.barber_profiles where id=target_barber;
  select id into shift_id from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift_id is null then raise exception 'Debes abrir caja antes de pagar una liquidación'; end if;

  -- Libera una liquidación antigua que quedó preparada, para rehacerla como un pago directo.
  with canceled as (
    update public.payouts set status='canceled'
    where barber_id=target_barber and status='approved'
    returning id
  )
  delete from public.payout_items pi using canceled where pi.payout_id=canceled.id;
  update public.barber_earnings e set status='pending'
  where e.barber_id=target_barber and e.status='approved'
    and e.kind in ('service_commission','product_incentive')
    and not exists(
      select 1 from public.payout_items pi join public.payouts p on p.id=pi.payout_id
      where pi.earning_id=e.id and p.status in ('approved','paid')
    );

  perform e.id from public.barber_earnings e
  where e.barber_id=target_barber and e.kind in ('service_commission','product_incentive')
    and e.status<>'reversed' and e.created_at<((business_day+1)::timestamp at time zone 'America/La_Paz')
  order by e.created_at,e.id for update of e;

  select coalesce(sum(greatest(e.amount-coalesce(paid.amount,0),0)),0) into services_available
  from public.barber_earnings e
  left join lateral (
    select sum(pi.amount) as amount from public.payout_items pi
    join public.payouts p on p.id=pi.payout_id and p.status='paid'
    where pi.earning_id=e.id
  ) paid on true
  where e.barber_id=target_barber and e.kind='service_commission' and e.status<>'reversed'
    and e.created_at<((business_day+1)::timestamp at time zone 'America/La_Paz');
  select coalesce(sum(greatest(e.amount-coalesce(paid.amount,0),0)),0) into incentives_available
  from public.barber_earnings e
  left join lateral (
    select sum(pi.amount) as amount from public.payout_items pi
    join public.payouts p on p.id=pi.payout_id and p.status='paid'
    where pi.earning_id=e.id
  ) paid on true
  where e.barber_id=target_barber and e.kind='product_incentive' and e.status<>'reversed'
    and e.created_at<((business_day+1)::timestamp at time zone 'America/La_Paz');

  if service_amount>services_available then raise exception 'El anticipo supera el saldo de servicios disponible (%).',services_available; end if;
  if include_accumulated_incentives then incentive_to_pay:=incentives_available; end if;
  total_to_pay:=service_amount+incentive_to_pay;
  if total_to_pay<=0 then raise exception 'No hay un importe pendiente para pagar'; end if;
  if round(split_total,2)<>round(total_to_pay,2) then raise exception 'La suma de los pagos debe coincidir con el total a pagar'; end if;

  insert into public.payouts(
    barber_id,period_start,period_end,commission_amount,incentive_amount,
    reimbursement_amount,deduction_amount,total_amount,includes_accumulated_incentives,
    status,created_by,paid_at
  ) values(
    target_barber,business_day,business_day,service_amount,incentive_to_pay,
    0,0,total_to_pay,include_accumulated_incentives,'paid',auth.uid(),now()
  ) returning id into result_payout_id;

  amount_left:=service_amount;
  for earning in
    select e.id,greatest(e.amount-coalesce(paid.amount,0),0)::numeric(12,2) as remaining
    from public.barber_earnings e
    left join lateral (
      select sum(pi.amount) as amount from public.payout_items pi
      join public.payouts p on p.id=pi.payout_id and p.status='paid'
      where pi.earning_id=e.id
    ) paid on true
    where e.barber_id=target_barber and e.kind='service_commission' and e.status<>'reversed'
      and e.created_at<((business_day+1)::timestamp at time zone 'America/La_Paz')
      and e.amount>coalesce(paid.amount,0)
    order by e.created_at,e.id for update of e
  loop
    exit when amount_left<=0;
    allocation:=least(earning.remaining,amount_left);
    insert into public.payout_items(payout_id,earning_id,amount) values(result_payout_id,earning.id,allocation);
    amount_left:=amount_left-allocation;
  end loop;

  if include_accumulated_incentives then
    for earning in
      select e.id,greatest(e.amount-coalesce(paid.amount,0),0)::numeric(12,2) as remaining
      from public.barber_earnings e
      left join lateral (
        select sum(pi.amount) as amount from public.payout_items pi
        join public.payouts p on p.id=pi.payout_id and p.status='paid'
        where pi.earning_id=e.id
      ) paid on true
      where e.barber_id=target_barber and e.kind='product_incentive' and e.status<>'reversed'
        and e.created_at<((business_day+1)::timestamp at time zone 'America/La_Paz')
        and e.amount>coalesce(paid.amount,0)
      order by e.created_at,e.id for update of e
    loop
      insert into public.payout_items(payout_id,earning_id,amount) values(result_payout_id,earning.id,earning.remaining);
    end loop;
  end if;

  for split in select value from jsonb_array_elements(payment_splits) loop
    split_method:=split->>'method';
    split_amount:=coalesce(nullif(split->>'amount','')::numeric,0);
    if split_amount>0 then
      insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,payout_id)
      values(shift_id,'expense',-split_amount,split_method,'Liquidación: '||coalesce(barber_name,'peluquero'),auth.uid(),result_payout_id)
      returning id into movement_id;
      movement_rows:=movement_rows||jsonb_build_array(jsonb_build_object('movement_id',movement_id,'method',split_method,'amount',split_amount));
    end if;
  end loop;

  update public.barber_earnings e set status=case when (
    select coalesce(sum(pi.amount),0) from public.payout_items pi
    join public.payouts p on p.id=pi.payout_id and p.status='paid'
    where pi.earning_id=e.id
  )>=e.amount then 'paid' else 'pending' end
  where e.id in(select pi.earning_id from public.payout_items pi where pi.payout_id=result_payout_id and pi.earning_id is not null);

  insert into public.audit_logs(actor_id,action,entity,entity_id,data)
  values(auth.uid(),'barber_settlement_paid','payouts',result_payout_id::text,
    jsonb_build_object('barber_id',target_barber,'services',service_amount,'incentives',incentive_to_pay,
      'total',total_to_pay,'payment_splits',payment_splits,'movements',movement_rows,'shift_id',shift_id));

  return jsonb_build_object('payout_id',result_payout_id,'barber',barber_name,'services',service_amount,
    'incentives',incentive_to_pay,'total',total_to_pay,'movements',movement_rows);
end;
$$;

revoke all on function public.cashier_pay_barber_settlement_mixed(uuid,date,numeric,boolean,jsonb) from public;
grant execute on function public.cashier_pay_barber_settlement_mixed(uuid,date,numeric,boolean,jsonb) to authenticated;
