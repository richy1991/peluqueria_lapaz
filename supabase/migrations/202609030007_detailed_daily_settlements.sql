-- Liquidación detallada: servicios diarios, gastos descontables e incentivos
-- de productos acumulados que caja puede incluir de forma explícita.

alter table public.payouts
  add column if not exists deduction_amount numeric(12,2) not null default 0 check(deduction_amount>=0),
  add column if not exists includes_accumulated_incentives boolean not null default false;

alter table public.barber_expenses drop constraint if exists barber_expenses_status_check;
alter table public.barber_expenses add constraint barber_expenses_status_check
  check(status in ('pending','approved','rejected','reimbursed','deducted'));

create or replace function public.cashier_get_barber_settlement_detail(target_barber uuid,work_date date default null)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
  business_day date:=coalesce(work_date,(now() at time zone 'America/La_Paz')::date);
  day_start timestamptz:=(business_day::timestamp at time zone 'America/La_Paz');
  day_end timestamptz:=((business_day+1)::timestamp at time zone 'America/La_Paz');
  barber public.barber_profiles%rowtype; current_payout public.payouts%rowtype;
  services jsonb:='[]'::jsonb; incentives jsonb:='[]'::jsonb; expenses jsonb:='[]'::jsonb;
  commissions numeric:=0; incentive_total numeric:=0; deductions numeric:=0; remaining_incentives numeric:=0;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  select * into barber from public.barber_profiles where id=target_barber;
  if not found then raise exception 'Peluquero no encontrado'; end if;
  select * into current_payout from public.payouts where barber_id=target_barber and period_start=business_day and period_end=business_day and status<>'canceled' order by created_at desc limit 1;

  if current_payout.id is null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'name',coalesce(si.name_snapshot,'Servicio'),'base_amount',e.base_amount,
      'rate_percent',e.rate_percent,'amount',e.amount,'created_at',e.created_at
    ) order by e.created_at),'[]'::jsonb),coalesce(sum(e.amount),0)
    into services,commissions
    from public.barber_earnings e left join public.sale_items si on si.id=e.sale_item_id
    where e.barber_id=target_barber and e.kind='service_commission' and e.status='pending'
      and e.created_at>=day_start and e.created_at<day_end;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'name',coalesce(si.name_snapshot,'Producto'),'base_amount',e.base_amount,
      'rate_percent',e.rate_percent,'amount',e.amount,'created_at',e.created_at
    ) order by e.created_at),'[]'::jsonb),coalesce(sum(e.amount),0)
    into incentives,incentive_total
    from public.barber_earnings e left join public.sale_items si on si.id=e.sale_item_id
    where e.barber_id=target_barber and e.kind='product_incentive' and e.status='pending' and e.created_at<day_end;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'concept',x.concept,'amount',x.amount,'status',x.status,'notes',x.notes,'created_at',x.created_at
    ) order by x.created_at),'[]'::jsonb),coalesce(sum(x.amount) filter(where x.status='approved'),0)
    into expenses,deductions
    from public.barber_expenses x
    where x.barber_id=target_barber and x.status in ('pending','approved') and x.created_at<day_end
      and not exists(select 1 from public.payout_items pi where pi.expense_id=x.id);
  else
    commissions:=current_payout.commission_amount; incentive_total:=current_payout.incentive_amount; deductions:=current_payout.deduction_amount;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'name',coalesce(si.name_snapshot,'Servicio'),'base_amount',e.base_amount,
      'rate_percent',e.rate_percent,'amount',e.amount,'created_at',e.created_at
    ) order by e.created_at),'[]'::jsonb) into services
    from public.payout_items pi join public.barber_earnings e on e.id=pi.earning_id left join public.sale_items si on si.id=e.sale_item_id
    where pi.payout_id=current_payout.id and e.kind='service_commission';

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'name',coalesce(si.name_snapshot,'Producto'),'base_amount',e.base_amount,
      'rate_percent',e.rate_percent,'amount',e.amount,'created_at',e.created_at
    ) order by e.created_at),'[]'::jsonb) into incentives
    from public.payout_items pi join public.barber_earnings e on e.id=pi.earning_id left join public.sale_items si on si.id=e.sale_item_id
    where pi.payout_id=current_payout.id and e.kind='product_incentive';

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'concept',x.concept,'amount',x.amount,'status',x.status,'notes',x.notes,'created_at',x.created_at
    ) order by x.created_at),'[]'::jsonb) into expenses
    from public.payout_items pi join public.barber_expenses x on x.id=pi.expense_id
    where pi.payout_id=current_payout.id;
  end if;

  select coalesce(sum(e.amount),0) into remaining_incentives from public.barber_earnings e
  where e.barber_id=target_barber and e.kind='product_incentive' and e.status='pending' and e.created_at<day_end;

  return jsonb_build_object(
    'barber',jsonb_build_object('id',barber.id,'name',barber.display_name),
    'work_date',business_day,'payout',case when current_payout.id is null then null else jsonb_build_object(
      'id',current_payout.id,'status',current_payout.status,'commission_amount',current_payout.commission_amount,
      'incentive_amount',current_payout.incentive_amount,'deduction_amount',current_payout.deduction_amount,
      'reimbursement_amount',current_payout.reimbursement_amount,
      'total_amount',current_payout.total_amount,'includes_accumulated_incentives',current_payout.includes_accumulated_incentives,
      'paid_at',current_payout.paid_at) end,
    'services',services,'incentives',incentives,'expenses',expenses,
    'commission_total',commissions,'incentive_total',incentive_total,'deduction_total',deductions,
    'daily_total',greatest(commissions-deductions,0),'total_with_incentives',greatest(commissions+incentive_total-deductions,0),
    'remaining_incentive_total',remaining_incentives
  );
