-- Migration 2: buildings, floors, rooms, beds, building-scoped staff access.

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  code text,
  address text,
  city text,
  status text not null default 'pending_approval'
    check (status in ('draft','pending_approval','active','rejected','suspended','archived')),
  requested_details jsonb not null default '{}'::jsonb,
  review_notes text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (tenant_id, id)
);
create index buildings_tenant_status on public.buildings (tenant_id, status);
create trigger buildings_touch before update on public.buildings
  for each row execute function public.touch_updated_at();

create table public.building_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  building_id uuid not null,
  membership_id uuid not null references public.tenant_memberships(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (building_id, membership_id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id) on delete cascade
);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  floor_number integer not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, floor_number),
  unique (tenant_id, building_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id) on delete cascade
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  floor_id uuid not null,
  room_number text not null,
  sharing_capacity integer not null check (sharing_capacity between 1 and 12),
  base_monthly_rent numeric(12,2) not null default 0 check (base_monthly_rent >= 0),
  status text not null default 'active' check (status in ('active','maintenance','inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, room_number),
  unique (tenant_id, building_id, id),
  foreign key (tenant_id, building_id, floor_id) references public.floors(tenant_id, building_id, id) on delete cascade
);
create index rooms_floor_idx on public.rooms (building_id, floor_id, room_number);
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

create table public.beds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  room_id uuid not null,
  bed_label text not null,
  status text not null default 'active' check (status in ('active','maintenance','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, bed_label),
  unique (tenant_id, building_id, id),
  foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Building access helper: owners → every building in tenant;
-- managers/chefs → only assigned buildings.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_building(p_tenant uuid, p_building uuid, p_roles text[] default array['owner','manager','chef'])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tenant_memberships m
    join public.tenants t on t.id = m.tenant_id and t.status = 'active'
    where m.tenant_id = p_tenant
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
      and (
        m.role = 'owner'
        or exists (select 1 from public.building_memberships bm
                   where bm.membership_id = m.id and bm.building_id = p_building)
      )
  );
$$;

-- Building ids the current staff user can access (for list filters in functions)
create or replace function public.my_building_ids(p_roles text[] default array['owner','manager','chef'])
returns setof uuid language sql stable security definer set search_path = '' as $$
  select b.id
  from public.buildings b
  join public.tenant_memberships m on m.tenant_id = b.tenant_id and m.user_id = auth.uid() and m.status = 'active'
  join public.tenants t on t.id = b.tenant_id and t.status = 'active'
  where m.role = any(p_roles)
    and (m.role = 'owner' or exists (select 1 from public.building_memberships bm
                                     where bm.membership_id = m.id and bm.building_id = b.id));
$$;

alter table public.buildings enable row level security;
alter table public.building_memberships enable row level security;
alter table public.floors enable row level security;
alter table public.rooms enable row level security;
alter table public.beds enable row level security;

create policy buildings_select on public.buildings for select
  using (public.is_platform_admin() or public.can_access_building(tenant_id, id));
-- Owner/manager may edit descriptive fields of accessible buildings. Status changes are guarded by trigger.
create policy buildings_update on public.buildings for update
  using (public.can_access_building(tenant_id, id, array['owner']))
  with check (public.can_access_building(tenant_id, id, array['owner']));

create or replace function public.buildings_guard_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.status is distinct from old.status or new.approved_by is distinct from old.approved_by
      or new.tenant_id is distinct from old.tenant_id)
     and current_setting('app.trusted', true) is distinct from 'on' then
    raise exception 'FORBIDDEN: building status can only change through approval workflow' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger buildings_guard before update on public.buildings
  for each row execute function public.buildings_guard_status();

create policy building_memberships_select on public.building_memberships for select
  using (public.has_tenant_role(tenant_id, array['owner'])
         or exists (select 1 from public.tenant_memberships m where m.id = membership_id and m.user_id = auth.uid()));

create policy floors_select on public.floors for select
  using (public.can_access_building(tenant_id, building_id));
create policy floors_write on public.floors for insert
  with check (public.can_access_building(tenant_id, building_id, array['owner','manager']));
create policy floors_update on public.floors for update
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']))
  with check (public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy rooms_select on public.rooms for select
  using (public.can_access_building(tenant_id, building_id));
create policy rooms_update on public.rooms for update
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']))
  with check (public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy beds_select on public.beds for select
  using (public.can_access_building(tenant_id, building_id));
