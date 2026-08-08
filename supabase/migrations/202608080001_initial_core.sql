-- Navaja: núcleo inicial para autenticación, contenido y reservas.
-- Ejecutar mediante Supabase CLI cuando el proyecto remoto esté disponible.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  phone_normalized text,
  phone_confirmed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive', 'deactivated', 'suspended')),
  no_show_count integer not null default 0 check (no_show_count >= 0),
  is_blacklisted boolean not null default false,
  is_blocked boolean not null default false,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'superadmin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.barber_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  bio text,
  photo_path text,
  specialties text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category text,
  price numeric(10,2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  grace_minutes integer not null default 10 check (grace_minutes between 0 and 120),
  image_path text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.barber_services (
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (barber_id, service_id)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barber_profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  active boolean not null default true,
  check (starts_at < ends_at)
);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references public.barber_profiles(id) on delete cascade,
  kind text not null check (kind in ('holiday', 'vacation', 'absence', 'emergency', 'maintenance')),
  reason text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  barber_id uuid not null references public.barber_profiles(id),
  service_id uuid not null references public.services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  blocked_until timestamptz not null,
  duration_snapshot integer not null,
  price_snapshot numeric(10,2) not null,
  service_name_snapshot text not null,
  status text not null default 'confirmed' check (status in ('requested', 'confirmed', 'in_progress', 'completed', 'canceled', 'no_show', 'needs_reschedule', 'pending_client_confirmation')),
  notes text,
  reference_image_path text,
  is_delayed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  check (ends_at <= blocked_until)
);

-- blocked_until incluye el tiempo de preparación posterior y mantiene
-- inmutable la expresión usada por el índice GiST de PostgreSQL.
alter table public.appointments
  add constraint appointments_no_barber_overlap
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (status in ('requested', 'confirmed', 'in_progress', 'pending_client_confirmation'));

create table public.business_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Navaja',
  description text,
  address text,
  phone text,
  whatsapp text,
  map_url text,
  instagram_url text,
  facebook_url text,
  business_status text not null default 'open' check (business_status in ('open', 'closed', 'emergency_closed', 'appointment_only')),
  status_message text,
  timezone text not null default 'America/La_Paz',
  booking_buffer_minutes integer not null default 5,
  updated_at timestamptz not null default now()
);

create table public.gallery_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_path text not null,
  thumbnail_path text,
  service_id uuid references public.services(id) on delete set null,
  barber_id uuid references public.barber_profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  client_consent boolean not null default false,
  consent_date timestamptz,
  is_minor_consent boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.barber_profiles enable row level security;
alter table public.services enable row level security;
alter table public.barber_services enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.appointments enable row level security;
alter table public.business_settings enable row level security;
alter table public.gallery_posts enable row level security;
alter table public.audit_logs enable row level security;

create policy "Public can read active services" on public.services for select using (status = 'active');
create policy "Public can read active barbers" on public.barber_profiles for select using (active);
create policy "Public can read barber services" on public.barber_services for select using (true);
create policy "Public can read schedules" on public.schedules for select using (active);
create policy "Public can read business settings" on public.business_settings for select using (true);
create policy "Public can read published gallery" on public.gallery_posts for select using (status = 'published' and client_consent);
create policy "Users can read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "Users can update own basic profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Users can read own appointments" on public.appointments for select using (client_id = auth.uid() or public.is_admin());
create policy "Admins manage services" on public.services for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage barbers" on public.barber_profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage barber services" on public.barber_services for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage schedules" on public.schedules for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage exceptions" on public.schedule_exceptions for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage appointments" on public.appointments for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage business settings" on public.business_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage gallery" on public.gallery_posts for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins read audit logs" on public.audit_logs for select using (public.is_admin());

insert into public.business_settings (id, business_name, description, address, phone, whatsapp)
values (true, 'Navaja', 'Peluquería y barbería de demostración', 'Av. 6 de Agosto 2145, Sopocachi, La Paz', '+591 720 12345', '59172012345')
on conflict (id) do nothing;
