do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='barber_earnings') then
      alter publication supabase_realtime add table public.barber_earnings;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='payouts') then
      alter publication supabase_realtime add table public.payouts;
    end if;
  end if;
end;
$$;

create or replace function public.barber_get_balance_summary(
  target_barber uuid,
  month_start date,
  work_date date
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  pending_total numeric:=0;
  prepared_total numeric:=0;
  paid_month_total numeric:=0;
  month_start_at timestamptz:=month_start::timestamp at time zone 'America/La_Paz';
  month_end_at timestamptz:=((month_start + interval '1 month')::date::timestamp at time zone 'America/La_Paz');
begin
  if not public.is_admin() and not exists(
    select 1 from public.barber_profiles b where b.id=target_barber and b.user_id=auth.uid() and b.active
  ) then
    raise exception 'Acceso al balance no permitido';
  end if;
  if month_start>work_date or (month_start + interval '1 month')::date<=work_date then
    raise exception 'El rango mensual no es valido';
  end if;

  select coalesce(sum(e.amount),0) into pending_total
  from public.barber_earnings e
  where e.barber_id=target_barber and e.status='pending';

  select coalesce(sum(p.total_amount),0) into prepared_total
  from public.payouts p
  where p.barber_id=target_barber and p.status='approved';

  select coalesce(sum(p.total_amount),0) into paid_month_total
  from public.payouts p
  where p.barber_id=target_barber and p.status='paid'
    and p.paid_at>=month_start_at and p.paid_at<month_end_at;

  return jsonb_build_object('pending_total',pending_total+prepared_total,'paid_month_total',paid_month_total);
end;
$$;

revoke all on function public.barber_get_balance_summary(uuid,date,date) from public;
grant execute on function public.barber_get_balance_summary(uuid,date,date) to authenticated;

create or replace function public.cashier_get_barber_settlement_detail_v2(target_barber uuid,work_date date default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  business_day date:=coalesce(work_date,(now() at time zone 'America/La_Paz')::date);
  day_end timestamptz:=((business_day+1)::timestamp at time zone 'America/La_Paz');
  detail jsonb;
  new_services jsonb:='[]'::jsonb;
  new_commission_total numeric:=0;
begin
  if not public.is_cashier() then raise exception 'Acceso de caja requerido'; end if;

  detail:=public.cashier_get_barber_settlement_detail(target_barber,business_day);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,
    'name',coalesce(si.name_snapshot,'Servicio'),
    'base_amount',e.base_amount,
    'rate_percent',e.rate_percent,
    'amount',e.amount,
    'created_at',e.created_at
  ) order by e.created_at),'[]'::jsonb),coalesce(sum(e.amount),0)
  into new_services,new_commission_total
  from public.barber_earnings e
  left join public.sale_items si on si.id=e.sale_item_id
  where e.barber_id=target_barber and e.kind='service_commission'
    and e.status='pending' and e.created_at<day_end;

  return detail || jsonb_build_object(
    'new_services',new_services,
    'new_commission_total',new_commission_total
  );
end;
$$;

revoke all on function public.cashier_get_barber_settlement_detail_v2(uuid,date) from public;
grant execute on function public.cashier_get_barber_settlement_detail_v2(uuid,date) to authenticated;
