-- pgcrypto vive en el esquema extensions. Las tablas usadas por el RPC están calificadas con public.
alter function public.register_counter_sale_v2(uuid,uuid,text,text,uuid,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text)
set search_path='extensions';
