alter table products
add column if not exists color text,
add column if not exists size text,
add column if not exists category text,
add column if not exists current_stage text,
add column if not exists spec_summary text,
add column if not exists specification_summary text,
add column if not exists attachment_url text,
add column if not exists target_launch_date date,
add column if not exists notes text;

alter table vendors
add column if not exists contact_name text,
add column if not exists phone text,
add column if not exists email text,
add column if not exists address text,
add column if not exists payment_terms text,
add column if not exists bank_info text,
add column if not exists notes text;

create table if not exists development_progress (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
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
  batch_no text,
  name text,
  ordered_at date,
  quantity numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table development_costs
add column if not exists product_id uuid references products(id) on delete set null,
add column if not exists batch_id uuid references purchase_batches(id) on delete set null,
add column if not exists type text,
add column if not exists custom_type text,
add column if not exists description text,
add column if not exists amount numeric not null default 0,
add column if not exists paid_amount numeric not null default 0,
add column if not exists currency text not null default 'TWD',
add column if not exists exchange_rate_to_twd numeric not null default 1,
add column if not exists bank_fee_twd numeric not null default 0,
add column if not exists paid_at date,
add column if not exists due_date date,
add column if not exists notes text;

alter table development_progress enable row level security;
alter table purchase_batches enable row level security;

drop policy if exists "Authenticated users can manage progress" on development_progress;
create policy "Authenticated users can manage progress" on development_progress
for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can manage batches" on purchase_batches;
create policy "Authenticated users can manage batches" on purchase_batches
for all to authenticated using (true) with check (true);
