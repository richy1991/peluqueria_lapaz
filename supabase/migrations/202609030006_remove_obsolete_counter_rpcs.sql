-- Retira RPC anteriores al modelo de múltiples atenciones. La compatibilidad
-- móvil se mantiene únicamente mediante register_counter_service_sale_v4.
drop function if exists public.register_counter_sale_v2(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text);
drop function if exists public.register_counter_sale_v3(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text);
