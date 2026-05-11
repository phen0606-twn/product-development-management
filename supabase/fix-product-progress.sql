alter table products
add column if not exists sku text,
add column if not exists name text,
add column if not exists category text,
add column if not exists color text,
add column if not exists size text,
add column if not exists vendor_id uuid references vendors(id) on delete set null,
add column if not exists status text default 'planning',
add column if not exists current_stage text,
add column if not exists spec_summary text,
add column if not exists specification_summary text,
add column if not exists attachment_url text,
add column if not exists target_launch_date date,
add column if not exists notes text,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

create table if not exists development_progress (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  stage text not null default '提案',
  title text,
  content text,
  started_at date,
  expected_completed_at date,
  completed_at date,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table products enable row level security;
alter table development_progress enable row level security;

drop policy if exists "Authenticated users can manage products" on products;
create policy "Authenticated users can manage products"
on products for all to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage progress" on development_progress;
create policy "Authenticated users can manage progress"
on development_progress for all to authenticated
using (true)
with check (true);
