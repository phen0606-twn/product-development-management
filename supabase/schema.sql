create extension if not exists "pgcrypto";

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  payment_terms text,
  bank_info text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text,
  name text not null,
  category text,
  color text,
  size text,
  vendor_id uuid references vendors(id) on delete set null,
  status text not null default 'planning',
  specification_summary text,
  attachment_url text,
  target_launch_date date,
  actual_launch_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists development_progress (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  stage text not null,
  title text,
  content text,
  started_at date,
  expected_completed_at date,
  completed_at date,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists purchase_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null,
  name text,
  ordered_at date,
  quantity numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists development_costs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  purchase_batch_id uuid references purchase_batches(id) on delete set null,
  type text not null,
  custom_type text,
  description text,
  amount numeric not null default 0,
  currency text not null default 'TWD',
  exchange_rate_to_twd numeric not null default 1,
  bank_fee_twd numeric not null default 0,
  paid_amount numeric not null default 0,
  paid_at date,
  due_at date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sales_records (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  external_sku text,
  external_product_name text,
  sold_at date not null,
  quantity numeric not null default 0,
  revenue numeric not null default 0,
  channel text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sales_targets (
  id uuid primary key default gen_random_uuid(),
  target_month date not null,
  category text not null default '未分類',
  target_amount numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists channel_sales_records (
  id uuid primary key default gen_random_uuid(),
  sales_month date not null,
  channel_category text not null,
  revenue numeric not null default 0,
  quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists channel_store_sales_records (
  id uuid primary key default gen_random_uuid(),
  sales_month date not null,
  channel_category text not null,
  store_name text not null,
  revenue numeric not null default 0,
  quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table vendors enable row level security;
alter table products enable row level security;
alter table development_progress enable row level security;
alter table purchase_batches enable row level security;
alter table development_costs enable row level security;
alter table sales_records enable row level security;
alter table sales_targets enable row level security;
alter table channel_sales_records enable row level security;
alter table channel_store_sales_records enable row level security;

create policy "Authenticated users can manage vendors" on vendors for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage products" on products for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage progress" on development_progress for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage batches" on purchase_batches for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage costs" on development_costs for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage sales" on sales_records for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage targets" on sales_targets for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage channel sales" on channel_sales_records for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage store sales" on channel_store_sales_records for all to authenticated using (true) with check (true);
