-- Las estadisticas economicas se calculan desde ventas pagadas y sus lineas,
-- incluyendo cobros directos sin reserva y excluyendo ventas revertidas.

create or replace function public.admin_business_analytics()
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
  month_start date:=date_trunc('month',timezone('America/La_Paz',now()))::date;
  previous_start date:=(date_trunc('month',timezone('America/La_Paz',now()))-interval '1 month')::date;
  next_start date:=(date_trunc('month',timezone('America/La_Paz',now()))+interval '1 month')::date;
  year_start date:=(date_trunc('month',timezone('America/La_Paz',now()))-interval '11 months')::date;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  return jsonb_build_object(
    'generated_at',now(),
    'summary',jsonb_build_object(
      'registered_users',(select count(*) from public.profiles p where not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')),
      'new_users_current',(select count(*) from public.profiles p where timezone('America/La_Paz',p.created_at)>=month_start and timezone('America/La_Paz',p.created_at)<next_start and not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')),
      'new_users_previous',(select count(*) from public.profiles p where timezone('America/La_Paz',p.created_at)>=previous_start and timezone('America/La_Paz',p.created_at)<month_start and not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')),
      'completed_current',(select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=month_start and timezone('America/La_Paz',s.paid_at)<next_start),
      'completed_previous',(select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=previous_start and timezone('America/La_Paz',s.paid_at)<month_start),
      'service_value_current',(select coalesce(round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=month_start and timezone('America/La_Paz',s.paid_at)<next_start),
      'service_value_previous',(select coalesce(round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=previous_start and timezone('America/La_Paz',s.paid_at)<month_start),
      'average_ticket_current',(select coalesce(round(avg(s.paid_total),2),0) from public.sales s where s.status='paid' and timezone('America/La_Paz',s.paid_at)>=month_start and timezone('America/La_Paz',s.paid_at)<next_start),
      'product_units_current',(select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='product' and timezone('America/La_Paz',s.paid_at)>=month_start and timezone('America/La_Paz',s.paid_at)<next_start),
      'product_units_previous',(select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='product' and timezone('America/La_Paz',s.paid_at)>=previous_start and timezone('America/La_Paz',s.paid_at)<month_start),
      'cancellation_rate',(select coalesce(round(100.0*count(*) filter(where a.status='canceled')/nullif(count(*),0),1),0) from public.appointments a where timezone('America/La_Paz',a.starts_at)>=month_start and timezone('America/La_Paz',a.starts_at)<next_start),
      'no_show_rate',(select coalesce(round(100.0*count(*) filter(where a.status='no_show')/nullif(count(*),0),1),0) from public.appointments a where timezone('America/La_Paz',a.starts_at)>=month_start and timezone('America/La_Paz',a.starts_at)<next_start),
      'repeat_clients',(select count(*) from(select s.client_id from public.sales s where s.status='paid' and s.client_id is not null and exists(select 1 from public.sale_items si where si.sale_id=s.id and si.item_type='service') group by s.client_id having count(*)>=2) repeated)
    ),
    'monthly',(select coalesce(jsonb_agg(jsonb_build_object('month',to_char(series.month_start,'YYYY-MM'),'completed',series.completed,'service_value',series.service_value,'new_users',series.new_users,'product_units',series.product_units) order by series.month_start),'[]'::jsonb) from(
      select m.month_start,
        (select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=m.month_start and timezone('America/La_Paz',s.paid_at)<m.month_start+interval '1 month') completed,
        (select coalesce(round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=m.month_start and timezone('America/La_Paz',s.paid_at)<m.month_start+interval '1 month') service_value,
        (select count(*) from public.profiles p where timezone('America/La_Paz',p.created_at)>=m.month_start and timezone('America/La_Paz',p.created_at)<m.month_start+interval '1 month' and not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')) new_users,
        (select coalesce(sum(si.quantity),0) from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='product' and timezone('America/La_Paz',s.paid_at)>=m.month_start and timezone('America/La_Paz',s.paid_at)<m.month_start+interval '1 month') product_units
      from generate_series(year_start::timestamp,month_start::timestamp,interval '1 month') m(month_start)
    ) series),
    'top_services',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.completed desc),'[]'::jsonb) from(
      select si.name_snapshot name,sum(si.quantity) completed,round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2) service_value
      from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=year_start group by si.name_snapshot order by completed desc limit 8
    ) row_data),
    'top_products',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.units desc),'[]'::jsonb) from(
      select si.name_snapshot name,sum(si.quantity) units,round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2) product_value
      from public.sales s join public.sale_items si on si.sale_id=s.id where s.status='paid' and si.item_type='product' and timezone('America/La_Paz',s.paid_at)>=year_start group by si.name_snapshot order by units desc limit 8
    ) row_data),
    'top_barbers',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.completed desc),'[]'::jsonb) from(
      select b.id,b.display_name name,sum(si.quantity) completed,round(sum(greatest(si.quantity*si.unit_price_snapshot-si.discount_amount,0)),2) service_value
      from public.sales s join public.sale_items si on si.sale_id=s.id join public.barber_profiles b on b.id=si.barber_id where s.status='paid' and si.item_type='service' and timezone('America/La_Paz',s.paid_at)>=year_start group by b.id,b.display_name order by completed desc limit 8
    ) row_data),
    'busy_dates',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.total desc,row_data.date desc),'[]'::jsonb) from(
      select timezone('America/La_Paz',a.starts_at)::date date,count(*) total from public.appointments a where a.status not in ('canceled','needs_reschedule') and timezone('America/La_Paz',a.starts_at)>=year_start group by 1 order by total desc,date desc limit 10
    ) row_data),
    'weekdays',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.day_number),'[]'::jsonb) from(
      select extract(isodow from timezone('America/La_Paz',a.starts_at))::int day_number,case extract(isodow from timezone('America/La_Paz',a.starts_at))::int when 1 then 'Lunes' when 2 then 'Martes' when 3 then 'Miercoles' when 4 then 'Jueves' when 5 then 'Viernes' when 6 then 'Sabado' else 'Domingo' end label,count(*) total
      from public.appointments a where a.status not in ('canceled','needs_reschedule') and timezone('America/La_Paz',a.starts_at)>=year_start group by 1,2
    ) row_data),
    'hours',(select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.total desc),'[]'::jsonb) from(
      select extract(hour from timezone('America/La_Paz',a.starts_at))::int hour_number,lpad(extract(hour from timezone('America/La_Paz',a.starts_at))::int::text,2,'0')||':00' label,count(*) total
      from public.appointments a where a.status not in ('canceled','needs_reschedule') and timezone('America/La_Paz',a.starts_at)>=year_start group by 1,2 order by total desc limit 8
    ) row_data)
  );
