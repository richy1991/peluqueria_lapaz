-- Las promociones son gestionadas manualmente por el administrador.
-- Se elimina cualquier cálculo, bonificación o historial automático de rachas.

create or replace function public.process_sale_loyalty(target_sale uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
  sale public.sales%rowtype;
  settings public.loyalty_settings%rowtype;
  primary_barber uuid;
  referrer uuid;
  paid_count int;
  item_group record;
begin
  select * into sale from public.sales where id=target_sale and status='paid' for update;
  if not found or sale.client_id is null or sale.loyalty_processed_at is not null then return; end if;
  select * into settings from public.loyalty_settings where id=true;
  select si.barber_id into primary_barber from public.sale_items si
  where si.sale_id=sale.id and si.item_type='service' and si.earns_loyalty and si.barber_id is not null
  order by si.created_at limit 1;

  if primary_barber is not null then
    perform public.post_customer_barber_points(sale.client_id,primary_barber,settings.welcome_points,'earn','Bienvenida con tu peluquero','welcome:'||sale.client_id||':'||primary_barber,'sale',sale.id);
  end if;
  for item_group in
    select barber_id,count(*)::int as item_count from public.sale_items
    where sale_id=sale.id and item_type='service' and earns_loyalty and barber_id is not null group by barber_id
  loop
    perform public.post_customer_barber_points(sale.client_id,item_group.barber_id,settings.service_points*item_group.item_count,'earn','Servicio completado con este peluquero','service-sale:'||sale.id||':'||item_group.barber_id,'sale',sale.id);
  end loop;

  if primary_barber is not null and nullif(trim(sale.referral_code),'') is not null then
    select id into referrer from public.profiles where lower(referral_code)=lower(trim(sale.referral_code));
    if referrer is not null and referrer<>sale.client_id then
      select count(distinct s.id) into paid_count from public.sales s join public.sale_items si on si.sale_id=s.id
      where s.client_id=sale.client_id and s.status='paid' and si.item_type='service' and si.earns_loyalty;
      if paid_count=1 then
        insert into public.referrals(referrer_id,referred_id,first_sale_id,status,qualified_at)
        values(referrer,sale.client_id,sale.id,'rewarded',now()) on conflict(referred_id) do nothing;
        if found then
          perform public.post_customer_barber_points(referrer,primary_barber,settings.referral_referrer_points,'earn','Cliente referido','referrer:'||sale.client_id||':'||primary_barber,'referral',sale.id);
          perform public.post_customer_barber_points(sale.client_id,primary_barber,settings.referral_referred_points,'earn','Bienvenida por referido','referred:'||sale.client_id||':'||primary_barber,'referral',sale.id);
        end if;
      end if;
    end if;
  end if;

  update public.sales set loyalty_processed_at=now(),updated_at=now() where id=sale.id;
end;
$$;

drop table if exists public.customer_barber_streaks;

alter table public.loyalty_settings
  drop column if exists streak_visits,
  drop column if exists streak_days,
  drop column if exists streak_bonus_points;
