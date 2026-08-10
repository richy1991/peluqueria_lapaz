-- Indicadores operativos y comerciales para el panel administrador.
create or replace function public.admin_business_analytics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', timezone('America/La_Paz', now()))::date;
  previous_start date := (date_trunc('month', timezone('America/La_Paz', now())) - interval '1 month')::date;
  next_start date := (date_trunc('month', timezone('America/La_Paz', now())) + interval '1 month')::date;
  year_start date := (date_trunc('month', timezone('America/La_Paz', now())) - interval '11 months')::date;
begin
  if not public.is_admin() then
    raise exception 'Acceso administrativo requerido';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'summary', jsonb_build_object(
      'registered_users', (
        select count(*) from public.profiles p
        where not exists (
          select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin'
        )
      ),
      'new_users_current', (
        select count(*) from public.profiles p
        where timezone('America/La_Paz',p.created_at)>=month_start
          and timezone('America/La_Paz',p.created_at)<next_start
          and not exists (select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')
      ),
      'new_users_previous', (
        select count(*) from public.profiles p
        where timezone('America/La_Paz',p.created_at)>=previous_start
          and timezone('America/La_Paz',p.created_at)<month_start
          and not exists (select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')
      ),
      'completed_current', (
        select count(*) from public.appointments a
        where a.status='completed' and timezone('America/La_Paz',a.starts_at)>=month_start
          and timezone('America/La_Paz',a.starts_at)<next_start
      ),
      'completed_previous', (
        select count(*) from public.appointments a
        where a.status='completed' and timezone('America/La_Paz',a.starts_at)>=previous_start
          and timezone('America/La_Paz',a.starts_at)<month_start
      ),
      'service_value_current', (
        select coalesce(round(sum(a.price_snapshot),2),0) from public.appointments a
        where a.status='completed' and timezone('America/La_Paz',a.starts_at)>=month_start
          and timezone('America/La_Paz',a.starts_at)<next_start
      ),
      'service_value_previous', (
        select coalesce(round(sum(a.price_snapshot),2),0) from public.appointments a
        where a.status='completed' and timezone('America/La_Paz',a.starts_at)>=previous_start
          and timezone('America/La_Paz',a.starts_at)<month_start
      ),
      'average_ticket_current', (
        select coalesce(round(avg(a.price_snapshot),2),0) from public.appointments a
        where a.status='completed' and timezone('America/La_Paz',a.starts_at)>=month_start
          and timezone('America/La_Paz',a.starts_at)<next_start
      ),
      'product_units_current', (
        select coalesce(sum(pr.quantity),0) from public.product_reservations pr
        where pr.status='collected' and timezone('America/La_Paz',pr.updated_at)>=month_start
          and timezone('America/La_Paz',pr.updated_at)<next_start
      ),
      'product_units_previous', (
        select coalesce(sum(pr.quantity),0) from public.product_reservations pr
        where pr.status='collected' and timezone('America/La_Paz',pr.updated_at)>=previous_start
          and timezone('America/La_Paz',pr.updated_at)<month_start
      ),
      'cancellation_rate', (
        select coalesce(round(100.0*count(*) filter (where a.status='canceled')/nullif(count(*),0),1),0)
        from public.appointments a
        where timezone('America/La_Paz',a.starts_at)>=month_start
          and timezone('America/La_Paz',a.starts_at)<next_start
      ),
      'no_show_rate', (
        select coalesce(round(100.0*count(*) filter (where a.status='no_show')/nullif(count(*),0),1),0)
        from public.appointments a
        where timezone('America/La_Paz',a.starts_at)>=month_start
          and timezone('America/La_Paz',a.starts_at)<next_start
      ),
      'repeat_clients', (
        select count(*) from (
          select a.client_id from public.appointments a
          where a.status='completed'
          group by a.client_id having count(*)>=2
        ) repeated
      )
    ),
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month',to_char(series.month_start,'YYYY-MM'),
        'completed',series.completed,
        'service_value',series.service_value,
        'new_users',series.new_users,
        'product_units',series.product_units
      ) order by series.month_start),'[]'::jsonb)
      from (
        select m.month_start,
          (select count(*) from public.appointments a where a.status='completed' and timezone('America/La_Paz',a.starts_at)>=m.month_start and timezone('America/La_Paz',a.starts_at)<m.month_start+interval '1 month') completed,
          (select coalesce(round(sum(a.price_snapshot),2),0) from public.appointments a where a.status='completed' and timezone('America/La_Paz',a.starts_at)>=m.month_start and timezone('America/La_Paz',a.starts_at)<m.month_start+interval '1 month') service_value,
          (select count(*) from public.profiles p where timezone('America/La_Paz',p.created_at)>=m.month_start and timezone('America/La_Paz',p.created_at)<m.month_start+interval '1 month' and not exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='superadmin')) new_users,
          (select coalesce(sum(pr.quantity),0) from public.product_reservations pr where pr.status='collected' and timezone('America/La_Paz',pr.updated_at)>=m.month_start and timezone('America/La_Paz',pr.updated_at)<m.month_start+interval '1 month') product_units
        from generate_series(year_start::timestamp,month_start::timestamp,interval '1 month') as m(month_start)
      ) series
    ),
    'top_services', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.completed desc),'[]'::jsonb)
      from (
        select a.service_name_snapshot name,count(*) completed,round(sum(a.price_snapshot),2) service_value
        from public.appointments a
        where a.status='completed' and timezone('America/La_Paz',a.starts_at)>=year_start
        group by a.service_name_snapshot order by completed desc limit 8
      ) row_data
    ),
    'top_products', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.units desc),'[]'::jsonb)
      from (
        select p.name,sum(pr.quantity) units,round(sum(pr.quantity*pr.price_snapshot),2) product_value
        from public.product_reservations pr join public.products p on p.id=pr.product_id
        where pr.status='collected' and timezone('America/La_Paz',pr.updated_at)>=year_start
        group by p.id,p.name order by units desc limit 8
      ) row_data
    ),
    'top_barbers', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.completed desc),'[]'::jsonb)
      from (
        select b.id,b.display_name name,count(*) completed,round(sum(a.price_snapshot),2) service_value
        from public.appointments a join public.barber_profiles b on b.id=a.barber_id
        where a.status='completed' and timezone('America/La_Paz',a.starts_at)>=year_start
        group by b.id,b.display_name order by completed desc limit 8
      ) row_data
    ),
    'busy_dates', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.total desc,row_data.date desc),'[]'::jsonb)
      from (
        select timezone('America/La_Paz',a.starts_at)::date date,count(*) total
        from public.appointments a
        where a.status not in ('canceled','needs_reschedule') and timezone('America/La_Paz',a.starts_at)>=year_start
        group by 1 order by total desc,date desc limit 10
      ) row_data
    ),
    'weekdays', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.day_number),'[]'::jsonb)
      from (
        select extract(isodow from timezone('America/La_Paz',a.starts_at))::int day_number,
          case extract(isodow from timezone('America/La_Paz',a.starts_at))::int
            when 1 then 'Lunes' when 2 then 'Martes' when 3 then 'Miércoles'
            when 4 then 'Jueves' when 5 then 'Viernes' when 6 then 'Sábado' else 'Domingo' end label,
          count(*) total
        from public.appointments a
        where a.status not in ('canceled','needs_reschedule') and timezone('America/La_Paz',a.starts_at)>=year_start
        group by 1,2
      ) row_data
    ),
    'hours', (
      select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.total desc),'[]'::jsonb)
      from (
        select extract(hour from timezone('America/La_Paz',a.starts_at))::int hour_number,
          lpad(extract(hour from timezone('America/La_Paz',a.starts_at))::int::text,2,'0')||':00' label,
          count(*) total
        from public.appointments a
        where a.status not in ('canceled','needs_reschedule') and timezone('America/La_Paz',a.starts_at)>=year_start
        group by 1,2 order by total desc limit 8
      ) row_data
    )
  );
end;
$$;

revoke all on function public.admin_business_analytics() from public;
grant execute on function public.admin_business_analytics() to authenticated;
