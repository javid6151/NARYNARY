-- Migration 6: meal menus, availability, reviews, inventory ledger, kitchen reports.

create table public.meal_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  breakfast_cutoff time not null default '06:00',
  lunch_cutoff time not null default '11:00',
  dinner_cutoff time not null default '18:00',
  allow_reviews boolean not null default true
);

create table public.meal_menus (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  meal_date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  items text not null check (length(items) between 1 and 300),
  serving_start time,
  serving_end time,
  status text not null default 'published' check (status in ('draft','published','cancelled')),
  change_reason text,
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, meal_date, meal_type),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id)
);
create trigger meal_menus_touch before update on public.meal_menus
  for each row execute function public.touch_updated_at();

create table public.meal_availability (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  resident_id uuid not null,
  meal_date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  is_unavailable boolean not null,
  updated_at timestamptz not null default now(),
  unique (resident_id, meal_date, meal_type),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id)
);
create index meal_availability_count on public.meal_availability (building_id, meal_date, meal_type) where is_unavailable;

create table public.meal_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  resident_id uuid not null,
  meal_menu_id uuid not null,
  rating integer not null check (rating between 1 and 5),
  comment text check (length(comment) <= 500),
  admin_note text,
  created_at timestamptz not null default now(),
  unique (resident_id, meal_menu_id),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id),
  foreign key (tenant_id, meal_menu_id) references public.meal_menus(tenant_id, id)
);

-- Each building gets two locations: the main 'store' and the 'kitchen'.
-- Stock is issued store → kitchen; chefs record consumption/wastage/returns from the kitchen.
create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  name text not null,
  kind text not null check (kind in ('store','kitchen')),
  is_active boolean not null default true,
  unique (building_id, name),
  unique (building_id, kind),
  unique (tenant_id, building_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id) on delete cascade
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  base_unit text not null check (base_unit in ('kg','g','litre','ml','piece','pack','dozen')),
  reorder_level numeric(12,3) not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (tenant_id, id)
);
create trigger inventory_items_touch before update on public.inventory_items
  for each row execute function public.touch_updated_at();

-- Immutable stock movement ledger. quantity is always positive;
-- direction is derived from transaction_type (see inventory_direction()).
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  inventory_location_id uuid not null,
  item_id uuid not null,
  transaction_type text not null
    check (transaction_type in ('purchase','issue_out','issue_in','consumption','return_out','return_in',
                                'wastage','adjustment_in','adjustment_out')),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_cost numeric(12,2) check (unit_cost >= 0),
  vendor_id uuid,
  reference_type text,
  reference_id uuid,
  notes text,
  recorded_by uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, building_id, inventory_location_id) references public.inventory_locations(tenant_id, building_id, id),
  foreign key (tenant_id, item_id) references public.inventory_items(tenant_id, id),
  foreign key (tenant_id, vendor_id) references public.vendors(tenant_id, id)
);
create index inventory_tx_lookup on public.inventory_transactions (tenant_id, building_id, inventory_location_id, item_id, occurred_at desc);

create or replace function public.inventory_direction(p_type text)
returns integer language sql immutable set search_path = '' as $$
  select case when p_type in ('purchase','issue_in','return_in','adjustment_in') then 1 else -1 end;
$$;

create view public.inventory_balances with (security_invoker = true) as
select t.tenant_id, t.building_id, t.inventory_location_id, t.item_id,
       sum(public.inventory_direction(t.transaction_type) * t.quantity)::numeric(12,3) as quantity
from public.inventory_transactions t
group by t.tenant_id, t.building_id, t.inventory_location_id, t.item_id;

create table public.kitchen_daily_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  report_date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  chef_user_id uuid not null references auth.users(id),
  expected_meal_count integer,
  actual_meal_count integer,
  summary text,
  status text not null default 'submitted' check (status in ('draft','submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, report_date, meal_type),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id)
);

alter table public.meal_settings enable row level security;
alter table public.meal_menus enable row level security;
alter table public.meal_availability enable row level security;
alter table public.meal_reviews enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.kitchen_daily_reports enable row level security;

create policy meal_settings_select on public.meal_settings for select
  using (public.has_tenant_role(tenant_id, array['owner','manager','chef'])
         or tenant_id in (select r.tenant_id from public.residents r where r.id in (select public.my_resident_ids())));
create policy meal_settings_update on public.meal_settings for update
  using (public.has_tenant_role(tenant_id, array['owner'])) with check (public.has_tenant_role(tenant_id, array['owner']));

create policy meal_menus_select on public.meal_menus for select
  using (public.can_access_building(tenant_id, building_id)
         or (status = 'published' and building_id in (select public.my_resident_building_ids())));
create policy meal_menus_insert on public.meal_menus for insert
  with check (public.can_access_building(tenant_id, building_id));
create policy meal_menus_update on public.meal_menus for update
  using (public.can_access_building(tenant_id, building_id))
  with check (public.can_access_building(tenant_id, building_id));

-- Kitchen staff see counts per meal via meal_count_summary(); raw rows are visible
-- to owners/managers/chefs of the building (names only, no KYC) and the resident themself.
create policy meal_availability_select on public.meal_availability for select
  using (resident_id in (select public.my_resident_ids())
         or public.can_access_building(tenant_id, building_id));

create policy meal_reviews_select on public.meal_reviews for select
  using (resident_id in (select public.my_resident_ids())
         or public.can_access_building(tenant_id, building_id, array['owner','manager','chef']));

create policy inventory_locations_select on public.inventory_locations for select
  using (public.can_access_building(tenant_id, building_id));

create policy inventory_items_select on public.inventory_items for select
  using (public.has_tenant_role(tenant_id, array['owner','manager','chef']));
create policy inventory_items_insert on public.inventory_items for insert
  with check (public.has_tenant_role(tenant_id, array['owner','manager','chef']));
create policy inventory_items_update on public.inventory_items for update
  using (public.has_tenant_role(tenant_id, array['owner','manager','chef']))
  with check (public.has_tenant_role(tenant_id, array['owner','manager','chef']));

create policy inventory_tx_select on public.inventory_transactions for select
  using (public.can_access_building(tenant_id, building_id));

create policy kitchen_reports_select on public.kitchen_daily_reports for select
  using (public.can_access_building(tenant_id, building_id));
