-- Catálogo reutilizable para clasificar productos sin alterar los registros existentes.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_categories_name_ci
  on public.product_categories (lower(trim(name)));

drop trigger if exists product_categories_set_updated_at on public.product_categories;
create trigger product_categories_set_updated_at
  before update on public.product_categories
  for each row execute procedure public.set_updated_at();

insert into public.product_categories (name)
select distinct trim(category)
from public.products
where nullif(trim(category), '') is not null
on conflict do nothing;

alter table public.product_categories enable row level security;

create policy "Product categories are readable"
  on public.product_categories for select
  using (active or public.is_admin());

create policy "Admins manage product categories"
  on public.product_categories for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on table public.product_categories to anon;
grant select, insert, update, delete on table public.product_categories to authenticated;
grant all on table public.product_categories to service_role;
