create or replace function public.admin_marketing_analytics()
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  return jsonb_build_object(
    'visitors_30d',(select count(distinct session_id) from public.web_events where created_at>=now()-interval '30 days'),
    'pageviews_30d',(select count(*) from public.web_events where event_name='page_view' and created_at>=now()-interval '30 days'),
    'reservation_clicks_30d',(select count(*) from public.web_events where event_name='click' and created_at>=now()-interval '30 days' and (lower(coalesce(data->>'label','')) like '%reserv%' or coalesce(data->>'href','') like '%/reservar%')),
    'whatsapp_clicks_30d',(select count(*) from public.web_events where event_name='click' and created_at>=now()-interval '30 days' and coalesce(data->>'href','') like '%wa.me%'),
    'paid_sales_current',(select count(*) from public.sales where status='paid' and timezone('America/La_Paz',paid_at)>=date_trunc('month',timezone('America/La_Paz',now()))),
    'revenue_current',(select coalesce(round(sum(paid_total),2),0) from public.sales where status='paid' and timezone('America/La_Paz',paid_at)>=date_trunc('month',timezone('America/La_Paz',now()))),
    'commissions_current',(select coalesce(round(sum(barber_commission_total),2),0) from public.sales where status='paid' and timezone('America/La_Paz',paid_at)>=date_trunc('month',timezone('America/La_Paz',now()))),
    'business_share_current',(select coalesce(round(sum(business_share),2),0) from public.sales where status='paid' and timezone('America/La_Paz',paid_at)>=date_trunc('month',timezone('America/La_Paz',now()))),
    'top_paths',(select coalesce(jsonb_agg(to_jsonb(rows) order by rows.total desc),'[]'::jsonb) from(select path,count(*) total from public.web_events where event_name='page_view' and created_at>=now()-interval '30 days' group by path order by total desc limit 10) rows),
    'top_sources',(select coalesce(jsonb_agg(to_jsonb(rows) order by rows.total desc),'[]'::jsonb) from(select coalesce(nullif(campaign->>'utm_source',''),'Directo/sin UTM') source,count(distinct session_id) total from public.web_events where event_name='page_view' and created_at>=now()-interval '30 days' group by 1 order by total desc limit 10) rows)
  );
end; $$;
revoke all on function public.admin_marketing_analytics() from public;
grant execute on function public.admin_marketing_analytics() to authenticated;
