create or replace function public.cancel_my_product_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := auth.uid();
begin
  if v_client_id is null then
    raise exception 'Debes iniciar sesión para cancelar un apartado.' using errcode = 'P0001';
  end if;

  update public.product_reservations
  set status = 'canceled', updated_at = now()
  where id = p_reservation_id
    and client_id = v_client_id
    and status = 'reserved'
    and expires_at > now();

  if not found then
    raise exception 'El apartado ya no está activo o no te pertenece.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.cancel_my_product_reservation(uuid) from public;
grant execute on function public.cancel_my_product_reservation(uuid) to authenticated;
