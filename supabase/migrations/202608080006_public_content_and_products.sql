-- Contenido administrable, catálogo de productos y almacenamiento público.

alter table public.business_settings
  add column if not exists logo_path text,
  add column if not exists cover_path text,
  add column if not exists hours_text text not null default 'Martes a domingo · 09:00 a 20:00',
  add column if not exists minimum_booking_notice_minutes integer not null default 30
    check (minimum_booking_notice_minutes between 0 and 10080);

alter table public.gallery_posts
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists sort_order integer not null default 0;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category text,
  price numeric(10,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_path text,
  thumbnail_path text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_reservations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  product_id uuid not null references public.products(id),
  quantity integer not null default 1 check (quantity between 1 and 10),
  price_snapshot numeric(10,2) not null,
  status text not null default 'reserved' check (status in ('reserved', 'collected', 'canceled', 'expired')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

create trigger gallery_posts_set_updated_at
  before update on public.gallery_posts
  for each row execute procedure public.set_updated_at();

create trigger business_settings_set_updated_at
  before update on public.business_settings
  for each row execute procedure public.set_updated_at();

create or replace function public.reserve_product(
  p_product_id uuid,
  p_quantity integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_reserved integer;
  v_reservation_id uuid;
begin
  if v_client_id is null then
    raise exception 'Debes iniciar sesión para apartar un producto.' using errcode = 'P0001';
  end if;

  if p_quantity < 1 or p_quantity > 10 then
    raise exception 'La cantidad solicitada no es válida.' using errcode = 'P0001';
  end if;

  update public.product_reservations
  set status = 'expired', updated_at = now()
  where status = 'reserved' and expires_at <= now();

  select * into v_product
  from public.products
  where id = p_product_id and status = 'active'
  for update;

  if not found then
    raise exception 'El producto ya no está disponible.' using errcode = 'P0001';
  end if;

  select coalesce(sum(quantity), 0)::integer into v_reserved
  from public.product_reservations
  where product_id = p_product_id
    and status = 'reserved'
    and expires_at > now();

  if v_product.stock - v_reserved < p_quantity then
    raise exception 'No hay suficiente stock disponible.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.product_reservations
    where client_id = v_client_id
      and product_id = p_product_id
      and status = 'reserved'
      and expires_at > now()
  ) then
    raise exception 'Ya tienes este producto apartado.' using errcode = 'P0001';
  end if;

  insert into public.product_reservations (
    client_id, product_id, quantity, price_snapshot
  ) values (
    v_client_id, p_product_id, p_quantity, v_product.price
  ) returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

alter table public.products enable row level security;
alter table public.product_reservations enable row level security;

create policy "Public can read active products"
  on public.products for select using (status = 'active');
create policy "Admins manage products"
  on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "Users read own product reservations"
  on public.product_reservations for select
  using (client_id = auth.uid() or public.is_admin());
create policy "Admins manage product reservations"
  on public.product_reservations for all
  using (public.is_admin()) with check (public.is_admin());

revoke all on function public.reserve_product(uuid, integer) from public;
grant execute on function public.reserve_product(uuid, integer) to authenticated;
grant execute on function public.is_admin() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins upload public media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and public.is_admin());
create policy "Admins update public media"
  on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and public.is_admin())
  with check (bucket_id = 'public-media' and public.is_admin());
create policy "Admins delete public media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and public.is_admin());

insert into public.gallery_posts (
  id, title, description, image_path, status, client_consent, featured, sort_order
) values
  ('30000000-0000-4000-8000-000000000001', 'Corte clásico', 'Acabado limpio y natural.', 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=85', 'published', true, true, 1),
  ('30000000-0000-4000-8000-000000000002', 'Perfilado de barba', 'Detalle, simetría y cuidado.', 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=85', 'published', true, false, 2),
  ('30000000-0000-4000-8000-000000000003', 'Textura y estilo', 'Trabajo personalizado para cada cliente.', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=85', 'published', true, false, 3),
  ('30000000-0000-4000-8000-000000000004', 'Nuestro espacio', 'Un lugar preparado para atenderte sin apuros.', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=85', 'published', true, false, 4)
on conflict (id) do nothing;

insert into public.products (
  id, name, slug, description, category, price, stock, image_path, status
) values
  ('40000000-0000-4000-8000-000000000001', 'Pomada de acabado', 'pomada-acabado', 'Fijación media con acabado natural para uso diario.', 'Styling', 85, 8, 'https://images.unsplash.com/photo-1585232351009-aa87416fca90?auto=format&fit=crop&w=900&q=85', 'active'),
  ('40000000-0000-4000-8000-000000000002', 'Aceite para barba', 'aceite-barba', 'Hidratación ligera y aroma fresco.', 'Barba', 70, 6, 'https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=900&q=85', 'active'),
  ('40000000-0000-4000-8000-000000000003', 'Shampoo profesional', 'shampoo-profesional', 'Limpieza suave para cabello y cuero cabelludo.', 'Cuidado', 95, 5, 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85', 'active')
on conflict (id) do nothing;