end; $$;

create or replace function public.create_daily_barber_payout_v2(
  target_barber uuid,work_date date default null,include_accumulated_incentives boolean default false
) returns uuid language plpgsql security definer set search_path=''
as $$ declare
  result_id uuid; shift_id uuid; business_day date:=coalesce(work_date,(now() at time zone 'America/La_Paz')::date);
  day_start timestamptz:=(business_day::timestamp at time zone 'America/La_Paz');
  day_end timestamptz:=((business_day+1)::timestamp at time zone 'America/La_Paz');
  commissions numeric:=0; incentives numeric:=0; deductions numeric:=0; net_total numeric:=0;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if not public.is_admin() and business_day<>(now() at time zone 'America/La_Paz')::date then raise exception 'Caja solo puede liquidar la jornada actual'; end if;
  select id into shift_id from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift_id is null then raise exception 'Debes abrir caja antes de preparar liquidaciones'; end if;
  if not exists(select 1 from public.barber_profiles where id=target_barber and active) then raise exception 'El peluquero no está activo'; end if;
  if exists(select 1 from public.payouts where barber_id=target_barber and period_start=business_day and period_end=business_day and status<>'canceled') then raise exception 'Este peluquero ya tiene una liquidación para la jornada'; end if;
  if exists(select 1 from public.barber_expenses x where x.barber_id=target_barber and x.status='pending' and x.created_at<day_end
    and not exists(select 1 from public.payout_items pi where pi.expense_id=x.id)) then
    raise exception 'Revisa los gastos pendientes antes de preparar la liquidación';
  end if;

  perform 1 from public.barber_earnings e where e.barber_id=target_barber and e.status='pending'
    and ((e.kind='service_commission' and e.created_at>=day_start and e.created_at<day_end)
      or (include_accumulated_incentives and e.kind='product_incentive' and e.created_at<day_end)) for update;
  perform 1 from public.barber_expenses x where x.barber_id=target_barber and x.status='approved' and x.created_at<day_end
    and not exists(select 1 from public.payout_items pi where pi.expense_id=x.id) for update;

  select coalesce(sum(e.amount),0) into commissions from public.barber_earnings e
  where e.barber_id=target_barber and e.kind='service_commission' and e.status='pending' and e.created_at>=day_start and e.created_at<day_end;
  if include_accumulated_incentives then
    select coalesce(sum(e.amount),0) into incentives from public.barber_earnings e
    where e.barber_id=target_barber and e.kind='product_incentive' and e.status='pending' and e.created_at<day_end;
  end if;
  select coalesce(sum(x.amount),0) into deductions from public.barber_expenses x
  where x.barber_id=target_barber and x.status='approved' and x.created_at<day_end
    and not exists(select 1 from public.payout_items pi where pi.expense_id=x.id);
  net_total:=commissions+incentives-deductions;
  if commissions+incentives<=0 then raise exception 'No existen comisiones pendientes para liquidar'; end if;
  if net_total<=0 then raise exception 'Los gastos pendientes igualan o superan la comisión; quedarán acumulados para la siguiente jornada'; end if;

  insert into public.payouts(barber_id,period_start,period_end,commission_amount,incentive_amount,reimbursement_amount,deduction_amount,total_amount,includes_accumulated_incentives,status,created_by)
  values(target_barber,business_day,business_day,commissions,incentives,0,deductions,net_total,include_accumulated_incentives,'approved',auth.uid()) returning id into result_id;

  insert into public.payout_items(payout_id,earning_id,amount)
  select result_id,e.id,e.amount from public.barber_earnings e where e.barber_id=target_barber and e.status='pending'
    and ((e.kind='service_commission' and e.created_at>=day_start and e.created_at<day_end)
      or (include_accumulated_incentives and e.kind='product_incentive' and e.created_at<day_end));
  insert into public.payout_items(payout_id,expense_id,amount)
  select result_id,x.id,-x.amount from public.barber_expenses x where x.barber_id=target_barber and x.status='approved' and x.created_at<day_end
    and not exists(select 1 from public.payout_items pi where pi.expense_id=x.id);
  update public.barber_earnings set status='approved' where id in(select earning_id from public.payout_items where payout_id=result_id and earning_id is not null);

  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'daily_barber_payout_v2_created','payouts',result_id::text,
    jsonb_build_object('work_date',business_day,'commissions',commissions,'incentives',incentives,'deductions',deductions,'total',net_total,'include_accumulated_incentives',include_accumulated_incentives,'shift_id',shift_id));
  return result_id;
