-- Migration 4: rent charges, payments, allocations, receipts, expenses, vendors.

create table public.rent_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  resident_id uuid not null,
  admission_id uuid not null,
  building_id uuid not null,
  charge_type text not null check (charge_type in ('rent','deposit','setup_fee','utility','meal','late_fee','other')),
  description text,
  period_start date,
  period_end date,
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'unpaid' check (status in ('unpaid','partially_paid','paid','waived','cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id),
  foreign key (tenant_id, admission_id) references public.admissions(tenant_id, id)
);
create index rent_charges_lookup on public.rent_charges (tenant_id, resident_id, due_date, status);
-- One rent charge per admission per period (makes monthly generation idempotent)
create unique index rent_charges_one_rent_per_period on public.rent_charges (admission_id, period_start)
  where charge_type = 'rent' and status <> 'cancelled';
create trigger rent_charges_touch before update on public.rent_charges
  for each row execute function public.touch_updated_at();

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  resident_id uuid not null,
  building_id uuid,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','upi','bank_transfer','card','online_gateway','other')),
  transaction_reference text,
  paid_at timestamptz not null,
  recorded_by uuid not null references auth.users(id),
  status text not null default 'confirmed' check (status in ('recorded','confirmed','reversed','failed')),
  reversal_reason text,
  reversed_by uuid references auth.users(id),
  reversed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id)
);
create index payments_tenant_paid on public.payment_transactions (tenant_id, paid_at desc);
create index payments_resident_paid on public.payment_transactions (resident_id, paid_at desc);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  payment_transaction_id uuid not null,
  rent_charge_id uuid not null,
  allocated_amount numeric(12,2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, payment_transaction_id) references public.payment_transactions(tenant_id, id),
  foreign key (tenant_id, rent_charge_id) references public.rent_charges(tenant_id, id)
);
create index allocations_charge on public.payment_allocations (rent_charge_id);

create table public.receipt_counters (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  last_number integer not null default 0
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  payment_transaction_id uuid not null,
  receipt_number text not null,
  issued_at timestamptz not null default now(),
  issued_by uuid not null references auth.users(id),
  unique (tenant_id, receipt_number),
  unique (payment_transaction_id),
  foreign key (tenant_id, payment_transaction_id) references public.payment_transactions(tenant_id, id)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_maintenance boolean not null default false,
  is_active boolean not null default true,
  unique (tenant_id, name),
  unique (tenant_id, id)
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  service_categories text[] not null default '{}',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create trigger vendors_touch before update on public.vendors
  for each row execute function public.touch_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  floor_id uuid,
  room_id uuid,
  category_id uuid not null,
  source_type text not null default 'general'
    check (source_type in ('general','maintenance','inventory','salary','utility','other')),
  source_id uuid,
  vendor_id uuid,
  title text not null,
  description text,
  expense_date date not null,
  due_date date,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount > 0),
  status text not null default 'approved' check (status in ('draft','submitted','approved','rejected','cancelled')),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (total_amount = subtotal + tax_amount),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id),
  foreign key (tenant_id, category_id) references public.expense_categories(tenant_id, id),
  foreign key (tenant_id, vendor_id) references public.vendors(tenant_id, id)
);
create index expenses_lookup on public.expenses (tenant_id, building_id, expense_date desc);
create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

create table public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  expense_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null,
  payment_method text not null check (payment_method in ('cash','upi','bank_transfer','card','cheque','other')),
  transaction_reference text,
  notes text,
  recorded_by uuid not null references auth.users(id),
  status text not null default 'confirmed' check (status in ('confirmed','reversed')),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, expense_id) references public.expenses(tenant_id, id)
);
create index expense_payments_expense on public.expense_payments (expense_id);

-- Derived balances (views run with invoker rights so RLS of base tables applies)
create view public.rent_charge_balances with (security_invoker = true) as
select c.*,
  coalesce((select sum(pa.allocated_amount) from public.payment_allocations pa
            join public.payment_transactions p on p.id = pa.payment_transaction_id and p.status = 'confirmed'
            where pa.rent_charge_id = c.id), 0)::numeric(12,2) as paid_amount,
  (c.amount - coalesce((select sum(pa.allocated_amount) from public.payment_allocations pa
            join public.payment_transactions p on p.id = pa.payment_transaction_id and p.status = 'confirmed'
            where pa.rent_charge_id = c.id), 0))::numeric(12,2) as balance
from public.rent_charges c;

create view public.expense_balances with (security_invoker = true) as
select e.*,
  coalesce((select sum(ep.amount) from public.expense_payments ep
            where ep.expense_id = e.id and ep.status = 'confirmed'), 0)::numeric(12,2) as paid_amount,
  (e.total_amount - coalesce((select sum(ep.amount) from public.expense_payments ep
            where ep.expense_id = e.id and ep.status = 'confirmed'), 0))::numeric(12,2) as outstanding_amount
from public.expenses e;

alter table public.rent_charges enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.receipt_counters enable row level security;
alter table public.receipts enable row level security;
alter table public.expense_categories enable row level security;
alter table public.vendors enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_payments enable row level security;

-- Residents: own records. Owners/managers: accessible buildings. Chefs: none.
create policy rent_charges_select on public.rent_charges for select
  using (resident_id in (select public.my_resident_ids())
         or public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy payments_select on public.payment_transactions for select
  using (resident_id in (select public.my_resident_ids())
         or public.can_staff_view_resident(tenant_id, resident_id));

create policy allocations_select on public.payment_allocations for select
  using (exists (select 1 from public.payment_transactions p where p.id = payment_transaction_id));

create policy receipts_select on public.receipts for select
  using (exists (select 1 from public.payment_transactions p where p.id = payment_transaction_id));

create policy expense_categories_select on public.expense_categories for select
  using (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy expense_categories_insert on public.expense_categories for insert
  with check (public.has_tenant_role(tenant_id, array['owner']));
create policy expense_categories_update on public.expense_categories for update
  using (public.has_tenant_role(tenant_id, array['owner']))
  with check (public.has_tenant_role(tenant_id, array['owner']));

create policy vendors_select on public.vendors for select
  using (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy vendors_insert on public.vendors for insert
  with check (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy vendors_update on public.vendors for update
  using (public.has_tenant_role(tenant_id, array['owner','manager']))
  with check (public.has_tenant_role(tenant_id, array['owner','manager']));

create policy expenses_select on public.expenses for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy expense_payments_select on public.expense_payments for select
  using (exists (select 1 from public.expenses e where e.id = expense_id));
