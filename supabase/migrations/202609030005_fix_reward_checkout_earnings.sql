-- Califica las columnas de sale_items que coinciden con parámetros del cobro.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.register_counter_service_sale_v5(uuid,uuid,text,text,jsonb,jsonb,uuid,integer,uuid,text,text,text,uuid,uuid,text,text,text)'::regprocedure)
  into definition;
  definition:=replace(definition,
    E'select coalesce(barber_id,recommended_by_barber_id),id,case when item_type=''product'' then ''product_incentive'' else ''service_commission'' end,quantity*unit_price_snapshot,commission_percent_snapshot,commission_amount\n  from public.sale_items where sale_id=v_sale_id and commission_amount>0;',
    E'select coalesce(si.barber_id,si.recommended_by_barber_id),si.id,case when si.item_type=''product'' then ''product_incentive'' else ''service_commission'' end,si.quantity*si.unit_price_snapshot,si.commission_percent_snapshot,si.commission_amount\n  from public.sale_items si where si.sale_id=v_sale_id and si.commission_amount>0;');
  execute definition;
end $$;
