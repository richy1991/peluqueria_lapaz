-- Directorio administrativo de clientes con búsqueda y paginación en servidor.

create or replace function public.admin_list_clients(
  search_term text default null,
  page_number integer default 1,
  page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_size integer := least(greatest(coalesce(page_size, 25), 1), 100);
  normalized_search text := lower(btrim(coalesce(search_term, '')));
  result_rows jsonb;
  result_total bigint;
begin
  if not public.is_admin() then
    raise exception 'Acceso administrativo requerido';
  end if;

  select count(*)
    into result_total
  from public.profiles p
  where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p.id
      and ur.role in ('admin', 'superadmin')
  )
  and (
    normalized_search = ''
    or position(normalized_search in lower(
      coalesce(p.full_name, '') || ' ' || p.email || ' ' || coalesce(p.phone, '')
    )) > 0
  );

  select coalesce(jsonb_agg(to_jsonb(client_row)), '[]'::jsonb)
    into result_rows
  from (
    select
      p.id,
      p.full_name,
      p.email,
      p.phone,
      p.status,
      p.no_show_count,
      p.is_blacklisted,
      p.is_blocked,
      p.created_at
    from public.profiles p
    where not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p.id
        and ur.role in ('admin', 'superadmin')
    )
    and (
      normalized_search = ''
      or position(normalized_search in lower(
        coalesce(p.full_name, '') || ' ' || p.email || ' ' || coalesce(p.phone, '')
      )) > 0
    )
    order by p.created_at desc, p.id
    offset (safe_page - 1) * safe_size
    limit safe_size
  ) client_row;

  return jsonb_build_object(
    'rows', result_rows,
    'total', result_total,
    'page', safe_page,
    'page_size', safe_size
  );
end;
$$;

revoke all on function public.admin_list_clients(text, integer, integer) from public;
grant execute on function public.admin_list_clients(text, integer, integer) to authenticated;
