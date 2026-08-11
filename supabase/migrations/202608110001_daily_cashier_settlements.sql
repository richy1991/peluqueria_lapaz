alter table public.cash_movements
  add column if not exists payout_id uuid references public.payouts(id) on delete set null;

create unique index if not exists cash_movements_payout_unique
  on public.cash_movements(payout_id) where payout_id is not null;

create unique index if not exists payouts_one_daily_settlement
  on public.payouts(barber_id, period_start)
  where period_start = period_end and status <> 'canceled';

create policy "Cashiers read barber earnings"
  on public.barber_earnings for select to authenticated
  using (public.is_cashier());

create policy "Cashiers read team expenses"
  on public.barber_expenses for select to authenticated
  using (public.is_cashier());

create policy "Cashiers read payouts"
  on public.payouts for select to authenticated
  using (public.is_cashier());

create policy "Cashiers read payout items"
  on public.payout_items for select to authenticated
  using (public.is_cashier());

create or replace function public.cashier_review_barber_expense(
  target_expense uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  shift_id uuid;
begin
  if not public.is_cashier() then
    raise exception 'Acceso de caja requerido.' using errcode = 'P0001';
  end if;
  if next_status not in ('approved', 'rejected') then
    raise exception 'Estado de gasto no permitido.' using errcode = 'P0001';
  end if;
  select id into shift_id from public.cash_shifts
  where opened_by = auth.uid() and status = 'open'
  order by opened_at desc limit 1;
  if shift_id is null then
    raise exception 'Debes abrir caja antes de revisar gastos.' using errcode = 'P0001';
  end if;

  update public.barber_expenses
  set status = next_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = target_expense and status = 'pending';
  if not found then
    raise exception 'El gasto ya fue revisado o no existe.' using errcode = 'P0001';
  end if;

  insert into public.audit_logs(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'cashier_barber_expense_reviewed', 'barber_expenses', target_expense::text,
    jsonb_build_object('status', next_status, 'shift_id', shift_id));
end;
$$;

create or replace function public.create_daily_barber_payout(
  target_barber uuid,
  work_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  shift_id uuid;
  business_day date := coalesce(work_date, (now() at time zone 'America/La_Paz')::date);
  commissions numeric := 0;
  incentives numeric := 0;
  reimbursements numeric := 0;
begin
  if not public.is_cashier() then
    raise exception 'Acceso de caja requerido.' using errcode = 'P0001';
  end if;
  if not public.is_admin() and business_day <> (now() at time zone 'America/La_Paz')::date then
    raise exception 'Caja solo puede liquidar la jornada actual.' using errcode = 'P0001';
  end if;
  select id into shift_id from public.cash_shifts
  where opened_by = auth.uid() and status = 'open'
  order by opened_at desc limit 1;
  if shift_id is null then
    raise exception 'Debes abrir caja antes de preparar liquidaciones.' using errcode = 'P0001';
  end if;
  if not exists(select 1 from public.barber_profiles where id = target_barber and active) then
    raise exception 'El peluquero no está activo.' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.payouts where barber_id = target_barber
    and period_start = business_day and period_end = business_day and status <> 'canceled') then
    raise exception 'Este peluquero ya tiene una liquidación para la jornada.' using errcode = 'P0001';
  end if;

  select
    coalesce(sum(amount) filter (where kind = 'service_commission'), 0),
    coalesce(sum(amount) filter (where kind = 'product_incentive'), 0)
  into commissions, incentives
  from public.barber_earnings
  where barber_id = target_barber and status = 'pending'
    and (created_at at time zone 'America/La_Paz')::date = business_day;

  select coalesce(sum(expense.amount), 0) into reimbursements
  from public.barber_expenses expense
  where expense.barber_id = target_barber and expense.status = 'approved'
    and (expense.created_at at time zone 'America/La_Paz')::date = business_day
    and not exists(select 1 from public.payout_items item where item.expense_id = expense.id);

  if commissions + incentives + reimbursements <= 0 then
    raise exception 'No existen conceptos pendientes para este peluquero en la jornada.' using errcode = 'P0001';
  end if;

  insert into public.payouts(
    barber_id, period_start, period_end, commission_amount,
    incentive_amount, reimbursement_amount, total_amount, status, created_by
  ) values (
    target_barber, business_day, business_day, commissions,
    incentives, reimbursements, commissions + incentives + reimbursements,
    'approved', auth.uid()
  ) returning id into result_id;

  insert into public.payout_items(payout_id, earning_id, amount)
  select result_id, id, amount from public.barber_earnings
  where barber_id = target_barber and status = 'pending'
    and (created_at at time zone 'America/La_Paz')::date = business_day;

  insert into public.payout_items(payout_id, expense_id, amount)
  select result_id, expense.id, expense.amount from public.barber_expenses expense
  where expense.barber_id = target_barber and expense.status = 'approved'
    and (expense.created_at at time zone 'America/La_Paz')::date = business_day
    and not exists(select 1 from public.payout_items item where item.expense_id = expense.id);

  update public.barber_earnings set status = 'approved'
  where id in(select earning_id from public.payout_items where payout_id = result_id);

  insert into public.audit_logs(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'daily_barber_payout_created', 'payouts', result_id::text,
    jsonb_build_object('total', commissions + incentives + reimbursements,
      'work_date', business_day, 'shift_id', shift_id));
  return result_id;
end;
$$;

create or replace function public.pay_daily_barber_payout(
  target_payout uuid,
  payment_method text default 'cash'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payout public.payouts%rowtype;
  shift_id uuid;
  movement_id uuid;
  barber_name text;
begin
  if not public.is_cashier() then
    raise exception 'Acceso de caja requerido.' using errcode = 'P0001';
  end if;
  if payment_method not in ('cash', 'qr', 'transfer', 'card', 'other') then
    raise exception 'Forma de pago no permitida.' using errcode = 'P0001';
  end if;
  select * into payout from public.payouts where id = target_payout for update;
  if not found or payout.status <> 'approved' or payout.period_start <> payout.period_end then
    raise exception 'La liquidación diaria no está disponible.' using errcode = 'P0001';
  end if;
  if not public.is_admin() and payout.period_start <> (now() at time zone 'America/La_Paz')::date then
    raise exception 'Caja solo puede pagar liquidaciones de la jornada actual.' using errcode = 'P0001';
  end if;
  select id into shift_id from public.cash_shifts
  where opened_by = auth.uid() and status = 'open'
  order by opened_at desc limit 1;
  if shift_id is null then
    raise exception 'Debes abrir caja antes de pagar una liquidación.' using errcode = 'P0001';
  end if;
  select display_name into barber_name from public.barber_profiles where id = payout.barber_id;

  insert into public.cash_movements(
    shift_id, kind, amount, payment_method, reason, created_by, payout_id
  ) values (
    shift_id, 'expense', -payout.total_amount, payment_method,
    'Liquidación diaria: ' || coalesce(barber_name, 'peluquero'), auth.uid(), payout.id
  ) returning id into movement_id;

  update public.payouts set status = 'paid', paid_at = now() where id = payout.id;
  update public.barber_earnings set status = 'paid'
  where id in(select earning_id from public.payout_items where payout_id = payout.id and earning_id is not null);
  update public.barber_expenses set status = 'reimbursed', reviewed_at = now(), reviewed_by = auth.uid()
  where id in(select expense_id from public.payout_items where payout_id = payout.id and expense_id is not null);

  insert into public.audit_logs(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'daily_barber_payout_paid', 'payouts', payout.id::text,
    jsonb_build_object('total', payout.total_amount, 'payment_method', payment_method,
      'movement_id', movement_id, 'shift_id', shift_id));

  return jsonb_build_object('payout_id', payout.id, 'movement_id', movement_id,
    'total', payout.total_amount, 'barber', barber_name);
end;
$$;

revoke all on function public.cashier_review_barber_expense(uuid, text) from public;
revoke all on function public.create_daily_barber_payout(uuid, date) from public;
revoke all on function public.pay_daily_barber_payout(uuid, text) from public;
grant execute on function public.cashier_review_barber_expense(uuid, text) to authenticated;
grant execute on function public.create_daily_barber_payout(uuid, date) to authenticated;
grant execute on function public.pay_daily_barber_payout(uuid, text) to authenticated;
