-- Alta de clientes desde caja: referido opcional y vinculación segura del comprobante.

create or replace function public.validate_optional_sale_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  referrer_id uuid;
begin
  new.referral_code := nullif(upper(trim(coalesce(new.referral_code, ''))), '');
  if new.referral_code is null then return new; end if;

  select id into referrer_id
  from public.profiles
  where lower(referral_code) = lower(new.referral_code)
    and status = 'active';

  if referrer_id is null then
    raise exception 'El código del cliente que recomienda no es válido';
  end if;
  if new.client_id is not null and referrer_id = new.client_id then
    raise exception 'Un cliente no puede referirse a sí mismo';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_validate_optional_referral on public.sales;
create trigger sales_validate_optional_referral
  before insert or update of referral_code on public.sales
  for each row execute function public.validate_optional_sale_referral();

create or replace function public.claim_guest_sale(provided_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_sale public.sales%rowtype;
  normalized_code text := upper(trim(coalesce(provided_code, '')));
  normalized_phone text;
begin
  if auth.uid() is null then return null; end if;
  if length(normalized_code) <> 10 or not public.consume_claim_attempt() then return null; end if;

  select * into claimed_sale
  from public.sales
  where upper(claim_code) = normalized_code
    and client_id is null
    and status = 'paid'
  for update;

  if claimed_sale.id is null then return null; end if;

  update public.sales
  set client_id = auth.uid(), claim_code = null, updated_at = now()
  where id = claimed_sale.id;

  normalized_phone := regexp_replace(coalesce(claimed_sale.guest_phone, ''), '[^0-9]', '', 'g');
  update public.profiles
  set full_name = coalesce(nullif(trim(claimed_sale.guest_name), ''), full_name),
      phone = coalesce(nullif(trim(claimed_sale.guest_phone), ''), phone),
      phone_normalized = case
        when length(normalized_phone) between 7 and 15 then normalized_phone
        else phone_normalized
      end,
      updated_at = now()
  where id = auth.uid();

  perform public.process_sale_loyalty(claimed_sale.id);
  insert into public.audit_logs(actor_id, action, entity, entity_id, data)
  values(auth.uid(), 'guest_sale_claimed', 'sales', claimed_sale.id::text,
    jsonb_build_object('captured_name', claimed_sale.guest_name, 'captured_phone', claimed_sale.guest_phone));
  return claimed_sale.id;
end;
$$;

revoke all on function public.validate_optional_sale_referral() from public;
revoke all on function public.claim_guest_sale(text) from public;
grant execute on function public.claim_guest_sale(text) to authenticated;

