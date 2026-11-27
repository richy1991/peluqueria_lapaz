-- El borrado de un peluquero debe retirar también su identidad de acceso
-- cuando solo conserva los roles predeterminados de cliente y peluquero.
-- Las cuentas con otros roles del personal mantienen su perfil personal.

create or replace function public.admin_delete_record(entity_type text, target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_barber_user_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acceso administrativo requerido' using errcode = '42501';
  end if;

  if entity_type = 'clients' then
    perform public.admin_delete_client_completely(target_id);
    return;
  end if;

  if entity_type = 'barbers' then
    select barber.user_id into target_barber_user_id
    from public.barber_profiles as barber
    where barber.id = target_id
    for update;

    -- Primero conserva los datos comerciales y desvincula la ficha del peluquero.
    perform public.admin_delete_record_non_client(entity_type, target_id);

    -- Todo usuario recibe el rol cliente al crear la cuenta. Ese rol por sí solo
    -- no debe dejar viva la identidad Google/correo después de borrar al peluquero.
    -- Otros roles de personal y otras fichas vinculadas sí conservan la cuenta.
    if target_barber_user_id is not null
      and exists (select 1 from public.profiles where id = target_barber_user_id)
      and not exists (
        select 1 from public.user_roles
        where user_id = target_barber_user_id
          and role not in ('client', 'barber')
      )
      and not exists (
        select 1 from public.cashier_profiles
        where user_id = target_barber_user_id
      )
      and not exists (
        select 1 from public.barber_profiles
        where user_id = target_barber_user_id
      ) then
      perform public.admin_delete_client_completely(target_barber_user_id);
    end if;

    return;
  end if;

  perform public.admin_delete_record_non_client(entity_type, target_id);
end;
$$;

revoke all on function public.admin_delete_record(text, uuid) from public, anon;
grant execute on function public.admin_delete_record(text, uuid) to authenticated;