end; $$;

create or replace function public.admin_marketing_analytics()
returns jsonb language plpgsql security definer set search_path=''
as $$ declare month_start timestamp:=date_trunc('month',timezone('America/La_Paz',now()));
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  return jsonb_build_object(
    'visitors_30d',(select count(distinct session_id) from public.web_events where created_at>=now()-interval '30 days'),
    'pageviews_30d',(select count(*) from public.web_events where event_name='page_view' and created_at>=now()-interval '30 days'),
    'reservation_clicks_30d',(select count(*) from public.web_events where event_name='click' and created_at>=now()-interval '30 days' and (lower(coalesce(data->>'label','')) like '%reserv%' or coalesce(data->>'href','') like '%/reservar%')),
    'whatsapp_clicks_30d',(select count(*) from public.web_events where event_name='click' and created_at>=now()-interval '30 days' and coalesce(data->>'href','') like '%wa.me%'),
    'paid_sales_current',(select count(*) from public.sales where status='paid' and timezone('America/La_Paz',paid_at)>=month_start),
    'revenue_current',(select coalesce(round(sum(paid_total),2),0) from public.sales where status='paid' and timezone('America/La_Paz',paid_at)>=month_start),
    'discounts_current',(select coalesce(round(sum(discount_total),2),0) from public.sales where status='paid' and timezone('America/La_Paz',paid_at)>=month_start),
    'commissions_current',(select coalesce(round(sum(barber_commission_total),2),0) from public.sales where status='paid' and timezone('America/La_Paz',paid_at)>=month_start),
    'business_share_current',(select coalesce(round(sum(business_share),2),0) from public.sales where status='paid' and timezone('America/La_Paz',paid_at)>=month_start),
    'refunds_current',(select count(*) from public.sales where status='refunded' and timezone('America/La_Paz',reversed_at)>=month_start),
    'refund_value_current',(select coalesce(round(sum(paid_total),2),0) from public.sales where status='refunded' and timezone('America/La_Paz',reversed_at)>=month_start),
    'top_paths',(select coalesce(jsonb_agg(to_jsonb(rows) order by rows.total desc),'[]'::jsonb) from(select path,count(*) total from public.web_events where event_name='page_view' and created_at>=now()-interval '30 days' group by path order by total desc limit 10) rows),
    'top_sources',(select coalesce(jsonb_agg(to_jsonb(rows) order by rows.total desc),'[]'::jsonb) from(select coalesce(nullif(campaign->>'utm_source',''),'Directo/sin UTM') source,count(distinct session_id) total from public.web_events where event_name='page_view' and created_at>=now()-interval '30 days' group by 1 order by total desc limit 10) rows)
  );
end; $$;

revoke all on function public.admin_business_analytics() from public;
revoke all on function public.admin_marketing_analytics() from public;
grant execute on function public.admin_business_analytics() to authenticated;
grant execute on function public.admin_marketing_analytics() to authenticated;
