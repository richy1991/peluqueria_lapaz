-- Endurecimiento contra abuso de operaciones públicas/autenticadas.
create table if not exists public.claim_attempts (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists claim_attempts_actor_time_idx
  on public.claim_attempts(actor_id, attempted_at desc);

alter table public.claim_attempts enable row level security;
revoke all on table public.claim_attempts from anon, authenticated;
revoke all on sequence public.claim_attempts_id_seq from anon, authenticated;

create or replace function public.consume_claim_attempt()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  recent_attempts integer;
begin
  if actor is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':claim', 0));
  delete from public.claim_attempts where actor_id = actor and attempted_at < now() - interval '1 day';
  insert into public.claim_attempts(actor_id) values(actor);
  select count(*) into recent_attempts from public.claim_attempts
    where actor_id = actor and attempted_at > now() - interval '10 minutes';
  return recent_attempts <= 8;
end;
$$;

create or replace function public.claim_guest_sale(provided_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale_id uuid;
  normalized_code text := upper(trim(coalesce(provided_code, '')));
begin
  if auth.uid() is null then return null; end if;
  if length(normalized_code) <> 10 or not public.consume_claim_attempt() then return null; end if;
  select id into sale_id from public.sales
    where upper(claim_code) = normalized_code and client_id is null and status = 'paid'
    for update;
  if sale_id is null then return null; end if;
  update public.sales set client_id = auth.uid(), claim_code = null, updated_at = now() where id = sale_id;
  perform public.process_sale_loyalty(sale_id);
  return sale_id;
end;
$$;

create or replace function public.guard_client_mutation_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null or public.is_admin() or public.is_cashier() then return new; end if;
  if tg_table_name = 'appointments' then
    select count(*) into recent_count from public.appointments
      where client_id = auth.uid() and created_at > now() - interval '1 hour';
    if recent_count >= 6 then raise exception 'Límite temporal de reservas alcanzado. Intenta más tarde.' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'product_reservations' then
    select count(*) into recent_count from public.product_reservations
      where client_id = auth.uid() and created_at > now() - interval '1 hour';
    if recent_count >= 10 then raise exception 'Límite temporal de apartados alcanzado. Intenta más tarde.' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'reward_redemptions' then
    select count(*) into recent_count from public.reward_redemptions
      where user_id = auth.uid() and created_at > now() - interval '1 hour';
    if recent_count >= 8 then raise exception 'Límite temporal de canjes alcanzado. Intenta más tarde.' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'messages' then
    select count(*) into recent_count from public.messages
      where sender_id = auth.uid() and created_at > now() - interval '1 minute';
    if recent_count >= 10 then raise exception 'Espera un momento antes de enviar más mensajes.' using errcode = 'P0001'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_appointment_rate on public.appointments;
create trigger guard_appointment_rate before insert on public.appointments
  for each row execute procedure public.guard_client_mutation_rate();
drop trigger if exists guard_product_reservation_rate on public.product_reservations;
create trigger guard_product_reservation_rate before insert on public.product_reservations
  for each row execute procedure public.guard_client_mutation_rate();
drop trigger if exists guard_reward_redemption_rate on public.reward_redemptions;
create trigger guard_reward_redemption_rate before insert on public.reward_redemptions
  for each row execute procedure public.guard_client_mutation_rate();
drop trigger if exists guard_message_rate on public.messages;
create trigger guard_message_rate before insert on public.messages
  for each row execute procedure public.guard_client_mutation_rate();

-- La aplicación no utiliza escritura anónima de analítica: se cierra para evitar spam de base de datos.
drop policy if exists "Anonymous records analytics" on public.web_events;
revoke insert on public.web_events from anon, authenticated;

-- pgcrypto vive en extensions; la función de caja mantiene un search_path limitado y explícito.
alter function public.register_counter_sale(uuid,uuid,text,text,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text)
  set search_path = pg_catalog, extensions;

revoke all on function public.consume_claim_attempt() from public;
revoke all on function public.guard_client_mutation_rate() from public;
revoke all on function public.claim_guest_sale(text) from public;
grant execute on function public.claim_guest_sale(text) to authenticated;
