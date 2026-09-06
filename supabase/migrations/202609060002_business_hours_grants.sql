-- Supabase ya no expone automáticamente tablas nuevas en la Data API.
grant select on table public.business_hours to anon;
grant select, insert, update, delete on table public.business_hours to authenticated;
grant all on table public.business_hours to service_role;