end; $$;

-- Compatibilidad con clientes que todavia invoquen la firma anterior. La
-- operacion segura nunca incluye incentivos sin confirmacion expresa y trata
-- los gastos como descuentos, no como reembolsos.
create or replace function public.create_daily_barber_payout(target_barber uuid,work_date date default null)
returns uuid language plpgsql security definer set search_path=''
as $$
begin
  return public.create_daily_barber_payout_v2(target_barber,work_date,false);
end; $$;

create or replace function public.pay_daily_barber_payout(target_payout uuid,payment_method text default 'cash')
returns jsonb language plpgsql security definer set search_path=''
as $$ declare payout public.payouts%rowtype; shift_id uuid; movement_id uuid; barber_name text;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;
  if payment_method not in ('cash','qr','transfer','card','other') then raise exception 'Forma de pago no permitida'; end if;
  select * into payout from public.payouts where id=target_payout for update;
  if not found or payout.status<>'approved' or payout.period_start<>payout.period_end then raise exception 'La liquidación diaria no está disponible'; end if;
  if payout.total_amount<=0 then raise exception 'La liquidación no tiene un importe pagable'; end if;
  if not public.is_admin() and payout.period_start<>(now() at time zone 'America/La_Paz')::date then raise exception 'Caja solo puede pagar liquidaciones de la jornada actual'; end if;
  select id into shift_id from public.cash_shifts where opened_by=auth.uid() and status='open' order by opened_at desc limit 1;
  if shift_id is null then raise exception 'Debes abrir caja antes de pagar una liquidación'; end if;
  select display_name into barber_name from public.barber_profiles where id=payout.barber_id;
  insert into public.cash_movements(shift_id,kind,amount,payment_method,reason,created_by,payout_id)
  values(shift_id,'expense',-payout.total_amount,payment_method,'Liquidación diaria: '||coalesce(barber_name,'peluquero'),auth.uid(),payout.id) returning id into movement_id;
  update public.payouts set status='paid',paid_at=now() where id=payout.id;
  update public.barber_earnings set status='paid' where id in(select earning_id from public.payout_items where payout_id=payout.id and earning_id is not null);
  update public.barber_expenses set status=case when payout.reimbursement_amount>0 and payout.deduction_amount=0 then 'reimbursed' else 'deducted' end,
    reviewed_at=now(),reviewed_by=auth.uid()
  where id in(select expense_id from public.payout_items where payout_id=payout.id and expense_id is not null);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'daily_barber_payout_paid','payouts',payout.id::text,
    jsonb_build_object('total',payout.total_amount,'deductions',payout.deduction_amount,'payment_method',payment_method,'movement_id',movement_id,'shift_id',shift_id));
  return jsonb_build_object('payout_id',payout.id,'movement_id',movement_id,'total',payout.total_amount,'barber',barber_name);
end; $$;

revoke all on function public.cashier_get_barber_settlement_detail(uuid,date) from public;
revoke all on function public.create_daily_barber_payout_v2(uuid,date,boolean) from public;
revoke all on function public.create_daily_barber_payout(uuid,date) from public;
grant execute on function public.cashier_get_barber_settlement_detail(uuid,date) to authenticated;
grant execute on function public.create_daily_barber_payout_v2(uuid,date,boolean) to authenticated;
grant execute on function public.create_daily_barber_payout(uuid,date) to authenticated;
