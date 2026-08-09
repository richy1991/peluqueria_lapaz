-- El desarrollador conserva superadmin incluso si su identidad Google se recrea.
create or replace function public.ensure_developer_superadmin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(coalesce(new.email,''))='dick.nina29@gmail.com' then
    insert into public.user_roles(user_id,role) values(new.id,'superadmin') on conflict do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists zz_ensure_developer_superadmin on auth.users;
create trigger zz_ensure_developer_superadmin after insert or update of email on auth.users for each row execute procedure public.ensure_developer_superadmin();

insert into public.user_roles(user_id,role)
select id,'superadmin' from public.profiles where lower(email)='dick.nina29@gmail.com'
on conflict do nothing;
