-- Caja, ventas, comisiones, fidelización, chat y analítica de marketing.
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('client','barber','cashier','admin','superadmin'));

alter table public.barber_profiles alter column commission_percent set default 50;
update public.barber_profiles set commission_percent=50 where commission_percent is null;
alter table public.barber_profiles alter column commission_percent set not null;

alter table public.products add column if not exists incentive_percent numeric(5,2) not null default 10
  check (incentive_percent between 0 and 100);

alter table public.profiles add column if not exists referral_code text;
update public.profiles set referral_code='LC-'||upper(substr(replace(id::text,'-',''),1,10)) where referral_code is null;
alter table public.profiles alter column referral_code set default ('LC-'||upper(substr(encode(gen_random_bytes(8),'hex'),1,10)));
alter table public.profiles alter column referral_code set not null;
create unique index if not exists profiles_referral_code_unique on public.profiles(lower(referral_code));

create table public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references public.profiles(id),
  closed_by uuid references public.profiles(id),
  opening_amount numeric(12,2) not null default 0 check(opening_amount>=0),
  expected_amount numeric(12,2),
  counted_amount numeric(12,2),
  difference_amount numeric(12,2),
  status text not null default 'open' check(status in ('open','closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text
);
create unique index cash_shifts_one_open_per_user on public.cash_shifts(opened_by) where status='open';

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.cash_shifts(id),
  kind text not null check(kind in ('sale','income','expense','refund','adjustment')),
  amount numeric(12,2) not null check(amount<>0),
  payment_method text not null default 'cash' check(payment_method in ('cash','qr','transfer','card','other')),
  reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.cash_shifts(id),
  appointment_id uuid references public.appointments(id),
  client_id uuid references public.profiles(id),
  guest_name text,
  guest_phone text,
  referral_code text,
  source text not null default 'walk_in' check(source in ('appointment','walk_in','product_reservation')),
  status text not null default 'draft' check(status in ('draft','pending_payment','paid','canceled','refunded')),
  list_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  paid_total numeric(12,2) not null default 0,
  barber_commission_total numeric(12,2) not null default 0,
  business_share numeric(12,2) not null default 0,
  claim_code text unique,
  loyalty_processed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index sales_appointment_unique on public.sales(appointment_id) where appointment_id is not null and status<>'canceled';

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  item_type text not null check(item_type in ('service','product')),
  service_id uuid references public.services(id),
  product_id uuid references public.products(id),
  barber_id uuid references public.barber_profiles(id),
  recommended_by_barber_id uuid references public.barber_profiles(id),
  name_snapshot text not null,
  quantity integer not null default 1 check(quantity between 1 and 100),
  unit_price_snapshot numeric(12,2) not null check(unit_price_snapshot>=0),
  commission_percent_snapshot numeric(5,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  check((item_type='service' and service_id is not null and barber_id is not null) or (item_type='product' and product_id is not null))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  shift_id uuid not null references public.cash_shifts(id),
  amount numeric(12,2) not null check(amount>=0),
  method text not null check(method in ('cash','qr','transfer','card','other')),
  reference text,
  status text not null default 'confirmed' check(status in ('confirmed','refunded','voided')),
  confirmed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  sale_id uuid not null unique references public.sales(id),
  verification_code text not null unique default upper(substr(encode(gen_random_bytes(12),'hex'),1,16)),
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz not null default now()
);

create table public.barber_earnings (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barber_profiles(id),
  sale_item_id uuid not null references public.sale_items(id),
  kind text not null check(kind in ('service_commission','product_incentive','adjustment','reversal')),
  base_amount numeric(12,2) not null,
  rate_percent numeric(5,2) not null,
  amount numeric(12,2) not null,
  status text not null default 'pending' check(status in ('pending','approved','paid','reversed')),
  created_at timestamptz not null default now(),
  unique(sale_item_id,kind)
);

create table public.barber_expenses (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barber_profiles(id),
  concept text not null,
  amount numeric(12,2) not null check(amount>0),
  receipt_path text,
  notes text,
  status text not null default 'pending' check(status in ('pending','approved','rejected','reimbursed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barber_profiles(id),
  period_start date not null,
  period_end date not null,
  commission_amount numeric(12,2) not null default 0,
  incentive_amount numeric(12,2) not null default 0,
  reimbursement_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'draft' check(status in ('draft','approved','paid','canceled')),
  created_by uuid not null references public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check(period_start<=period_end)
);

create table public.payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  earning_id uuid references public.barber_earnings(id),
  expense_id uuid references public.barber_expenses(id),
  amount numeric(12,2) not null,
  check((earning_id is not null)::int+(expense_id is not null)::int=1)
);
create unique index payout_items_earning_unique on public.payout_items(earning_id) where earning_id is not null;
create unique index payout_items_expense_unique on public.payout_items(expense_id) where expense_id is not null;

create table public.loyalty_settings (
  id boolean primary key default true check(id),
  service_points integer not null default 10 check(service_points>=0),
  product_amount_per_point numeric(10,2) not null default 10 check(product_amount_per_point>0),
  welcome_points integer not null default 5 check(welcome_points>=0),
  referral_referrer_points integer not null default 20 check(referral_referrer_points>=0),
  referral_referred_points integer not null default 10 check(referral_referred_points>=0),
  points_expiry_months integer not null default 12 check(points_expiry_months between 1 and 60),
  streak_visits integer not null default 3 check(streak_visits between 2 and 20),
  streak_days integer not null default 35 check(streak_days between 1 and 365),
  streak_bonus_points integer not null default 5 check(streak_bonus_points>=0),
  updated_at timestamptz not null default now()
);
insert into public.loyalty_settings(id) values(true) on conflict do nothing;

create table public.loyalty_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check(balance>=0),
  lifetime_earned integer not null default 0,
  lifetime_redeemed integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null check(points<>0),
  kind text not null check(kind in ('earn','redeem','expire','adjust','reverse')),
  reason text not null,
  idempotency_key text not null unique,
  source_type text,
  source_id uuid,
  expires_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  points_cost integer not null check(points_cost>0),
  reward_type text not null check(reward_type in ('percent_discount','fixed_discount','product','service')),
  reward_value numeric(12,2) not null default 0,
  max_discount numeric(12,2),
  product_id uuid references public.products(id),
  service_id uuid references public.services(id),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  created_at timestamptz not null default now()
);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  reward_id uuid not null references public.rewards(id),
  sale_id uuid references public.sales(id),
  code text not null unique default upper(substr(encode(gen_random_bytes(10),'hex'),1,12)),
  points_spent integer not null,
  status text not null default 'pending' check(status in ('pending','used','canceled','expired')),
  expires_at timestamptz not null default(now()+interval '30 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  discount_type text not null check(discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check(discount_value>0),
  max_discount numeric(12,2),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check(usage_limit is null or usage_limit>0),
  usage_count integer not null default 0 check(usage_count>=0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create unique index promotions_code_unique on public.promotions(lower(code));

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id),
  referred_id uuid not null unique references public.profiles(id),
  first_sale_id uuid unique references public.sales(id),
  status text not null default 'pending' check(status in ('pending','qualified','rewarded','rejected')),
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  check(referrer_id<>referred_id)
);

create table public.customer_streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_visits integer not null default 0,
  best_visits integer not null default 0,
  last_visit_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'Consulta con LEGEND CLUB',
  status text not null default 'open' check(status in ('open','closed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key(conversation_id,user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check(length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.web_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id),
  session_id text not null,
  event_name text not null check(length(event_name) between 1 and 80),
  path text,
  referrer text,
  campaign jsonb not null default '{}',
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.rewards(name,description,points_cost,reward_type,reward_value,max_discount)
select '20% de descuento','Descuento controlado sobre una atención.',50,'percent_discount',20,20
where not exists(select 1 from public.rewards where name='20% de descuento');
insert into public.rewards(name,description,points_cost,reward_type,reward_value,max_discount)
select '50% en servicio seleccionado','Promoción especial financiada por el negocio.',100,'percent_discount',50,12.50
where not exists(select 1 from public.rewards where name='50% en servicio seleccionado');

alter table public.cash_shifts enable row level security;
alter table public.cash_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;
alter table public.barber_earnings enable row level security;
alter table public.barber_expenses enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_items enable row level security;
alter table public.loyalty_settings enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.promotions enable row level security;
alter table public.referrals enable row level security;
alter table public.customer_streaks enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.web_events enable row level security;
