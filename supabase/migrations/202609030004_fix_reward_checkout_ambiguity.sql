-- Recompila la función instalada por 202609030003 calificando las columnas que
-- comparten nombre con variables PL/pgSQL. En instalaciones nuevas la función
-- ya llega corregida y esta migración permanece idempotente.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.register_counter_service_sale_v5(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,text,text,text,uuid,uuid,text,text,text)'::regprocedure)
  into definition;
  definition:=replace(definition,
    'update public.sale_items set discount_amount=round(benefit_discount*(quantity*unit_price_snapshot)/eligible_amount,2)',
    'update public.sale_items si set discount_amount=round(benefit_discount*(si.quantity*si.unit_price_snapshot)/eligible_amount,2)');
  definition:=replace(definition,
    E'select coalesce(sum(quantity*unit_price_snapshot),0) into eligible_amount from public.sale_items\n    where sale_id=v_sale_id and item_type=''service'' and barber_id=reward_barber and (reward_service is null or service_id=reward_service);',
    E'select coalesce(sum(si.quantity*si.unit_price_snapshot),0) into eligible_amount from public.sale_items si\n    where si.sale_id=v_sale_id and si.item_type=''service'' and si.barber_id=reward_barber and (reward_service is null or si.service_id=reward_service);');
  definition:=replace(definition,
    'where sale_id=v_sale_id and item_type=''service'' and barber_id=reward_barber and (reward_service is null or service_id=reward_service);',
    'where si.sale_id=v_sale_id and si.item_type=''service'' and si.barber_id=reward_barber and (reward_service is null or si.service_id=reward_service);');
  definition:=replace(definition,
    'select coalesce(sum(discount_amount),0) into allocated from public.sale_items where sale_id=v_sale_id;',
    'select coalesce(sum(si.discount_amount),0) into allocated from public.sale_items si where si.sale_id=v_sale_id;');
  definition:=replace(definition,
    'update public.sale_items set discount_amount=discount_amount+residual where id=target_line;',
    'update public.sale_items si set discount_amount=si.discount_amount+residual where si.id=target_line;');
  definition:=replace(definition,
    'update public.sale_items set discount_amount=round(benefit_discount*(quantity*unit_price_snapshot)/list_amount,2) where sale_id=v_sale_id;',
    'update public.sale_items si set discount_amount=round(benefit_discount*(si.quantity*si.unit_price_snapshot)/list_amount,2) where si.sale_id=v_sale_id;');
  definition:=replace(definition,
    'update public.sale_items set earns_loyalty=false where sale_id=v_sale_id and item_type=''service'' and discount_amount>=quantity*unit_price_snapshot;',
    'update public.sale_items si set earns_loyalty=false where si.sale_id=v_sale_id and si.item_type=''service'' and si.discount_amount>=si.quantity*si.unit_price_snapshot;');
  execute definition;
end $$;
