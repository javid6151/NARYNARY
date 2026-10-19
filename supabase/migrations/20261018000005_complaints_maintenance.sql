-- Migration 5: complaints and maintenance.

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  resident_id uuid not null,
  room_id uuid,
  category text not null check (category in ('electrical','plumbing','wifi','cleaning','furniture','food','security','other')),
  title text not null check (length(title) between 3 and 140),
  description text not null check (length(description) <= 2000),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','in_progress','awaiting_resident','resolved','closed','rejected')),
  assigned_membership_id uuid references public.tenant_memberships(id),
  resolution_notes text,
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id)
);
create index complaints_lookup on public.complaints (tenant_id, building_id, status, submitted_at desc);
create trigger complaints_touch before update on public.complaints
  for each row execute function public.touch_updated_at();

create table public.maintenance_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  unique (tenant_id, name),
  unique (tenant_id, id)
);

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  floor_id uuid,
  room_id uuid,
  complaint_id uuid,
  title text not null,
  description text not null,
  category_id uuid not null,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','assigned','in_progress','on_hold','completed','cancelled')),
  assigned_to text,
  vendor_id uuid,
  reported_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  completion_notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id),
  foreign key (tenant_id, category_id) references public.maintenance_categories(tenant_id, id),
  foreign key (tenant_id, vendor_id) references public.vendors(tenant_id, id),
  foreign key (tenant_id, complaint_id) references public.complaints(tenant_id, id)
);
create unique index maintenance_one_per_complaint on public.maintenance_requests (complaint_id) where complaint_id is not null;
create index maintenance_lookup on public.maintenance_requests (tenant_id, building_id, status, priority);
create trigger maintenance_touch before update on public.maintenance_requests
  for each row execute function public.touch_updated_at();

create table public.maintenance_activity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  maintenance_request_id uuid not null,
  from_status text,
  to_status text,
  note text,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, maintenance_request_id) references public.maintenance_requests(tenant_id, id) on delete cascade
);

alter table public.complaints enable row level security;
alter table public.maintenance_categories enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_activity enable row level security;

create policy complaints_select on public.complaints for select
  using (resident_id in (select public.my_resident_ids())
         or public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy maintenance_categories_select on public.maintenance_categories for select
  using (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy maintenance_categories_write on public.maintenance_categories for insert
  with check (public.has_tenant_role(tenant_id, array['owner']));

create policy maintenance_select on public.maintenance_requests for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy maintenance_activity_select on public.maintenance_activity for select
  using (exists (select 1 from public.maintenance_requests m where m.id = maintenance_request_id));
