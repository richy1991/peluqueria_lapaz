-- Beneficio estándar: 100 puntos descuentan Bs 25 del servicio en caja.
do $$
begin
  if not exists (select 1 from public.rewards where name='Servicio por 100 puntos') then
    insert into public.rewards(name,description,points_cost,reward_type,reward_value,max_discount,active)
    values('Servicio por 100 puntos','Canjea 100 puntos por Bs 25 de descuento en un servicio.',100,'fixed_discount',25,25,true);
  else
    update public.rewards
    set description='Canjea 100 puntos por Bs 25 de descuento en un servicio.',
        points_cost=100,reward_type='fixed_discount',reward_value=25,max_discount=25,active=true
    where name='Servicio por 100 puntos';
  end if;
end;
$$;

create or replace function public.annotate_discounted_cash_sale()
returns trigger language plpgsql security definer set search_path=''
as $$
declare discount numeric;
begin
  select discount_total into discount from public.sales where id=new.sale_id;
  if coalesce(discount,0)>0 then
    update public.cash_movements
    set reason=reason||' · Descuento aplicado: Bs '||to_char(discount,'FM999999990.00')
    where sale_id=new.sale_id and kind='sale';
  end if;
  return new;
end;
$$;

drop trigger if exists annotate_discounted_cash_sale on public.receipts;
create trigger annotate_discounted_cash_sale
after insert on public.receipts
for each row execute function public.annotate_discounted_cash_sale();
