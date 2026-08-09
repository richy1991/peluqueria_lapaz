-- La cuenta técnica del desarrollador tiene exclusivamente superadmin.
delete from public.user_roles
where user_id in (
  select id from public.profiles where lower(email)='dick.nina29@gmail.com'
)
and role <> 'superadmin';

create or replace function public.ensure_developer_superadmin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(coalesce(new.email,''))='dick.nina29@gmail.com' then
    delete from public.user_roles where user_id=new.id and role<>'superadmin';
    insert into public.user_roles(user_id,role) values(new.id,'superadmin') on conflict do nothing;
  end if;
  return new;
end; $$;
