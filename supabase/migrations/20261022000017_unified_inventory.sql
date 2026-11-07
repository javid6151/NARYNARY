-- Migration 17: Unified Inventory — Single stock per building, Expected vs Actual Stock,
-- Physical Reconciliation, and Removal of multi-location store/kitchen transfers.

-- 1. Ensure inventory_direction handles unified transaction types
create or replace function public.inventory_direction(p_type text)
returns integer language sql immutable set search_path = '' as $$
  select case
    when p_type in ('purchase','issue_in','return_in','adjustment_in','correction_in','opening_balance') then 1
    else -1
  end;
$$;

-- 2. Physical Stock Verification / Reconciliation Tables
create table if not exists public.inventory_reconciliations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  building_id uuid not null,
  verified_by uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  period_start date,
  period_end date,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id) on delete cascade
);

create table if not exists public.inventory_reconciliation_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reconciliation_id uuid not null references public.inventory_reconciliations(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  expected_qty numeric(12,3) not null,
  actual_qty numeric(12,3) not null,
  discrepancy numeric(12,3) not null, -- actual_qty - expected_qty
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_reconciliations_lookup
  on public.inventory_reconciliations (tenant_id, building_id, verified_at desc);

create index if not exists idx_inv_rec_lines_item
  on public.inventory_reconciliation_lines (reconciliation_id, item_id);

-- Enable RLS
alter table public.inventory_reconciliations enable row level security;
alter table public.inventory_reconciliation_lines enable row level security;

create policy inventory_reconciliations_select on public.inventory_reconciliations for select
  using (public.can_access_building(tenant_id, building_id));

create policy inventory_reconciliations_insert on public.inventory_reconciliations for insert
  with check (public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy inventory_reconciliation_lines_select on public.inventory_reconciliation_lines for select
  using (public.has_tenant_role(tenant_id, array['owner','manager','chef']));

create policy inventory_reconciliation_lines_insert on public.inventory_reconciliation_lines for insert
  with check (public.has_tenant_role(tenant_id, array['owner','manager']));

-- 3. Refactor inventory_stock view to represent unified stock balance per ingredient per building
drop view if exists public.inventory_stock cascade;
create view public.inventory_stock with (security_invoker = true) as
select
  i.id as item_id,
  i.tenant_id,
  i.name,
  i.category,
  i.base_unit,
  i.reorder_level,
  i.is_active,
  b.id as building_id,
  b.name as building_name,
  -- Unified Expected Quantity (Purchases - Usage +/- Adjustments)
  coalesce((select sum(public.inventory_direction(t.transaction_type) * t.quantity)
            from public.inventory_transactions t
            where t.item_id = i.id and t.building_id = b.id), 0)::numeric(12,3) as expected_qty,
  coalesce((select sum(public.inventory_direction(t.transaction_type) * t.quantity)
            from public.inventory_transactions t
            where t.item_id = i.id and t.building_id = b.id), 0)::numeric(12,3) as current_qty,
  -- Backward-compatibility aliases for legacy callers:
  0::numeric(12,3) as store_qty,
  coalesce((select sum(public.inventory_direction(t.transaction_type) * t.quantity)
            from public.inventory_transactions t
            where t.item_id = i.id and t.building_id = b.id), 0)::numeric(12,3) as kitchen_qty,
  -- Last verified actual physical count
  (select rl.actual_qty
   from public.inventory_reconciliation_lines rl
   join public.inventory_reconciliations r on r.id = rl.reconciliation_id
   where rl.item_id = i.id and r.building_id = b.id
   order by r.verified_at desc limit 1) as last_actual_qty,
  (select r.verified_at
   from public.inventory_reconciliation_lines rl
   join public.inventory_reconciliations r on r.id = rl.reconciliation_id
   where rl.item_id = i.id and r.building_id = b.id
   order by r.verified_at desc limit 1) as last_verified_at,
  -- Last purchase unit cost
  (select t.unit_cost
   from public.inventory_transactions t
   where t.item_id = i.id and t.building_id = b.id
     and t.transaction_type = 'purchase' and t.unit_cost is not null
   order by t.occurred_at desc limit 1) as last_unit_cost,
  exists (select 1 from public.inventory_transactions t where t.item_id = i.id and t.building_id = b.id) as has_movements
from public.inventory_items i
join public.buildings b on b.tenant_id = i.tenant_id and b.status = 'active';

-- 4. Grants for authenticated users
grant select, insert on public.inventory_reconciliations to authenticated;
grant select, insert on public.inventory_reconciliation_lines to authenticated;
