-- قاعدة بيانات Supabase: نفّذ هذا الملف في SQL Editor
-- الجداول تدعم العمل Offline-first (المعرّفات نصية من العميل)

create table if not exists allowed_users (
  email text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  barcode text,
  purchase_price numeric not null default 0,
  sale_price numeric not null default 0,
  stock numeric not null default 0,
  supplier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchases (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  supplier text not null default '',
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  discount_total numeric not null default 0,
  grand_total numeric not null default 0,
  date timestamptz not null default now(),
  notes text
);

create table if not exists sales (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  net_total numeric not null default 0,
  profit_total numeric not null default 0,
  date timestamptz not null default now(),
  notes text,
  customer_name text,
  invoice_no text,
  previous_balance numeric not null default 0,
  paid_amount numeric not null default 0
);

-- ترقية المنشآت القديمة: أعمدة الفاتورة الكلاسيكية (آمنة مع IF NOT EXISTS)
alter table sales add column if not exists customer_name text;
alter table sales add column if not exists invoice_no text;
alter table sales add column if not exists previous_balance numeric not null default 0;
alter table sales add column if not exists paid_amount numeric not null default 0;

-- العملاء والحسابات: رصيد دائم لكل عميل (لا يُمسح عند تسجيل الخروج)
create table if not exists customers (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  balance numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- فهرس للبحث بالباركود
create index if not exists idx_products_barcode on products (barcode);
create index if not exists idx_sales_date on sales (date desc);
create index if not exists idx_purchases_date on purchases (date desc);
create index if not exists idx_products_user on products (user_id);
create index if not exists idx_purchases_user on purchases (user_id);
create index if not exists idx_sales_user on sales (user_id);
create index if not exists idx_customers_user on customers (user_id);
create index if not exists idx_customers_name on customers (name);
create index if not exists idx_sales_invoice_no on sales (invoice_no);

-- تفعيل RLS (كل مستخدم يرى بياناته فقط)
alter table allowed_users enable row level security;
alter table products enable row level security;
alter table purchases enable row level security;
alter table sales enable row level security;
alter table customers enable row level security;

-- سياسات: القراءة/الكتابة للمستخدم المالك فقط
drop policy if exists "owner all products" on products;
create policy "owner all products" on products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all purchases" on purchases;
create policy "owner all purchases" on purchases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all sales" on sales;
create policy "owner all sales" on sales for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all customers" on customers;
create policy "owner all customers" on customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- allowed_users: يقرأها المستخدمون المسجلون (لفحص التفعيل)، ويعدّلها المسؤول عبر Dashboard
drop policy if exists "read allowed users" on allowed_users;
create policy "read allowed users" on allowed_users for select using (true);

-- bucket للنسخ الاحتياطية (أنشئه من Storage ثم نفّذ):
-- insert into storage.buckets (id, name, public) values ('backups','backups', false)
-- on conflict (id) do nothing;

-- مثال: تفعيل إيميل (نفّذها كمسؤول):
-- insert into allowed_users (email, is_active) values ('admin@store.com', true)
-- on conflict (email) do update set is_active = true;
