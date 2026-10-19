-- Migration 3: residents, admissions, bed assignments, documents, checkouts.

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  gender text check (gender in ('male','female','other')),
  date_of_birth date,
  occupation text,
  emergency_contact_name text,
  emergency_contact_phone text,
  id_number_last4 text check (id_number_last4 ~ '^[0-9A-Za-z]{0,4}$'),
  status text not null default 'pending' check (status in ('pending','active','checked_out','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create index residents_tenant_name on public.residents (tenant_id, full_name);
create index residents_tenant_phone on public.residents (tenant_id, phone);
create unique index residents_user_per_tenant on public.residents (tenant_id, user_id) where user_id is not null;
create trigger residents_touch before update on public.residents
  for each row execute function public.touch_updated_at();

create table public.admissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  resident_id uuid not null,
  building_id uuid not null,
  floor_id uuid not null,
  room_id uuid not null,
  bed_id uuid not null,
  admission_date date not null,
  expected_checkout_date date,
  monthly_rent numeric(12,2) not null check (monthly_rent >= 0),
  security_deposit numeric(12,2) not null default 0 check (security_deposit >= 0),
  setup_fee numeric(12,2) not null default 0 check (setup_fee >= 0),
  mess_included boolean not null default true,
  source text,
  status text not null default 'pending_review'
    check (status in ('draft','pending_review','approved','rejected','cancelled','completed')),
  review_notes text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id),
  foreign key (tenant_id, building_id, floor_id) references public.floors(tenant_id, building_id, id),
  foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id),
  foreign key (tenant_id, building_id, bed_id) references public.beds(tenant_id, building_id, id)
);
create index admissions_tenant_status on public.admissions (tenant_id, status, created_at desc);
create trigger admissions_touch before update on public.admissions
  for each row execute function public.touch_updated_at();

create table public.resident_room_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  resident_id uuid not null,
  admission_id uuid not null,
  building_id uuid not null,
  room_id uuid not null,
  bed_id uuid not null,
  start_at timestamptz not null default now(),
  end_at timestamptz,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id),
  foreign key (tenant_id, admission_id) references public.admissions(tenant_id, id),
  foreign key (tenant_id, building_id, bed_id) references public.beds(tenant_id, building_id, id),
  check (end_at is null or end_at >= start_at)
);
-- At most one active occupant per bed and one active bed per resident.
create unique index assignments_one_active_per_bed on public.resident_room_assignments (bed_id) where end_at is null;
create unique index assignments_one_active_per_resident on public.resident_room_assignments (resident_id) where end_at is null;
create index assignments_building on public.resident_room_assignments (building_id) where end_at is null;

create table public.resident_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  resident_id uuid not null,
  document_type text not null check (document_type in ('photo','id_proof','address_proof','guardian_id','other')),
  storage_path text not null,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id) on delete cascade
);

create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  resident_id uuid not null,
  admission_id uuid not null,
  checkout_date date not null,
  reason text,
  deposit_refund_amount numeric(12,2) not null default 0,
  outstanding_amount numeric(12,2) not null default 0,
  processed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id),
  foreign key (tenant_id, admission_id) references public.admissions(tenant_id, id)
);
create unique index checkouts_one_per_admission on public.checkouts (admission_id);

-- ---------------------------------------------------------------------------
-- Resident helpers
-- ---------------------------------------------------------------------------
create or replace function public.my_resident_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select r.id from public.residents r
  join public.tenants t on t.id = r.tenant_id and t.status = 'active'
  where r.user_id = auth.uid() and r.status = 'active';
$$;

-- Building of the resident's active assignment
create or replace function public.my_resident_building_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select a.building_id from public.resident_room_assignments a
  where a.end_at is null and a.resident_id in (select public.my_resident_ids());
$$;

-- A staff user may see a resident if the resident has (or had) an assignment / admission
-- in a building they can access.
create or replace function public.can_staff_view_resident(p_tenant uuid, p_resident uuid, p_roles text[] default array['owner','manager'])
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_tenant_role(p_tenant, array['owner']) and 'owner' = any(p_roles)
      or exists (
        select 1 from public.admissions a
        where a.tenant_id = p_tenant and a.resident_id = p_resident
          and public.can_access_building(p_tenant, a.building_id, p_roles)
      );
$$;

alter table public.residents enable row level security;
alter table public.admissions enable row level security;
alter table public.resident_room_assignments enable row level security;
alter table public.resident_documents enable row level security;
alter table public.checkouts enable row level security;

-- Chefs intentionally have no access to residents/admissions/KYC.
create policy residents_select on public.residents for select
  using (id in (select public.my_resident_ids()) or public.can_staff_view_resident(tenant_id, id));
create policy residents_staff_update on public.residents for update
  using (public.can_staff_view_resident(tenant_id, id))
  with check (public.can_staff_view_resident(tenant_id, id));

create policy admissions_select on public.admissions for select
  using (resident_id in (select public.my_resident_ids())
         or public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy assignments_select on public.resident_room_assignments for select
  using (resident_id in (select public.my_resident_ids())
         or public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy documents_select on public.resident_documents for select
  using (public.can_staff_view_resident(tenant_id, resident_id)
         or resident_id in (select public.my_resident_ids()));

create policy checkouts_select on public.checkouts for select
  using (public.can_staff_view_resident(tenant_id, resident_id));

-- Prevent direct edits to protected resident columns from the client.
create or replace function public.residents_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.tenant_id is distinct from old.tenant_id or new.user_id is distinct from old.user_id
      or new.status is distinct from old.status)
     and current_setting('app.trusted', true) is distinct from 'on' then
    raise exception 'FORBIDDEN: protected resident fields change only through workflows' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger residents_guard_trg before update on public.residents
  for each row execute function public.residents_guard();

-- Room capacity can only change through room_update_capacity()
create or replace function public.rooms_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.sharing_capacity is distinct from old.sharing_capacity or new.tenant_id is distinct from old.tenant_id
      or new.building_id is distinct from old.building_id or new.floor_id is distinct from old.floor_id)
     and current_setting('app.trusted', true) is distinct from 'on' then
    raise exception 'FORBIDDEN: room capacity/location change only through room_update_capacity' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger rooms_guard_trg before update on public.rooms
  for each row execute function public.rooms_guard();
