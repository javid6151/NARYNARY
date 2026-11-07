-- ========================================================
-- ZIPNARY COMPLETE DATABASE SCHEMA SETUP
-- Generated from 17 migration files
-- ========================================================



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000001_identity_tenancy.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 1: identity, tenancy, memberships, onboarding, audit, RLS helpers.
-- Rollback: drop the objects created here in reverse order (no production data yet).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- platform_admins (only provisioned server-side / via SQL)
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','disabled')),
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscription plans (platform-configured; referenced by tenants)
-- ---------------------------------------------------------------------------
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  included_residents integer not null check (included_residents > 0),
  max_managers integer not null check (max_managers >= 0),
  max_chefs integer not null check (max_chefs >= 0),
  trial_days integer not null default 90 check (trial_days >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscription_plans_one_default on public.subscription_plans (is_default) where is_default;
create trigger subscription_plans_touch before update on public.subscription_plans
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_user_id uuid not null references auth.users(id),
  phone text,
  email text,
  city text,
  status text not null default 'pending'
    check (status in ('pending','active','changes_requested','rejected','suspended','banned','closed')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tenants_owner_idx on public.tenants (owner_user_id);
create trigger tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- tenant_memberships: one row per (tenant, user)
-- invite_email is used for pending invitations before the user has signed up.
-- ---------------------------------------------------------------------------
create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invite_email text,
  display_name text,
  role text not null check (role in ('owner','manager','chef','resident')),
  status text not null default 'invited' check (status in ('invited','active','suspended','revoked')),
  invited_by uuid references auth.users(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or invite_email is not null)
);
create unique index tenant_memberships_tenant_user on public.tenant_memberships (tenant_id, user_id) where user_id is not null;
create unique index tenant_memberships_tenant_invite on public.tenant_memberships (tenant_id, lower(invite_email))
  where user_id is null and status = 'invited';
create unique index tenant_memberships_one_owner on public.tenant_memberships (tenant_id)
  where role = 'owner' and status = 'active';
create index tenant_memberships_user_idx on public.tenant_memberships (user_id, status);

-- ---------------------------------------------------------------------------
-- tenant_onboarding_requests
-- ---------------------------------------------------------------------------
create table public.tenant_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  status text not null default 'submitted'
    check (status in ('draft','submitted','under_review','changes_requested','approved','rejected')),
  contact_details jsonb not null default '{}'::jsonb,
  business_details jsonb not null default '{}'::jsonb,
  review_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onboarding_status_idx on public.tenant_onboarding_requests (status, created_at desc);
create trigger onboarding_touch before update on public.tenant_onboarding_requests
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','grace_period','read_only','suspended','cancelled','expired')),
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  resident_limit integer not null,
  manager_limit integer not null,
  chef_limit integer not null,
  price_override numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscriptions_one_per_tenant on public.subscriptions (tenant_id);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs (append-only; written by security-definer functions)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid,
  actor_type text not null check (actor_type in ('platform_admin','tenant_user','system')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_tenant_idx on public.audit_logs (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- idempotency keys for retried financial / admission / inventory operations
-- ---------------------------------------------------------------------------
create table public.idempotency_keys (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation text not null,
  key text not null,
  result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (tenant_id, operation, key)
);

-- ---------------------------------------------------------------------------
-- RLS helper functions. SECURITY DEFINER so they can read membership tables
-- without recursive policy evaluation. They only ever answer about auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.has_tenant_role(p_tenant uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tenant_memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
      and t.status = 'active'   -- suspended / pending tenants lose operational access
  );
$$;

-- Owner sees every building of their tenant. Managers and chefs only see
-- buildings explicitly assigned through building_memberships (created in migration 2).
create or replace function public.is_tenant_owner(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_tenant_role(p_tenant, array['owner']);
$$;

create or replace function public.write_audit(
  p_tenant uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_before jsonb default null, p_after jsonb default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (tenant_id, actor_user_id, actor_type, action, entity_type, entity_id, before_data, after_data)
  values (
    p_tenant, auth.uid(),
    case when public.is_platform_admin() then 'platform_admin' when auth.uid() is null then 'system' else 'tenant_user' end,
    p_action, p_entity_type, p_entity_id, p_before, p_after
  );
end $$;
revoke all on function public.write_audit(uuid, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;

-- Standard error raiser with stable application codes (surfaced to the client via SQLSTATE P0001 message prefix).
create or replace function public.app_error(p_code text, p_message text)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception '%: %', p_code, p_message using errcode = 'P0001';
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_onboarding_requests enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.idempotency_keys enable row level security;

-- profiles: self, or co-members of a tenant where the viewer is owner/manager
create policy profiles_self_select on public.profiles for select
  using (id = auth.uid() or public.is_platform_admin() or exists (
    select 1 from public.tenant_memberships m
    where m.user_id = profiles.id and public.has_tenant_role(m.tenant_id, array['owner','manager'])
  ));
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy platform_admins_self on public.platform_admins for select
  using (user_id = auth.uid());

create policy plans_read on public.subscription_plans for select
  using (auth.uid() is not null and (is_active or public.is_platform_admin()));

create policy tenants_select on public.tenants for select
  using (public.is_platform_admin() or owner_user_id = auth.uid() or exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenants.id and m.user_id = auth.uid() and m.status = 'active'
  ));

create policy memberships_select on public.tenant_memberships for select
  using (user_id = auth.uid() or public.is_platform_admin()
         or public.has_tenant_role(tenant_id, array['owner','manager']));

create policy onboarding_select on public.tenant_onboarding_requests for select
  using (submitted_by = auth.uid() or public.is_platform_admin());

create policy subscriptions_select on public.subscriptions for select
  using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['owner']));

create policy audit_select on public.audit_logs for select
  using (public.is_platform_admin() or (tenant_id is not null and public.is_tenant_owner(tenant_id)));

-- idempotency_keys: no direct client access (functions only)

-- Writes to tenants/memberships/onboarding/subscriptions/audit go through
-- security-definer functions; no insert/update/delete policies are granted.


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000002_property.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000003_residents_admissions.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000004_finance.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000005_complaints_maintenance.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000006_kitchen_inventory.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000007_staff_communication.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 7: staff roster & payroll, attendance, daily reports, notices, notifications, chat.

-- Operational staff (warden, cook, cleaning, security...). They may or may not have a login;
-- login-enabled staff link to a tenant_membership.
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  membership_id uuid references public.tenant_memberships(id) on delete set null,
  full_name text not null,
  role text not null check (role in ('warden','cook','kitchen_helper','cleaning','security','helper','driver','manager','other')),
  phone text,
  joining_date date,
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary >= 0),
  pay_day integer check (pay_day between 1 and 28),
  status text not null default 'active' check (status in ('active','on_leave','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id)
);
create trigger staff_members_touch before update on public.staff_members
  for each row execute function public.touch_updated_at();

create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  staff_member_id uuid not null,
  attendance_date date not null,
  status text not null check (status in ('present','absent','late','half_day','leave','off_day')),
  notes text,
  marked_by uuid not null references auth.users(id),
  marked_at timestamptz not null default now(),
  unique (staff_member_id, attendance_date),
  foreign key (tenant_id, staff_member_id) references public.staff_members(tenant_id, id)
);
create index staff_attendance_date on public.staff_attendance (building_id, attendance_date);

create table public.staff_daily_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  staff_member_id uuid not null,
  report_date date not null,
  work_summary text not null check (length(work_summary) <= 2000),
  recorded_by uuid not null references auth.users(id),
  status text not null default 'submitted' check (status in ('draft','submitted','reviewed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (staff_member_id, report_date),
  foreign key (tenant_id, staff_member_id) references public.staff_members(tenant_id, id)
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  building_id uuid,
  title text not null check (length(title) between 3 and 140),
  body text not null check (length(body) <= 4000),
  category text not null default 'announcement'
    check (category in ('announcement','important','event','food_menu','maintenance')),
  status text not null default 'published' check (status in ('draft','published','archived')),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notices_lookup on public.notices (tenant_id, building_id, status, published_at desc);

create table public.notice_reads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  notice_id uuid not null references public.notices(id) on delete cascade,
  resident_id uuid not null,
  read_at timestamptz not null default now(),
  unique (notice_id, resident_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);

-- Chat: building-wide, floor, room, staff groups and direct threads.
create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  kind text not null check (kind in ('building','floor','room','staff','custom')),
  name text not null,
  floor_id uuid,
  room_id uuid,
  residents_can_post boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id) on delete cascade
);
create unique index chat_channel_room on public.chat_channels (room_id) where kind = 'room';
create unique index chat_channel_floor on public.chat_channels (floor_id) where kind = 'floor';
create unique index chat_channel_building on public.chat_channels (building_id) where kind = 'building';

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  channel_id uuid not null,
  sender_user_id uuid not null references auth.users(id),
  sender_name text not null,
  sender_is_staff boolean not null default false,
  body text not null check (length(body) between 1 and 2000),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, channel_id) references public.chat_channels(tenant_id, id) on delete cascade
);
create index chat_messages_channel on public.chat_messages (channel_id, created_at desc);

-- Can the current user read a given chat channel?
create or replace function public.can_read_channel(p_channel uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_channels c
    where c.id = p_channel and (
      public.can_access_building(c.tenant_id, c.building_id, array['owner','manager'])
      or (c.kind <> 'staff' and exists (
        select 1 from public.resident_room_assignments a
        join public.rooms r on r.id = a.room_id
        where a.end_at is null and a.resident_id in (select public.my_resident_ids())
          and a.building_id = c.building_id
          and (c.kind in ('building','custom')
               or (c.kind = 'room' and c.room_id = a.room_id)
               or (c.kind = 'floor' and c.floor_id = r.floor_id))
      ))
      or (c.kind = 'staff' and public.can_access_building(c.tenant_id, c.building_id, array['chef']))
    )
  );
$$;

alter table public.staff_members enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.staff_daily_reports enable row level security;
alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;

-- Salary data is owner-only; managers see roster for their buildings via staff_roster view.
create policy staff_members_select on public.staff_members for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));
create policy staff_attendance_select on public.staff_attendance for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));
create policy staff_reports_select on public.staff_daily_reports for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy notices_select on public.notices for select
  using (public.has_tenant_role(tenant_id, array['owner','manager','chef'])
         and (building_id is null or public.can_access_building(tenant_id, building_id))
      or (status = 'published' and (expires_at is null or expires_at > now())
          and tenant_id in (select r.tenant_id from public.residents r where r.id in (select public.my_resident_ids()))
          and (building_id is null or building_id in (select public.my_resident_building_ids()))));

create policy notice_reads_select on public.notice_reads for select
  using (resident_id in (select public.my_resident_ids()) or public.has_tenant_role(tenant_id, array['owner','manager']));

create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chat_channels_select on public.chat_channels for select using (public.can_read_channel(id));
create policy chat_messages_select on public.chat_messages for select using (public.can_read_channel(channel_id));


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000008_workflows_core.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 8: trusted workflow functions — onboarding, platform approvals,
-- property setup, admissions, checkout, account provisioning.
-- All functions are SECURITY DEFINER with an empty search_path, derive tenant
-- and role from the authenticated user, and never trust client-supplied scope.

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function public._uid()
returns uuid language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED: sign in required' using errcode = 'P0001';
  end if;
  return auth.uid();
end $$;

create or replace function public._require_platform_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'FORBIDDEN: platform administrator access required' using errcode = 'P0001';
  end if;
end $$;

-- Resolve a building's tenant from the database and check the caller's role/scope.
create or replace function public._require_building(p_building uuid, p_roles text[])
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  perform public._uid();
  select tenant_id into v_tenant from public.buildings where id = p_building and status = 'active';
  if v_tenant is null or not public.can_access_building(v_tenant, p_building, p_roles) then
    raise exception 'NOT_FOUND: building not found or not accessible' using errcode = 'P0001';
  end if;
  return v_tenant;
end $$;

create or replace function public._tenant_today(p_tenant uuid)
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select timezone from public.tenants where id = p_tenant), 'Asia/Kolkata'))::date;
$$;

create or replace function public._trusted()
returns void language sql set search_path = '' as $$
  select set_config('app.trusted', 'on', true);
$$;

create or replace function public._idem_get(p_tenant uuid, p_op text, p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select result from public.idempotency_keys where tenant_id = p_tenant and operation = p_op and key = p_key;
$$;

create or replace function public._idem_put(p_tenant uuid, p_op text, p_key text, p_result jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.idempotency_keys (tenant_id, operation, key, result, created_by)
  values (p_tenant, p_op, p_key, p_result, auth.uid());
$$;

create or replace function public._notify(p_tenant uuid, p_user uuid, p_type text, p_title text, p_body text,
                                          p_entity_type text default null, p_entity uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (tenant_id, user_id, type, title, body, entity_type, entity_id)
  select p_tenant, p_user, p_type, p_title, p_body, p_entity_type, p_entity where p_user is not null;
$$;

create or replace function public._notify_building_residents(p_tenant uuid, p_building uuid, p_type text,
                                                             p_title text, p_body text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (tenant_id, user_id, type, title, body)
  select distinct p_tenant, r.user_id, p_type, p_title, p_body
  from public.resident_room_assignments a
  join public.residents r on r.id = a.resident_id
  where a.end_at is null and a.tenant_id = p_tenant
    and (p_building is null or a.building_id = p_building)
    and r.user_id is not null;
$$;

create or replace function public._notify_owners(p_tenant uuid, p_type text, p_title text, p_body text,
                                                 p_entity_type text default null, p_entity uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (tenant_id, user_id, type, title, body, entity_type, entity_id)
  select p_tenant, m.user_id, p_type, p_title, p_body, p_entity_type, p_entity
  from public.tenant_memberships m
  where m.tenant_id = p_tenant and m.role = 'owner' and m.status = 'active' and m.user_id is not null;
$$;

-- Lock down internal helpers
revoke all on function public._require_platform_admin() from public, anon, authenticated;
revoke all on function public._idem_get(uuid, text, text) from public, anon, authenticated;
revoke all on function public._idem_put(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public._notify(uuid, uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public._notify_building_residents(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public._notify_owners(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public._trusted() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Building provisioning (store/kitchen locations + building chat channel)
-- ---------------------------------------------------------------------------
create or replace function public._provision_building(p_tenant uuid, p_building uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.inventory_locations (tenant_id, building_id, name, kind)
  values (p_tenant, p_building, 'Main Store', 'store'), (p_tenant, p_building, 'Kitchen', 'kitchen')
  on conflict do nothing;
  insert into public.chat_channels (tenant_id, building_id, kind, name, residents_can_post)
  select p_tenant, p_building, 'building', b.name || ' — Everyone', true from public.buildings b where b.id = p_building
  on conflict do nothing;
  insert into public.chat_channels (tenant_id, building_id, kind, name, residents_can_post)
  select p_tenant, p_building, 'staff', b.name || ' — Staff', false from public.buildings b where b.id = p_building
    and not exists (select 1 from public.chat_channels c where c.building_id = p_building and c.kind = 'staff');
end $$;
revoke all on function public._provision_building(uuid, uuid) from public, anon, authenticated;

create or replace function public._provision_tenant_defaults(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.expense_categories (tenant_id, name, is_maintenance) values
    (p_tenant, 'Water Bill', true), (p_tenant, 'Electricity Bill', true), (p_tenant, 'Gas Connection', true),
    (p_tenant, 'Rent / Lease', false), (p_tenant, 'Cleaning', true), (p_tenant, 'Drainage', true),
    (p_tenant, 'Pest Control', true), (p_tenant, 'Internet / Wi-Fi', true), (p_tenant, 'Repair & Maintenance', true),
    (p_tenant, 'Groceries & Provisions', false), (p_tenant, 'Staff Salary', false), (p_tenant, 'Other', false)
  on conflict do nothing;
  insert into public.maintenance_categories (tenant_id, name) values
    (p_tenant, 'Plumbing'), (p_tenant, 'Electrical'), (p_tenant, 'Carpentry'), (p_tenant, 'Cleaning'),
    (p_tenant, 'Appliance'), (p_tenant, 'Internet / Wi-Fi'), (p_tenant, 'Painting'), (p_tenant, 'Other')
  on conflict do nothing;
  insert into public.meal_settings (tenant_id) values (p_tenant) on conflict do nothing;
end $$;
revoke all on function public._provision_tenant_defaults(uuid) from public, anon, authenticated;

-- Floor/room chat channels are created automatically.
create or replace function public._floor_channel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_channels (tenant_id, building_id, kind, name, floor_id)
  values (new.tenant_id, new.building_id, 'floor', coalesce(new.name, 'Floor ' || new.floor_number), new.id)
  on conflict do nothing;
  return new;
end $$;
create trigger floors_channel after insert on public.floors for each row execute function public._floor_channel();

create or replace function public._room_channel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_channels (tenant_id, building_id, kind, name, room_id)
  values (new.tenant_id, new.building_id, 'room', 'Room ' || new.room_number, new.id)
  on conflict do nothing;
  return new;
end $$;
create trigger rooms_channel after insert on public.rooms for each row execute function public._room_channel();

-- ---------------------------------------------------------------------------
-- Onboarding
-- p_buildings: [{ "name": "...", "address": "...", "city": "...", "floors": 5, "approx_beds": 60 }]
-- ---------------------------------------------------------------------------
create or replace function public.submit_onboarding(
  p_business_name text, p_phone text, p_city text, p_buildings jsonb, p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_tenant uuid;
  v_email text;
begin
  if coalesce(length(trim(p_business_name)), 0) < 2 then
    raise exception 'VALIDATION_ERROR: business name is required' using errcode = 'P0001';
  end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ]{10,15}$' then
    raise exception 'VALIDATION_ERROR: enter a valid phone number' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_buildings) <> 'array' or jsonb_array_length(p_buildings) = 0
     or jsonb_array_length(p_buildings) > 20 then
    raise exception 'VALIDATION_ERROR: add between 1 and 20 buildings' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_buildings) b where coalesce(length(trim(b->>'name')),0) < 2) then
    raise exception 'VALIDATION_ERROR: every building needs a name' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select id into v_tenant from public.tenants where owner_user_id = v_uid order by created_at desc limit 1;
  if v_tenant is not null then
    if (select status from public.tenants where id = v_tenant) not in ('pending','changes_requested') then
      raise exception 'CONFLICT: your business account has already been reviewed' using errcode = 'P0001';
    end if;
    update public.tenants set business_name = trim(p_business_name), phone = p_phone, city = p_city, status = 'pending'
      where id = v_tenant;
    update public.tenant_onboarding_requests
      set status = 'submitted', contact_details = jsonb_build_object('phone', p_phone, 'email', v_email, 'city', p_city),
          business_details = jsonb_build_object('business_name', trim(p_business_name), 'buildings', p_buildings, 'notes', p_notes)
      where tenant_id = v_tenant;
  else
    insert into public.tenants (business_name, owner_user_id, phone, email, city)
    values (trim(p_business_name), v_uid, p_phone, v_email, p_city) returning id into v_tenant;
    insert into public.tenant_memberships (tenant_id, user_id, role, status, joined_at)
    values (v_tenant, v_uid, 'owner', 'active', now());
    insert into public.tenant_onboarding_requests (tenant_id, submitted_by, status, contact_details, business_details)
    values (v_tenant, v_uid, 'submitted',
            jsonb_build_object('phone', p_phone, 'email', v_email, 'city', p_city),
            jsonb_build_object('business_name', trim(p_business_name), 'buildings', p_buildings, 'notes', p_notes));
  end if;
  update public.profiles set phone = coalesce(phone, p_phone) where id = v_uid;
  perform public.write_audit(v_tenant, 'onboarding.submitted', 'tenant', v_tenant);
  return v_tenant;
end $$;

create or replace function public.platform_review_onboarding(p_request uuid, p_decision text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
  b jsonb;
  v_building uuid;
  v_plan record;
begin
  perform public._require_platform_admin();
  if p_decision not in ('approve','reject','changes_requested') then
    raise exception 'VALIDATION_ERROR: invalid decision' using errcode = 'P0001';
  end if;
  select * into r from public.tenant_onboarding_requests where id = p_request for update;
  if r is null then raise exception 'NOT_FOUND: request not found' using errcode = 'P0001'; end if;
  if r.status = 'approved' and p_decision = 'approve' then return; end if;  -- idempotent
  if r.status not in ('submitted','under_review','changes_requested') then
    raise exception 'CONFLICT: request is already %', r.status using errcode = 'P0001';
  end if;

  perform public._trusted();
  if p_decision = 'approve' then
    update public.tenant_onboarding_requests
      set status = 'approved', review_notes = p_notes, reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_request;
    update public.tenants set status = 'active', approved_at = now(), approved_by = auth.uid() where id = r.tenant_id;
    perform public._provision_tenant_defaults(r.tenant_id);

    for b in select * from jsonb_array_elements(r.business_details->'buildings') loop
      insert into public.buildings (tenant_id, name, address, city, status, requested_details, approved_by, approved_at, created_by)
      values (r.tenant_id, trim(b->>'name'), b->>'address', b->>'city', 'active', b, auth.uid(), now(), r.submitted_by)
      on conflict (tenant_id, name) do nothing
      returning id into v_building;
      if v_building is not null then
        perform public._provision_building(r.tenant_id, v_building);
      end if;
    end loop;

    select * into v_plan from public.subscription_plans where is_default and is_active limit 1;
    if v_plan is null then
      raise exception 'CONFLICT: no default subscription plan configured' using errcode = 'P0001';
    end if;
    insert into public.subscriptions (tenant_id, plan_id, status, trial_start, trial_end,
                                      resident_limit, manager_limit, chef_limit)
    values (r.tenant_id, v_plan.id, 'trialing', now(), now() + make_interval(days => v_plan.trial_days),
            v_plan.included_residents, v_plan.max_managers, v_plan.max_chefs)
    on conflict (tenant_id) do nothing;

    perform public._notify(r.tenant_id, r.submitted_by, 'onboarding', 'Your PG account is approved',
                           'You can now set up floors, rooms and beds.');
  else
    update public.tenant_onboarding_requests
      set status = case when p_decision = 'reject' then 'rejected' else 'changes_requested' end,
          review_notes = p_notes, reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_request;
    update public.tenants set status = case when p_decision = 'reject' then 'rejected' else 'changes_requested' end
      where id = r.tenant_id;
    perform public._notify(r.tenant_id, r.submitted_by, 'onboarding',
      case when p_decision = 'reject' then 'Onboarding request rejected' else 'Changes requested on your onboarding' end,
      p_notes);
  end if;
  perform public.write_audit(r.tenant_id, 'onboarding.' || p_decision, 'tenant_onboarding_request', p_request,
                             null, jsonb_build_object('notes', p_notes));
end $$;

create or replace function public.request_building(p_name text, p_address text, p_city text, p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_id uuid;
begin
  perform public._uid();
  select m.tenant_id into v_tenant from public.tenant_memberships m
    join public.tenants t on t.id = m.tenant_id and t.status = 'active'
    where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active' limit 1;
  if v_tenant is null then raise exception 'FORBIDDEN: only an active owner can request buildings' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_name)),0) < 2 then raise exception 'VALIDATION_ERROR: building name is required' using errcode = 'P0001'; end if;
  insert into public.buildings (tenant_id, name, address, city, status, requested_details, created_by)
  values (v_tenant, trim(p_name), p_address, p_city, 'pending_approval', coalesce(p_details, '{}'::jsonb), auth.uid())
  returning id into v_id;
  perform public.write_audit(v_tenant, 'building.requested', 'building', v_id);
  return v_id;
exception when unique_violation then
  raise exception 'CONFLICT: a building with this name already exists' using errcode = 'P0001';
end $$;

-- Owners need to see their own pending building requests (buildings_select only covers active scope via memberships).
create policy buildings_owner_pending on public.buildings for select
  using (public.has_tenant_role(tenant_id, array['owner']));

create or replace function public.platform_review_building(p_building uuid, p_decision text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_b record;
begin
  perform public._require_platform_admin();
  select * into v_b from public.buildings where id = p_building for update;
  if v_b is null then raise exception 'NOT_FOUND: building not found' using errcode = 'P0001'; end if;
  if v_b.status <> 'pending_approval' then
    if v_b.status = 'active' and p_decision = 'approve' then return; end if;
    raise exception 'CONFLICT: building is %', v_b.status using errcode = 'P0001';
  end if;
  perform public._trusted();
  if p_decision = 'approve' then
    update public.buildings set status = 'active', approved_by = auth.uid(), approved_at = now(), review_notes = p_notes
      where id = p_building;
    perform public._provision_building(v_b.tenant_id, p_building);
  elsif p_decision = 'reject' then
    update public.buildings set status = 'rejected', review_notes = p_notes where id = p_building;
  else
    raise exception 'VALIDATION_ERROR: invalid decision' using errcode = 'P0001';
  end if;
  perform public._notify_owners(v_b.tenant_id, 'building', 'Building ' || v_b.name || ' ' || p_decision || 'd', p_notes);
  perform public.write_audit(v_b.tenant_id, 'building.' || p_decision, 'building', p_building);
end $$;

create or replace function public.platform_set_tenant_status(p_tenant uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform public._require_platform_admin();
  if p_status not in ('active','suspended','banned','closed') then
    raise exception 'VALIDATION_ERROR: invalid status' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_reason)),0) < 3 then
    raise exception 'VALIDATION_ERROR: a reason is required' using errcode = 'P0001';
  end if;
  select status into v_old from public.tenants where id = p_tenant for update;
  if v_old is null then raise exception 'NOT_FOUND: tenant not found' using errcode = 'P0001'; end if;
  if v_old in ('pending','changes_requested','rejected') then
    raise exception 'CONFLICT: use the onboarding review for unapproved tenants' using errcode = 'P0001';
  end if;
  update public.tenants set status = p_status where id = p_tenant;
  perform public.write_audit(p_tenant, 'tenant.status_changed', 'tenant', p_tenant,
    jsonb_build_object('status', v_old), jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

create or replace function public.platform_update_subscription(
  p_tenant uuid, p_status text, p_trial_end timestamptz, p_resident_limit integer,
  p_manager_limit integer, p_chef_limit integer, p_price_override numeric
) returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  perform public._require_platform_admin();
  select to_jsonb(s) into v_before from public.subscriptions s where tenant_id = p_tenant for update;
  if v_before is null then raise exception 'NOT_FOUND: subscription not found' using errcode = 'P0001'; end if;
  if p_resident_limit < 1 or p_manager_limit < 0 or p_chef_limit < 0 then
    raise exception 'VALIDATION_ERROR: limits must be positive' using errcode = 'P0001';
  end if;
  update public.subscriptions set status = p_status, trial_end = p_trial_end, resident_limit = p_resident_limit,
    manager_limit = p_manager_limit, chef_limit = p_chef_limit, price_override = p_price_override
    where tenant_id = p_tenant;
  perform public.write_audit(p_tenant, 'subscription.updated', 'subscription', (v_before->>'id')::uuid, v_before,
    jsonb_build_object('status', p_status, 'trial_end', p_trial_end, 'resident_limit', p_resident_limit,
                       'manager_limit', p_manager_limit, 'chef_limit', p_chef_limit, 'price_override', p_price_override));
end $$;

create or replace function public.platform_upsert_plan(
  p_id uuid, p_name text, p_monthly_price numeric, p_included_residents integer,
  p_max_managers integer, p_max_chefs integer, p_trial_days integer, p_is_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public._require_platform_admin();
  if p_id is null then
    insert into public.subscription_plans (name, monthly_price, included_residents, max_managers, max_chefs, trial_days, is_active)
    values (p_name, p_monthly_price, p_included_residents, p_max_managers, p_max_chefs, p_trial_days, p_is_active)
    returning id into v_id;
  else
    update public.subscription_plans set name = p_name, monthly_price = p_monthly_price,
      included_residents = p_included_residents, max_managers = p_max_managers, max_chefs = p_max_chefs,
      trial_days = p_trial_days, is_active = p_is_active
    where id = p_id returning id into v_id;
  end if;
  perform public.write_audit(null, 'plan.upserted', 'subscription_plan', v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Staff accounts (managers / chefs) — invitation by email, claimed on sign-in
-- ---------------------------------------------------------------------------
create or replace function public.invite_staff_account(p_email text, p_role text, p_name text, p_building_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid; v_limit integer; v_count integer; v_id uuid; v_b uuid;
begin
  perform public._uid();
  select m.tenant_id into v_tenant from public.tenant_memberships m
    join public.tenants t on t.id = m.tenant_id and t.status = 'active'
    where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active' limit 1;
  if v_tenant is null then raise exception 'FORBIDDEN: only the owner can invite staff' using errcode = 'P0001'; end if;
  if p_role not in ('manager','chef') then raise exception 'VALIDATION_ERROR: role must be manager or chef' using errcode = 'P0001'; end if;
  if p_email is null or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'VALIDATION_ERROR: enter a valid email' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_building_ids, 1), 0) = 0 then
    raise exception 'VALIDATION_ERROR: assign at least one building' using errcode = 'P0001';
  end if;

  -- Serialize limit checks per tenant
  perform pg_advisory_xact_lock(hashtext('staff-limit:' || v_tenant::text));
  select case when p_role = 'manager' then manager_limit else chef_limit end into v_limit
    from public.subscriptions where tenant_id = v_tenant;
  select count(*) into v_count from public.tenant_memberships
    where tenant_id = v_tenant and role = p_role and status in ('invited','active');
  if v_count >= coalesce(v_limit, 0) then
    raise exception 'BUSINESS_RULE_VIOLATION: your plan allows % %s', v_limit, p_role using errcode = 'P0001';
  end if;

  insert into public.tenant_memberships (tenant_id, invite_email, display_name, role, status, invited_by)
  values (v_tenant, lower(trim(p_email)), p_name, p_role, 'invited', auth.uid()) returning id into v_id;

  foreach v_b in array p_building_ids loop
    if not exists (select 1 from public.buildings where id = v_b and tenant_id = v_tenant and status = 'active') then
      raise exception 'NOT_FOUND: building not found' using errcode = 'P0001';
    end if;
    insert into public.building_memberships (tenant_id, building_id, membership_id) values (v_tenant, v_b, v_id);
  end loop;
  perform public.write_audit(v_tenant, 'membership.invited', 'tenant_membership', v_id, null,
                             jsonb_build_object('role', p_role, 'buildings', p_building_ids));
  return v_id;
exception when unique_violation then
  raise exception 'CONFLICT: this email already has a pending invitation' using errcode = 'P0001';
end $$;

create or replace function public.set_membership_status(p_membership uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m record;
begin
  select * into v_m from public.tenant_memberships where id = p_membership for update;
  if v_m is null or not public.has_tenant_role(v_m.tenant_id, array['owner']) then
    raise exception 'NOT_FOUND: membership not found' using errcode = 'P0001';
  end if;
  if v_m.role = 'owner' then raise exception 'FORBIDDEN: the owner membership cannot be changed here' using errcode = 'P0001'; end if;
  if p_status not in ('active','suspended','revoked') then raise exception 'VALIDATION_ERROR: invalid status' using errcode = 'P0001'; end if;
  if p_status = 'active' and v_m.user_id is null then
    raise exception 'CONFLICT: the invitation has not been accepted yet' using errcode = 'P0001';
  end if;
  update public.tenant_memberships set status = p_status where id = p_membership;
  perform public.write_audit(v_m.tenant_id, 'membership.' || p_status, 'tenant_membership', p_membership,
                             jsonb_build_object('status', v_m.status), jsonb_build_object('status', p_status));
end $$;

-- Called after sign-in: accept staff invitations and link approved resident records
-- whose email matches the caller's verified email.
create or replace function public.claim_pending_access()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_email text; v_confirmed timestamptz;
  v_staff integer := 0; v_res integer := 0;
  r record;
begin
  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = v_uid;
  if v_email is null or v_confirmed is null then
    return jsonb_build_object('staff', 0, 'residents', 0);
  end if;

  update public.tenant_memberships m set user_id = v_uid, status = 'active', joined_at = now()
    where m.user_id is null and m.status = 'invited' and lower(m.invite_email) = v_email
      and not exists (select 1 from public.tenant_memberships x where x.tenant_id = m.tenant_id and x.user_id = v_uid);
  get diagnostics v_staff = row_count;

  perform public._trusted();
  for r in
    select res.id, res.tenant_id from public.residents res
    where res.user_id is null and res.status = 'active' and lower(res.email) = v_email
      and not exists (select 1 from public.residents x where x.tenant_id = res.tenant_id and x.user_id = v_uid)
  loop
    update public.residents set user_id = v_uid where id = r.id;
    insert into public.tenant_memberships (tenant_id, user_id, role, status, joined_at)
    values (r.tenant_id, v_uid, 'resident', 'active', now())
    on conflict do nothing;
    v_res := v_res + 1;
    perform public.write_audit(r.tenant_id, 'resident.account_linked', 'resident', r.id);
  end loop;
  return jsonb_build_object('staff', v_staff, 'residents', v_res);
end $$;

-- What the signed-in user can do: drives portal routing in the client.
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'is_platform_admin', public.is_platform_admin(),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membership_id', m.id, 'tenant_id', m.tenant_id, 'role', m.role, 'status', m.status,
        'tenant_name', t.business_name, 'tenant_status', t.status, 'currency', t.currency, 'timezone', t.timezone,
        'building_ids', case when m.role = 'owner'
            then coalesce((select jsonb_agg(b.id) from public.buildings b where b.tenant_id = m.tenant_id and b.status = 'active'), '[]'::jsonb)
            else coalesce((select jsonb_agg(bm.building_id) from public.building_memberships bm where bm.membership_id = m.id), '[]'::jsonb) end
      ) order by m.created_at)
      from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id
      where m.user_id = auth.uid() and m.status = 'active'), '[]'::jsonb),
    'owned_tenant', (select jsonb_build_object('tenant_id', t.id, 'status', t.status, 'business_name', t.business_name)
                     from public.tenants t where t.owner_user_id = auth.uid() order by t.created_at desc limit 1)
  );
$$;

-- ---------------------------------------------------------------------------
-- Rooms and beds
-- ---------------------------------------------------------------------------
create or replace function public.create_floor(p_building uuid, p_floor_number integer, p_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := public._require_building(p_building, array['owner','manager']); v_id uuid;
begin
  if p_floor_number < 0 or p_floor_number > 100 then raise exception 'VALIDATION_ERROR: invalid floor number' using errcode = 'P0001'; end if;
  insert into public.floors (tenant_id, building_id, floor_number, name)
  values (v_tenant, p_building, p_floor_number, coalesce(nullif(trim(p_name), ''), 'Floor ' || p_floor_number))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'CONFLICT: floor % already exists', p_floor_number using errcode = 'P0001';
end $$;

create or replace function public.create_room_with_beds(
  p_floor uuid, p_room_number text, p_capacity integer, p_monthly_rent numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_f record; v_tenant uuid; v_room uuid; i integer;
begin
  select * into v_f from public.floors where id = p_floor;
  if v_f is null then raise exception 'NOT_FOUND: floor not found' using errcode = 'P0001'; end if;
  v_tenant := public._require_building(v_f.building_id, array['owner','manager']);
  if p_capacity < 1 or p_capacity > 12 then raise exception 'VALIDATION_ERROR: sharing must be 1–12 beds' using errcode = 'P0001'; end if;
  if p_monthly_rent < 0 then raise exception 'VALIDATION_ERROR: rent cannot be negative' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_room_number)),0) = 0 then raise exception 'VALIDATION_ERROR: room number is required' using errcode = 'P0001'; end if;

  insert into public.rooms (tenant_id, building_id, floor_id, room_number, sharing_capacity, base_monthly_rent)
  values (v_tenant, v_f.building_id, p_floor, trim(p_room_number), p_capacity, p_monthly_rent) returning id into v_room;
  for i in 1..p_capacity loop
    insert into public.beds (tenant_id, building_id, room_id, bed_label)
    values (v_tenant, v_f.building_id, v_room, trim(p_room_number) || '-B' || i);
  end loop;
  perform public.write_audit(v_tenant, 'room.created', 'room', v_room, null,
                             jsonb_build_object('capacity', p_capacity, 'rent', p_monthly_rent));
  return v_room;
exception when unique_violation then
  raise exception 'CONFLICT: room % already exists in this building', p_room_number using errcode = 'P0001';
end $$;

create or replace function public.room_update_capacity(p_room uuid, p_capacity integer, p_monthly_rent numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_r record; v_tenant uuid; v_active integer; v_occupied integer; b record; i integer;
begin
  select * into v_r from public.rooms where id = p_room for update;
  if v_r is null then raise exception 'NOT_FOUND: room not found' using errcode = 'P0001'; end if;
  v_tenant := public._require_building(v_r.building_id, array['owner','manager']);
  if p_capacity < 1 or p_capacity > 12 then raise exception 'VALIDATION_ERROR: sharing must be 1–12 beds' using errcode = 'P0001'; end if;

  select count(*) into v_occupied from public.resident_room_assignments a
    join public.beds bd on bd.id = a.bed_id where bd.room_id = p_room and a.end_at is null;
  if p_capacity < v_occupied then
    raise exception 'BUSINESS_RULE_VIOLATION: % beds are occupied; capacity cannot go below that', v_occupied using errcode = 'P0001';
  end if;

  perform public._trusted();
  select count(*) into v_active from public.beds where room_id = p_room and status = 'active';
  if p_capacity > v_active then
    -- reactivate inactive beds first, then add new ones
    for b in select id from public.beds where room_id = p_room and status <> 'active' order by bed_label limit (p_capacity - v_active) loop
      update public.beds set status = 'active' where id = b.id;
      v_active := v_active + 1;
    end loop;
    i := (select count(*) from public.beds where room_id = p_room);
    while v_active < p_capacity loop
      i := i + 1;
      insert into public.beds (tenant_id, building_id, room_id, bed_label)
      values (v_tenant, v_r.building_id, p_room, v_r.room_number || '-B' || i);
      v_active := v_active + 1;
    end loop;
  elsif p_capacity < v_active then
    -- deactivate vacant beds (never occupied ones), highest labels first
    for b in select bd.id from public.beds bd
             where bd.room_id = p_room and bd.status = 'active'
               and not exists (select 1 from public.resident_room_assignments a where a.bed_id = bd.id and a.end_at is null)
               and not exists (select 1 from public.admissions ad where ad.bed_id = bd.id and ad.status = 'pending_review')
             order by bd.bed_label desc limit (v_active - p_capacity) loop
      update public.beds set status = 'inactive' where id = b.id;
      v_active := v_active - 1;
    end loop;
    if v_active <> p_capacity then
      raise exception 'BUSINESS_RULE_VIOLATION: some vacant beds have pending admissions' using errcode = 'P0001';
    end if;
  end if;
  update public.rooms set sharing_capacity = p_capacity, base_monthly_rent = coalesce(p_monthly_rent, base_monthly_rent)
    where id = p_room;
  perform public.write_audit(v_tenant, 'room.capacity_changed', 'room', p_room,
    jsonb_build_object('capacity', v_r.sharing_capacity), jsonb_build_object('capacity', p_capacity));
end $$;

-- Live occupancy for one building: rooms with beds and current occupant names (staff only).
create or replace function public.building_layout(p_building uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid := public._require_building(p_building, array['owner','manager']);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'floor_id', f.id, 'floor_number', f.floor_number, 'floor_name', f.name,
      'rooms', coalesce((
        select jsonb_agg(jsonb_build_object(
          'room_id', r.id, 'room_number', r.room_number, 'capacity', r.sharing_capacity,
          'rent', r.base_monthly_rent, 'status', r.status,
          'beds', coalesce((
            select jsonb_agg(jsonb_build_object(
              'bed_id', bd.id, 'label', bd.bed_label, 'status', bd.status,
              'resident_id', res.id, 'resident_name', res.full_name, 'admission_id', a.admission_id,
              'pending_admission', exists (select 1 from public.admissions ad where ad.bed_id = bd.id and ad.status = 'pending_review')
            ) order by bd.bed_label)
            from public.beds bd
            left join public.resident_room_assignments a on a.bed_id = bd.id and a.end_at is null
            left join public.residents res on res.id = a.resident_id
            where bd.room_id = r.id and bd.status = 'active'), '[]'::jsonb)
        ) order by r.room_number)
        from public.rooms r where r.floor_id = f.id), '[]'::jsonb)
    ) order by f.floor_number)
    from public.floors f where f.building_id = p_building and f.tenant_id = v_tenant), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Admissions
-- p_resident: {full_name, phone, email, gender, date_of_birth, occupation,
--              emergency_contact_name, emergency_contact_phone, id_number_last4}
-- p_terms:    {admission_date, monthly_rent, security_deposit, setup_fee, mess_included, source}
-- ---------------------------------------------------------------------------
create or replace function public.create_admission(p_bed uuid, p_resident jsonb, p_terms jsonb, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_bed record; v_tenant uuid; v_room record; v_res uuid; v_adm uuid; v_prev jsonb;
  v_limit integer; v_count integer;
begin
  select * into v_bed from public.beds where id = p_bed and status = 'active';
  if v_bed is null then raise exception 'NOT_FOUND: bed not found' using errcode = 'P0001'; end if;
  v_tenant := public._require_building(v_bed.building_id, array['owner','manager']);

  v_prev := public._idem_get(v_tenant, 'create_admission', p_idempotency_key);
  if v_prev is not null then return (v_prev->>'admission_id')::uuid; end if;

  if coalesce(length(trim(p_resident->>'full_name')),0) < 2 then
    raise exception 'VALIDATION_ERROR: full name is required' using errcode = 'P0001'; end if;
  if coalesce(p_resident->>'phone','') !~ '^\+?[0-9 ]{10,15}$' then
    raise exception 'VALIDATION_ERROR: enter a valid mobile number' using errcode = 'P0001'; end if;
  if nullif(p_resident->>'email','') is not null and p_resident->>'email' !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'VALIDATION_ERROR: enter a valid email' using errcode = 'P0001'; end if;
  if (p_terms->>'admission_date') is null then
    raise exception 'VALIDATION_ERROR: admission date is required' using errcode = 'P0001'; end if;
  if coalesce((p_terms->>'monthly_rent')::numeric, -1) < 0 then
    raise exception 'VALIDATION_ERROR: monthly rent is required' using errcode = 'P0001'; end if;

  -- serialize per bed and per tenant (limit check)
  perform pg_advisory_xact_lock(hashtext('bed:' || p_bed::text));
  perform pg_advisory_xact_lock(hashtext('resident-limit:' || v_tenant::text));
  if exists (select 1 from public.resident_room_assignments where bed_id = p_bed and end_at is null) then
    raise exception 'CONFLICT: this bed is already occupied' using errcode = 'P0001'; end if;
  if exists (select 1 from public.admissions where bed_id = p_bed and status = 'pending_review') then
    raise exception 'CONFLICT: this bed already has a pending admission' using errcode = 'P0001'; end if;

  select resident_limit into v_limit from public.subscriptions where tenant_id = v_tenant;
  select count(*) into v_count from public.residents where tenant_id = v_tenant and status in ('pending','active');
  if v_limit is not null and v_count >= v_limit then
    raise exception 'BUSINESS_RULE_VIOLATION: resident limit of % reached for your plan', v_limit using errcode = 'P0001';
  end if;

  select * into v_room from public.rooms where id = v_bed.room_id;

  insert into public.residents (tenant_id, full_name, phone, email, gender, date_of_birth, occupation,
                                emergency_contact_name, emergency_contact_phone, id_number_last4, status)
  values (v_tenant, trim(p_resident->>'full_name'), trim(p_resident->>'phone'), nullif(lower(trim(p_resident->>'email')), ''),
          nullif(p_resident->>'gender',''), nullif(p_resident->>'date_of_birth','')::date, nullif(p_resident->>'occupation',''),
          nullif(p_resident->>'emergency_contact_name',''), nullif(p_resident->>'emergency_contact_phone',''),
          nullif(right(regexp_replace(coalesce(p_resident->>'id_number_last4',''), '\s', '', 'g'), 4), ''), 'pending')
  returning id into v_res;

  insert into public.admissions (tenant_id, resident_id, building_id, floor_id, room_id, bed_id, admission_date,
                                 monthly_rent, security_deposit, setup_fee, mess_included, source, status, created_by)
  values (v_tenant, v_res, v_bed.building_id, v_room.floor_id, v_room.id, p_bed, (p_terms->>'admission_date')::date,
          (p_terms->>'monthly_rent')::numeric, coalesce((p_terms->>'security_deposit')::numeric, 0),
          coalesce((p_terms->>'setup_fee')::numeric, 0), coalesce((p_terms->>'mess_included')::boolean, true),
          nullif(p_terms->>'source',''), 'pending_review', auth.uid())
  returning id into v_adm;

  perform public._idem_put(v_tenant, 'create_admission', p_idempotency_key, jsonb_build_object('admission_id', v_adm));
  perform public._notify_owners(v_tenant, 'admission', 'New admission awaiting approval',
                                trim(p_resident->>'full_name') || ' — bed ' || v_bed.bed_label, 'admission', v_adm);
  perform public.write_audit(v_tenant, 'admission.created', 'admission', v_adm);
  return v_adm;
end $$;

create or replace function public.review_admission(p_admission uuid, p_decision text, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_a record; v_period_end date; v_first_rent numeric(12,2);
begin
  select * into v_a from public.admissions where id = p_admission for update;
  if v_a is null or not public.can_access_building(v_a.tenant_id, v_a.building_id, array['owner']) then
    raise exception 'NOT_FOUND: admission not found' using errcode = 'P0001';
  end if;
  if v_a.status = 'approved' and p_decision = 'approve' then
    return jsonb_build_object('status', 'approved', 'already', true);  -- idempotent retry
  end if;
  if v_a.status <> 'pending_review' then
    raise exception 'CONFLICT: admission is already %', v_a.status using errcode = 'P0001';
  end if;
  perform public._trusted();

  if p_decision = 'reject' then
    update public.admissions set status = 'rejected', review_notes = p_notes, approved_by = auth.uid(), approved_at = now()
      where id = p_admission;
    update public.residents set status = 'blocked' where id = v_a.resident_id and status = 'pending';
    perform public.write_audit(v_a.tenant_id, 'admission.rejected', 'admission', p_admission, null, jsonb_build_object('notes', p_notes));
    return jsonb_build_object('status', 'rejected');
  elsif p_decision <> 'approve' then
    raise exception 'VALIDATION_ERROR: invalid decision' using errcode = 'P0001';
  end if;

  -- Lock the bed row, then verify it is still vacant. The partial unique index
  -- assignments_one_active_per_bed is the final guard against concurrent approvals.
  perform 1 from public.beds where id = v_a.bed_id and status = 'active' for update;
  if not found then raise exception 'CONFLICT: bed is no longer available' using errcode = 'P0001'; end if;
  if exists (select 1 from public.resident_room_assignments where bed_id = v_a.bed_id and end_at is null) then
    raise exception 'CONFLICT: bed has been allocated to another resident' using errcode = 'P0001';
  end if;

  insert into public.resident_room_assignments (tenant_id, resident_id, admission_id, building_id, room_id, bed_id, start_at, assigned_by)
  values (v_a.tenant_id, v_a.resident_id, v_a.id, v_a.building_id, v_a.room_id, v_a.bed_id,
          greatest(now(), v_a.admission_date::timestamptz), auth.uid());

  update public.admissions set status = 'approved', review_notes = p_notes, approved_by = auth.uid(), approved_at = now()
    where id = p_admission;
  update public.residents set status = 'active' where id = v_a.resident_id;

  -- Billing is by calendar month. The first charge covers the rest of the admission month (pro-rated);
  -- later months are created by generate_monthly_charges().
  v_period_end := (date_trunc('month', v_a.admission_date) + interval '1 month - 1 day')::date;
  v_first_rent := round(v_a.monthly_rent * ((v_period_end - v_a.admission_date) + 1)
                        / extract(day from v_period_end)::numeric, 0);
  if v_first_rent > 0 then
    insert into public.rent_charges (tenant_id, resident_id, admission_id, building_id, charge_type, description,
                                     period_start, period_end, due_date, amount, created_by)
    values (v_a.tenant_id, v_a.resident_id, v_a.id, v_a.building_id, 'rent',
            'Rent ' || to_char(v_a.admission_date, 'DD Mon') || ' – ' || to_char(v_period_end, 'DD Mon YYYY')
              || case when v_a.admission_date <> date_trunc('month', v_a.admission_date)::date then ' (pro-rated)' else '' end,
            v_a.admission_date, v_period_end, v_a.admission_date, v_first_rent, auth.uid());
  end if;
  if v_a.security_deposit > 0 then
    insert into public.rent_charges (tenant_id, resident_id, admission_id, building_id, charge_type, description, due_date, amount, created_by)
    values (v_a.tenant_id, v_a.resident_id, v_a.id, v_a.building_id, 'deposit', 'Security deposit (refundable)',
            v_a.admission_date, v_a.security_deposit, auth.uid());
  end if;
  if v_a.setup_fee > 0 then
    insert into public.rent_charges (tenant_id, resident_id, admission_id, building_id, charge_type, description, due_date, amount, created_by)
    values (v_a.tenant_id, v_a.resident_id, v_a.id, v_a.building_id, 'setup_fee', 'One-time setup fee',
            v_a.admission_date, v_a.setup_fee, auth.uid());
  end if;

  perform public.write_audit(v_a.tenant_id, 'admission.approved', 'admission', p_admission);
  return jsonb_build_object('status', 'approved');
exception when unique_violation then
  raise exception 'CONFLICT: bed or resident already has an active assignment' using errcode = 'P0001';
end $$;

create or replace function public.checkout_resident(p_admission uuid, p_checkout_date date, p_reason text, p_deposit_refund numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_a record; v_outstanding numeric(12,2); v_deposit_paid numeric(12,2);
begin
  select * into v_a from public.admissions where id = p_admission for update;
  if v_a is null or not public.can_access_building(v_a.tenant_id, v_a.building_id, array['owner','manager']) then
    raise exception 'NOT_FOUND: admission not found' using errcode = 'P0001';
  end if;
  if v_a.status = 'completed' then
    raise exception 'CONFLICT: resident already checked out' using errcode = 'P0001'; end if;
  if v_a.status <> 'approved' then
    raise exception 'CONFLICT: only approved admissions can be checked out' using errcode = 'P0001'; end if;
  if p_checkout_date is null or p_checkout_date < v_a.admission_date then
    raise exception 'VALIDATION_ERROR: checkout date must be on or after admission date' using errcode = 'P0001'; end if;

  select coalesce(sum(balance), 0) into v_outstanding from public.rent_charge_balances
    where admission_id = p_admission and status not in ('waived','cancelled') and charge_type <> 'deposit';
  select coalesce(sum(paid_amount), 0) into v_deposit_paid from public.rent_charge_balances
    where admission_id = p_admission and charge_type = 'deposit';
  if coalesce(p_deposit_refund, 0) < 0 or coalesce(p_deposit_refund, 0) > v_deposit_paid then
    raise exception 'VALIDATION_ERROR: refund cannot exceed deposit paid (%)', v_deposit_paid using errcode = 'P0001';
  end if;

  perform public._trusted();
  update public.resident_room_assignments set end_at = greatest(p_checkout_date::timestamptz, start_at)
    where admission_id = p_admission and end_at is null;
  update public.admissions set status = 'completed', expected_checkout_date = p_checkout_date where id = p_admission;
  update public.residents set status = 'checked_out' where id = v_a.resident_id;
  update public.tenant_memberships m set status = 'revoked'
    from public.residents r where r.id = v_a.resident_id and m.user_id = r.user_id
      and m.tenant_id = v_a.tenant_id and m.role = 'resident';
  insert into public.checkouts (tenant_id, resident_id, admission_id, checkout_date, reason, deposit_refund_amount,
                                outstanding_amount, processed_by)
  values (v_a.tenant_id, v_a.resident_id, p_admission, p_checkout_date, p_reason, coalesce(p_deposit_refund, 0),
          v_outstanding, auth.uid());
  perform public.write_audit(v_a.tenant_id, 'resident.checked_out', 'admission', p_admission, null,
    jsonb_build_object('outstanding', v_outstanding, 'refund', p_deposit_refund));
  return jsonb_build_object('outstanding', v_outstanding, 'deposit_paid', v_deposit_paid);
end $$;

-- Directory of residents with their current bed (owner/manager scope via RLS on base tables).
create view public.resident_directory with (security_invoker = true) as
select r.id, r.tenant_id, r.full_name, r.phone, r.email, r.status, r.user_id is not null as has_login, r.created_at,
       a.building_id, a.room_id, a.bed_id, a.admission_id, a.start_at,
       b.name as building_name, rm.room_number, rm.floor_id, bd.bed_label, rm.sharing_capacity,
       ad.monthly_rent, ad.admission_date,
       coalesce((select sum(cb.balance) from public.rent_charge_balances cb
                 where cb.resident_id = r.id and cb.status not in ('waived','cancelled')), 0)::numeric(12,2) as outstanding
from public.residents r
left join public.resident_room_assignments a on a.resident_id = r.id and a.end_at is null
left join public.buildings b on b.id = a.building_id
left join public.rooms rm on rm.id = a.room_id
left join public.beds bd on bd.id = a.bed_id
left join public.admissions ad on ad.id = a.admission_id;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000009_workflows_operations.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 9: trusted workflow functions — payments, expenses, complaints,
-- maintenance, meals, inventory, staff, notices, chat and dashboards.

-- ---------------------------------------------------------------------------
-- Rent charges & payments
-- ---------------------------------------------------------------------------
create or replace function public._refresh_charge_status(p_charge uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_amount numeric; v_paid numeric; v_status text;
begin
  select amount, status into v_amount, v_status from public.rent_charges where id = p_charge;
  if v_status in ('waived','cancelled') then return; end if;
  select coalesce(sum(pa.allocated_amount), 0) into v_paid
    from public.payment_allocations pa
    join public.payment_transactions p on p.id = pa.payment_transaction_id and p.status = 'confirmed'
    where pa.rent_charge_id = p_charge;
  update public.rent_charges set status = case when v_paid >= v_amount then 'paid'
                                               when v_paid > 0 then 'partially_paid' else 'unpaid' end
    where id = p_charge;
end $$;
revoke all on function public._refresh_charge_status(uuid) from public, anon, authenticated;

-- Generate monthly rent for every active resident of a building for the month containing p_month.
-- Idempotent through rent_charges_one_rent_per_period.
create or replace function public.generate_monthly_charges(p_building uuid, p_month date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public._require_building(p_building, array['owner','manager']);
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_count integer;
begin
  insert into public.rent_charges (tenant_id, resident_id, admission_id, building_id, charge_type, description,
                                   period_start, period_end, due_date, amount, created_by)
  select v_tenant, a.resident_id, a.admission_id, a.building_id, 'rent', 'Rent ' || to_char(v_start, 'Mon YYYY'),
         v_start, v_end, v_start + 4, ad.monthly_rent, auth.uid()
  from public.resident_room_assignments a
  join public.admissions ad on ad.id = a.admission_id
  where a.building_id = p_building and a.end_at is null and ad.monthly_rent > 0
    and ad.admission_date < v_start   -- first month was billed on approval
    and not exists (select 1 from public.rent_charges c
                    where c.admission_id = a.admission_id and c.charge_type = 'rent' and c.status <> 'cancelled'
                      and c.period_start <= v_end and c.period_end >= v_start)
  on conflict do nothing;
  get diagnostics v_count = row_count;
  perform public.write_audit(v_tenant, 'charges.generated', 'building', p_building, null,
                             jsonb_build_object('month', v_start, 'count', v_count));
  return v_count;
end $$;

create or replace function public.add_charge(p_resident uuid, p_type text, p_description text, p_amount numeric, p_due date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_a record; v_id uuid;
begin
  select a.* into v_a from public.resident_room_assignments a where a.resident_id = p_resident and a.end_at is null;
  if v_a is null or not public.can_access_building(v_a.tenant_id, v_a.building_id, array['owner','manager']) then
    raise exception 'NOT_FOUND: active resident not found' using errcode = 'P0001'; end if;
  if p_type not in ('utility','meal','late_fee','other') then raise exception 'VALIDATION_ERROR: invalid charge type' using errcode = 'P0001'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'VALIDATION_ERROR: amount must be greater than zero' using errcode = 'P0001'; end if;
  insert into public.rent_charges (tenant_id, resident_id, admission_id, building_id, charge_type, description, due_date, amount, created_by)
  values (v_a.tenant_id, p_resident, v_a.admission_id, v_a.building_id, p_type, p_description, coalesce(p_due, current_date), p_amount, auth.uid())
  returning id into v_id;
  perform public.write_audit(v_a.tenant_id, 'charge.created', 'rent_charge', v_id);
  return v_id;
end $$;

-- p_allocations: [{rent_charge_id, amount}] or null to auto-allocate oldest dues first.
create or replace function public.record_payment(
  p_resident uuid, p_amount numeric, p_method text, p_reference text, p_paid_at timestamptz,
  p_allocations jsonb, p_idempotency_key text, p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_res record; v_building uuid; v_prev jsonb; v_payment uuid; v_remaining numeric(12,2);
  v_alloc jsonb; v_charge record; v_take numeric(12,2); v_total numeric(12,2) := 0;
  v_receipt text; v_num integer; v_result jsonb;
begin
  select * into v_res from public.residents where id = p_resident;
  if v_res is null then raise exception 'NOT_FOUND: resident not found' using errcode = 'P0001'; end if;
  select building_id into v_building from public.admissions where resident_id = p_resident
    and status in ('approved','completed') order by created_at desc limit 1;
  if v_building is null or not public.can_access_building(v_res.tenant_id, v_building, array['owner','manager']) then
    raise exception 'NOT_FOUND: resident not found' using errcode = 'P0001'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'VALIDATION_ERROR: idempotency key required' using errcode = 'P0001'; end if;

  perform pg_advisory_xact_lock(hashtext('payment:' || v_res.tenant_id::text || ':' || p_idempotency_key));
  v_prev := public._idem_get(v_res.tenant_id, 'record_payment', p_idempotency_key);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;

  if coalesce(p_amount, 0) <= 0 then raise exception 'VALIDATION_ERROR: amount must be greater than zero' using errcode = 'P0001'; end if;
  if p_method not in ('cash','upi','bank_transfer','card','other') then
    raise exception 'VALIDATION_ERROR: invalid payment method' using errcode = 'P0001'; end if;
  if p_paid_at is null or p_paid_at > now() + interval '1 day' then
    raise exception 'VALIDATION_ERROR: payment date cannot be in the future' using errcode = 'P0001'; end if;

  insert into public.payment_transactions (tenant_id, resident_id, building_id, amount, payment_method,
                                           transaction_reference, paid_at, recorded_by, status, notes)
  values (v_res.tenant_id, p_resident, v_building, p_amount, p_method, nullif(trim(p_reference), ''), p_paid_at,
          auth.uid(), 'confirmed', p_notes)
  returning id into v_payment;

  v_remaining := p_amount;
  if p_allocations is not null and jsonb_array_length(p_allocations) > 0 then
    for v_alloc in select * from jsonb_array_elements(p_allocations) loop
      select cb.* into v_charge from public.rent_charge_balances cb
        where cb.id = (v_alloc->>'rent_charge_id')::uuid and cb.resident_id = p_resident
          and cb.status not in ('waived','cancelled');
      if v_charge is null then raise exception 'NOT_FOUND: charge not found for this resident' using errcode = 'P0001'; end if;
      perform 1 from public.rent_charges where id = v_charge.id for update;
      v_take := (v_alloc->>'amount')::numeric;
      if v_take <= 0 or v_take > v_charge.balance then
        raise exception 'VALIDATION_ERROR: allocation exceeds the charge balance' using errcode = 'P0001'; end if;
      v_total := v_total + v_take;
      if v_total > p_amount then
        raise exception 'VALIDATION_ERROR: allocations exceed the payment amount' using errcode = 'P0001'; end if;
      insert into public.payment_allocations (tenant_id, payment_transaction_id, rent_charge_id, allocated_amount)
      values (v_res.tenant_id, v_payment, v_charge.id, v_take);
      perform public._refresh_charge_status(v_charge.id);
    end loop;
  else
    for v_charge in select cb.* from public.rent_charge_balances cb
                    where cb.resident_id = p_resident and cb.status in ('unpaid','partially_paid') and cb.balance > 0
                    order by cb.due_date, cb.created_at loop
      exit when v_remaining <= 0;
      perform 1 from public.rent_charges where id = v_charge.id for update;
      v_take := least(v_remaining, v_charge.balance);
      insert into public.payment_allocations (tenant_id, payment_transaction_id, rent_charge_id, allocated_amount)
      values (v_res.tenant_id, v_payment, v_charge.id, v_take);
      perform public._refresh_charge_status(v_charge.id);
      v_remaining := v_remaining - v_take;
      v_total := v_total + v_take;
    end loop;
  end if;

  insert into public.receipt_counters (tenant_id, last_number) values (v_res.tenant_id, 1)
  on conflict (tenant_id) do update set last_number = public.receipt_counters.last_number + 1
  returning last_number into v_num;
  v_receipt := 'RCPT-' || to_char(now(), 'YYYY') || '-' || lpad(v_num::text, 5, '0');
  insert into public.receipts (tenant_id, payment_transaction_id, receipt_number, issued_by)
  values (v_res.tenant_id, v_payment, v_receipt, auth.uid());

  v_result := jsonb_build_object('payment_id', v_payment, 'receipt_number', v_receipt,
                                 'allocated', v_total, 'unallocated', p_amount - v_total);
  perform public._idem_put(v_res.tenant_id, 'record_payment', p_idempotency_key, v_result);
  perform public._notify(v_res.tenant_id, v_res.user_id, 'payment', 'Payment received',
    '₹' || to_char(p_amount, 'FM99,99,99,990.00') || ' recorded. Receipt ' || v_receipt, 'payment', v_payment);
  perform public.write_audit(v_res.tenant_id, 'payment.recorded', 'payment_transaction', v_payment, null, v_result);
  return v_result;
end $$;

create or replace function public.reverse_payment(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_p record; c record;
begin
  select * into v_p from public.payment_transactions where id = p_payment for update;
  if v_p is null or not public.has_tenant_role(v_p.tenant_id, array['owner']) then
    raise exception 'NOT_FOUND: payment not found' using errcode = 'P0001'; end if;
  if v_p.status = 'reversed' then return; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'VALIDATION_ERROR: a reason is required' using errcode = 'P0001'; end if;
  update public.payment_transactions set status = 'reversed', reversal_reason = p_reason,
    reversed_by = auth.uid(), reversed_at = now() where id = p_payment;
  for c in select distinct rent_charge_id from public.payment_allocations where payment_transaction_id = p_payment loop
    perform public._refresh_charge_status(c.rent_charge_id);
  end loop;
  perform public.write_audit(v_p.tenant_id, 'payment.reversed', 'payment_transaction', p_payment,
                             jsonb_build_object('status', v_p.status), jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.waive_charge(p_charge uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_c record;
begin
  select * into v_c from public.rent_charge_balances where id = p_charge;
  if v_c is null or not public.has_tenant_role(v_c.tenant_id, array['owner']) then
    raise exception 'NOT_FOUND: charge not found' using errcode = 'P0001'; end if;
  if v_c.paid_amount > 0 then raise exception 'CONFLICT: reverse payments before waiving a charge' using errcode = 'P0001'; end if;
  update public.rent_charges set status = 'waived', description = coalesce(description, '') || ' (waived: ' || p_reason || ')'
    where id = p_charge;
  perform public.write_audit(v_c.tenant_id, 'charge.waived', 'rent_charge', p_charge, null, jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- Expenses (canonical ledger shared by Expenses, Maintenance, Salaries, Inventory)
-- p_initial_payment: {amount, method, reference, paid_at} or null
-- ---------------------------------------------------------------------------
create or replace function public.create_expense(
  p_building uuid, p_category uuid, p_title text, p_description text, p_expense_date date, p_due_date date,
  p_subtotal numeric, p_tax numeric, p_vendor uuid, p_source_type text, p_source_id uuid,
  p_initial_payment jsonb, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public._require_building(p_building, array['owner','manager']);
  v_prev jsonb; v_id uuid; v_total numeric(12,2);
begin
  v_prev := public._idem_get(v_tenant, 'create_expense', p_idempotency_key);
  if v_prev is not null then return (v_prev->>'expense_id')::uuid; end if;
  if not exists (select 1 from public.expense_categories where id = p_category and tenant_id = v_tenant) then
    raise exception 'NOT_FOUND: category not found' using errcode = 'P0001'; end if;
  if p_vendor is not null and not exists (select 1 from public.vendors where id = p_vendor and tenant_id = v_tenant) then
    raise exception 'NOT_FOUND: vendor not found' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_title)), 0) < 2 then raise exception 'VALIDATION_ERROR: title is required' using errcode = 'P0001'; end if;
  if coalesce(p_subtotal, 0) <= 0 then raise exception 'VALIDATION_ERROR: amount must be greater than zero' using errcode = 'P0001'; end if;
  if coalesce(p_tax, 0) < 0 then raise exception 'VALIDATION_ERROR: tax cannot be negative' using errcode = 'P0001'; end if;
  if p_source_type not in ('general','maintenance','inventory','salary','utility','other') then
    raise exception 'VALIDATION_ERROR: invalid source type' using errcode = 'P0001'; end if;
  if p_source_type = 'maintenance' and p_source_id is not null and not exists (
       select 1 from public.maintenance_requests where id = p_source_id and tenant_id = v_tenant and building_id = p_building) then
    raise exception 'NOT_FOUND: maintenance request not found in this building' using errcode = 'P0001'; end if;
  v_total := p_subtotal + coalesce(p_tax, 0);

  insert into public.expenses (tenant_id, building_id, category_id, source_type, source_id, vendor_id, title, description,
                               expense_date, due_date, subtotal, tax_amount, total_amount, status, created_by, approved_by)
  values (v_tenant, p_building, p_category, p_source_type, p_source_id, p_vendor, trim(p_title), p_description,
          coalesce(p_expense_date, public._tenant_today(v_tenant)), p_due_date, p_subtotal, coalesce(p_tax, 0), v_total,
          'approved', auth.uid(), auth.uid())
  returning id into v_id;

  if p_initial_payment is not null and coalesce((p_initial_payment->>'amount')::numeric, 0) > 0 then
    if (p_initial_payment->>'amount')::numeric > v_total then
      raise exception 'VALIDATION_ERROR: payment cannot exceed the expense total' using errcode = 'P0001'; end if;
    if coalesce(p_initial_payment->>'method', '') not in ('cash','upi','bank_transfer','card','cheque','other') then
      raise exception 'VALIDATION_ERROR: payment method is required' using errcode = 'P0001'; end if;
    insert into public.expense_payments (tenant_id, expense_id, amount, paid_at, payment_method, transaction_reference, recorded_by)
    values (v_tenant, v_id, (p_initial_payment->>'amount')::numeric,
            coalesce((p_initial_payment->>'paid_at')::timestamptz, now()), p_initial_payment->>'method',
            nullif(p_initial_payment->>'reference', ''), auth.uid());
  end if;

  perform public._idem_put(v_tenant, 'create_expense', p_idempotency_key, jsonb_build_object('expense_id', v_id));
  perform public.write_audit(v_tenant, 'expense.created', 'expense', v_id, null, jsonb_build_object('total', v_total));
  return v_id;
end $$;

create or replace function public.record_expense_payment(
  p_expense uuid, p_amount numeric, p_method text, p_reference text, p_paid_at timestamptz,
  p_notes text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_e record; v_out numeric; v_prev jsonb; v_id uuid;
begin
  select * into v_e from public.expenses where id = p_expense for update;
  if v_e is null or not public.can_access_building(v_e.tenant_id, v_e.building_id, array['owner','manager']) then
    raise exception 'NOT_FOUND: expense not found' using errcode = 'P0001'; end if;
  v_prev := public._idem_get(v_e.tenant_id, 'record_expense_payment', p_idempotency_key);
  if v_prev is not null then return (v_prev->>'id')::uuid; end if;
  if v_e.status in ('cancelled','rejected') then raise exception 'CONFLICT: expense is %', v_e.status using errcode = 'P0001'; end if;
  select outstanding_amount into v_out from public.expense_balances where id = p_expense;
  if coalesce(p_amount, 0) <= 0 then raise exception 'VALIDATION_ERROR: amount must be greater than zero' using errcode = 'P0001'; end if;
  if p_amount > v_out then raise exception 'VALIDATION_ERROR: amount exceeds outstanding balance (%)', v_out using errcode = 'P0001'; end if;
  if p_method not in ('cash','upi','bank_transfer','card','cheque','other') then
    raise exception 'VALIDATION_ERROR: invalid payment method' using errcode = 'P0001'; end if;
  insert into public.expense_payments (tenant_id, expense_id, amount, paid_at, payment_method, transaction_reference, notes, recorded_by)
  values (v_e.tenant_id, p_expense, p_amount, coalesce(p_paid_at, now()), p_method, nullif(trim(p_reference), ''), p_notes, auth.uid())
  returning id into v_id;
  perform public._idem_put(v_e.tenant_id, 'record_expense_payment', p_idempotency_key, jsonb_build_object('id', v_id));
  perform public.write_audit(v_e.tenant_id, 'expense_payment.recorded', 'expense', p_expense, null, jsonb_build_object('amount', p_amount));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Staff roster, salary, attendance, daily reports
-- ---------------------------------------------------------------------------
create or replace function public.upsert_staff_member(
  p_id uuid, p_building uuid, p_full_name text, p_role text, p_phone text, p_joining_date date,
  p_monthly_salary numeric, p_pay_day integer, p_status text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := public._require_building(p_building, array['owner','manager']); v_id uuid;
begin
  if coalesce(length(trim(p_full_name)), 0) < 2 then raise exception 'VALIDATION_ERROR: name is required' using errcode = 'P0001'; end if;
  if coalesce(p_monthly_salary, 0) < 0 then raise exception 'VALIDATION_ERROR: salary cannot be negative' using errcode = 'P0001'; end if;
  if p_id is null then
    insert into public.staff_members (tenant_id, building_id, full_name, role, phone, joining_date, monthly_salary, pay_day, status)
    values (v_tenant, p_building, trim(p_full_name), p_role, p_phone, p_joining_date, coalesce(p_monthly_salary, 0), p_pay_day,
            coalesce(p_status, 'active'))
    returning id into v_id;
  else
    update public.staff_members set building_id = p_building, full_name = trim(p_full_name), role = p_role, phone = p_phone,
      joining_date = p_joining_date, monthly_salary = coalesce(p_monthly_salary, 0), pay_day = p_pay_day,
      status = coalesce(p_status, status)
    where id = p_id and tenant_id = v_tenant and public.can_access_building(tenant_id, building_id, array['owner','manager'])
    returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND: staff member not found' using errcode = 'P0001'; end if;
  end if;
  perform public.write_audit(v_tenant, 'staff.saved', 'staff_member', v_id);
  return v_id;
end $$;

create or replace function public.pay_staff_salary(
  p_staff uuid, p_month date, p_amount numeric, p_method text, p_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_s record; v_cat uuid; v_key text; v_id uuid;
begin
  select * into v_s from public.staff_members where id = p_staff;
  if v_s is null or not public.can_access_building(v_s.tenant_id, v_s.building_id, array['owner']) then
    raise exception 'NOT_FOUND: staff member not found' using errcode = 'P0001'; end if;
  select id into v_cat from public.expense_categories where tenant_id = v_s.tenant_id and name = 'Staff Salary';
  if v_cat is null then
    insert into public.expense_categories (tenant_id, name) values (v_s.tenant_id, 'Staff Salary') returning id into v_cat;
  end if;
  v_key := 'salary:' || p_staff::text || ':' || to_char(p_month, 'YYYY-MM');
  if exists (select 1 from public.idempotency_keys where tenant_id = v_s.tenant_id and operation = 'create_expense' and key = v_key) then
    raise exception 'CONFLICT: salary for % has already been recorded', to_char(p_month, 'Mon YYYY') using errcode = 'P0001';
  end if;
  v_id := public.create_expense(v_s.building_id, v_cat, 'Salary — ' || v_s.full_name || ' — ' || to_char(p_month, 'Mon YYYY'),
            'Salary month ' || to_char(p_month, 'YYYY-MM'), public._tenant_today(v_s.tenant_id), null, p_amount, 0, null, 'salary', p_staff,
            jsonb_build_object('amount', p_amount, 'method', p_method, 'reference', p_reference), v_key);
  return v_id;
end $$;

create or replace function public.mark_staff_attendance(p_building uuid, p_date date, p_entries jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := public._require_building(p_building, array['owner','manager']); e jsonb; v_n integer := 0; v_old text;
begin
  if p_date > public._tenant_today(v_tenant) then
    raise exception 'VALIDATION_ERROR: attendance cannot be marked for a future date' using errcode = 'P0001'; end if;
  for e in select * from jsonb_array_elements(p_entries) loop
    if not exists (select 1 from public.staff_members where id = (e->>'staff_member_id')::uuid and building_id = p_building) then
      raise exception 'NOT_FOUND: staff member not in this building' using errcode = 'P0001'; end if;
    select status into v_old from public.staff_attendance
      where staff_member_id = (e->>'staff_member_id')::uuid and attendance_date = p_date;
    insert into public.staff_attendance (tenant_id, building_id, staff_member_id, attendance_date, status, notes, marked_by)
    values (v_tenant, p_building, (e->>'staff_member_id')::uuid, p_date, e->>'status', nullif(e->>'notes', ''), auth.uid())
    on conflict (staff_member_id, attendance_date) do update
      set status = excluded.status, notes = excluded.notes, marked_by = excluded.marked_by, marked_at = now();
    if v_old is not null and v_old <> e->>'status' then
      perform public.write_audit(v_tenant, 'attendance.corrected', 'staff_member', (e->>'staff_member_id')::uuid,
        jsonb_build_object('date', p_date, 'status', v_old), jsonb_build_object('date', p_date, 'status', e->>'status'));
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.submit_staff_daily_report(p_staff uuid, p_date date, p_summary text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_s record; v_id uuid;
begin
  select * into v_s from public.staff_members where id = p_staff;
  if v_s is null or not public.can_access_building(v_s.tenant_id, v_s.building_id, array['owner','manager']) then
    raise exception 'NOT_FOUND: staff member not found' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_summary)), 0) < 3 then raise exception 'VALIDATION_ERROR: summary is required' using errcode = 'P0001'; end if;
  insert into public.staff_daily_reports (tenant_id, building_id, staff_member_id, report_date, work_summary, recorded_by)
  values (v_s.tenant_id, v_s.building_id, p_staff, p_date, trim(p_summary), auth.uid())
  on conflict (staff_member_id, report_date) do update set work_summary = excluded.work_summary, recorded_by = excluded.recorded_by
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Complaints & maintenance
-- ---------------------------------------------------------------------------
create or replace function public.create_complaint(p_category text, p_title text, p_description text, p_priority text default 'medium')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_a record; v_id uuid;
begin
  perform public._uid();
  select a.*, r.full_name into v_a from public.resident_room_assignments a join public.residents r on r.id = a.resident_id
    where a.end_at is null and a.resident_id in (select public.my_resident_ids()) limit 1;
  if v_a is null then raise exception 'FORBIDDEN: only active residents can raise complaints' using errcode = 'P0001'; end if;
  if (select count(*) from public.complaints where resident_id = v_a.resident_id and submitted_at > now() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMITED: too many complaints in the last hour' using errcode = 'P0001'; end if;
  insert into public.complaints (tenant_id, building_id, resident_id, room_id, category, title, description, priority)
  values (v_a.tenant_id, v_a.building_id, v_a.resident_id, v_a.room_id, p_category, trim(p_title), trim(p_description),
          coalesce(p_priority, 'medium'))
  returning id into v_id;
  perform public._notify_owners(v_a.tenant_id, 'complaint', 'New complaint: ' || trim(p_title), v_a.full_name, 'complaint', v_id);
  return v_id;
end $$;

create or replace function public.update_complaint_status(p_complaint uuid, p_status text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_c record; v_user uuid;
begin
  select * into v_c from public.complaints where id = p_complaint for update;
  if v_c is null or not public.can_access_building(v_c.tenant_id, v_c.building_id, array['owner','manager']) then
    raise exception 'NOT_FOUND: complaint not found' using errcode = 'P0001'; end if;
  if p_status not in ('open','in_progress','awaiting_resident','resolved','closed','rejected') then
    raise exception 'VALIDATION_ERROR: invalid status' using errcode = 'P0001'; end if;
  if v_c.status in ('closed','rejected') then raise exception 'CONFLICT: complaint is already %', v_c.status using errcode = 'P0001'; end if;
  update public.complaints set status = p_status, resolution_notes = coalesce(p_notes, resolution_notes),
    resolved_at = case when p_status in ('resolved','closed') then now() else null end
    where id = p_complaint;
  select user_id into v_user from public.residents where id = v_c.resident_id;
  perform public._notify(v_c.tenant_id, v_user, 'complaint', 'Complaint update: ' || v_c.title,
                         'Status changed to ' || replace(p_status, '_', ' '), 'complaint', p_complaint);
  perform public.write_audit(v_c.tenant_id, 'complaint.status', 'complaint', p_complaint,
    jsonb_build_object('status', v_c.status), jsonb_build_object('status', p_status, 'notes', p_notes));
end $$;

create or replace function public.create_maintenance_request(
  p_building uuid, p_floor uuid, p_room uuid, p_category uuid, p_title text, p_description text,
  p_priority text, p_due_at timestamptz, p_assigned_to text, p_vendor uuid, p_complaint uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := public._require_building(p_building, array['owner','manager']); v_id uuid;
begin
  if coalesce(length(trim(p_title)), 0) < 3 then raise exception 'VALIDATION_ERROR: title is required' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_description)), 0) < 3 then raise exception 'VALIDATION_ERROR: description is required' using errcode = 'P0001'; end if;
  if p_floor is not null and not exists (select 1 from public.floors where id = p_floor and building_id = p_building) then
    raise exception 'VALIDATION_ERROR: floor does not belong to this building' using errcode = 'P0001'; end if;
  if p_room is not null and not exists (select 1 from public.rooms where id = p_room and building_id = p_building
                                         and (p_floor is null or floor_id = p_floor)) then
    raise exception 'VALIDATION_ERROR: room does not belong to the selected floor' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.maintenance_categories where id = p_category and tenant_id = v_tenant) then
    raise exception 'NOT_FOUND: category not found' using errcode = 'P0001'; end if;
  if p_complaint is not null and not exists (select 1 from public.complaints where id = p_complaint and building_id = p_building) then
    raise exception 'NOT_FOUND: complaint not found' using errcode = 'P0001'; end if;

  insert into public.maintenance_requests (tenant_id, building_id, floor_id, room_id, complaint_id, title, description,
    category_id, priority, status, assigned_to, vendor_id, due_at, created_by)
  values (v_tenant, p_building, p_floor, p_room, p_complaint, trim(p_title), trim(p_description), p_category,
          coalesce(p_priority, 'medium'),
          case when coalesce(nullif(trim(p_assigned_to), ''), p_vendor::text) is not null then 'assigned' else 'open' end,
          nullif(trim(p_assigned_to), ''), p_vendor, p_due_at, auth.uid())
  returning id into v_id;
  insert into public.maintenance_activity (tenant_id, maintenance_request_id, to_status, note, actor_user_id)
  values (v_tenant, v_id, 'open', 'Request created', auth.uid());
  if p_complaint is not null then
    update public.complaints set status = 'in_progress' where id = p_complaint and status = 'open';
  end if;
  perform public.write_audit(v_tenant, 'maintenance.created', 'maintenance_request', v_id);
  return v_id;
exception when unique_violation then
  raise exception 'CONFLICT: this complaint already has a maintenance request' using errcode = 'P0001';
end $$;

create or replace function public.update_maintenance_status(p_request uuid, p_status text, p_note text default null,
                                                            p_assigned_to text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m record; v_ok boolean;
begin
  select * into v_m from public.maintenance_requests where id = p_request for update;
  if v_m is null or not public.can_access_building(v_m.tenant_id, v_m.building_id, array['owner','manager']) then
    raise exception 'NOT_FOUND: request not found' using errcode = 'P0001'; end if;
  v_ok := case v_m.status
    when 'open' then p_status in ('assigned','in_progress','cancelled')
    when 'assigned' then p_status in ('in_progress','on_hold','cancelled','assigned')
    when 'in_progress' then p_status in ('on_hold','completed','cancelled')
    when 'on_hold' then p_status in ('in_progress','cancelled')
    else false end;
  if not v_ok then
    raise exception 'VALIDATION_ERROR: cannot move from % to %', v_m.status, p_status using errcode = 'P0001'; end if;
  if p_status = 'assigned' and coalesce(nullif(trim(p_assigned_to), ''), v_m.assigned_to, v_m.vendor_id::text) is null then
    raise exception 'VALIDATION_ERROR: choose who the request is assigned to' using errcode = 'P0001'; end if;
  update public.maintenance_requests set status = p_status,
    assigned_to = coalesce(nullif(trim(p_assigned_to), ''), assigned_to),
    completed_at = case when p_status = 'completed' then now() else null end,
    completion_notes = case when p_status = 'completed' then p_note else completion_notes end
    where id = p_request;
  insert into public.maintenance_activity (tenant_id, maintenance_request_id, from_status, to_status, note, actor_user_id)
  values (v_m.tenant_id, p_request, v_m.status, p_status, p_note, auth.uid());
  if p_status = 'completed' and v_m.complaint_id is not null then
    perform public.update_complaint_status(v_m.complaint_id, 'resolved', coalesce(p_note, 'Maintenance completed'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Meals
-- ---------------------------------------------------------------------------
create or replace function public.upsert_meal_menu(p_building uuid, p_date date, p_meal_type text, p_items text,
                                                   p_serving_start time, p_serving_end time, p_change_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := public._require_building(p_building, array['owner','manager','chef']); v_old record; v_id uuid;
begin
  if p_meal_type not in ('breakfast','lunch','dinner') then raise exception 'VALIDATION_ERROR: invalid meal' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_items)), 0) = 0 then raise exception 'VALIDATION_ERROR: menu items are required' using errcode = 'P0001'; end if;
  select * into v_old from public.meal_menus where building_id = p_building and meal_date = p_date and meal_type = p_meal_type;
  if v_old.id is not null and p_date < public._tenant_today(v_tenant) then
    raise exception 'CONFLICT: past menus cannot be edited' using errcode = 'P0001'; end if;
  insert into public.meal_menus (tenant_id, building_id, meal_date, meal_type, items, serving_start, serving_end, status,
                                 change_reason, published_by, published_at)
  values (v_tenant, p_building, p_date, p_meal_type, trim(p_items), p_serving_start, p_serving_end, 'published',
          null, auth.uid(), now())
  on conflict (building_id, meal_date, meal_type) do update
    set items = excluded.items, serving_start = excluded.serving_start, serving_end = excluded.serving_end,
        change_reason = p_change_reason, status = 'published', published_by = auth.uid(), published_at = now()
  returning id into v_id;
  -- Last-minute change for today/tomorrow → notify residents
  if v_old.id is not null and v_old.items <> trim(p_items) and p_date <= public._tenant_today(v_tenant) + 1 then
    perform public._notify_building_residents(v_tenant, p_building, 'menu',
      'Menu updated: ' || initcap(p_meal_type) || ' ' || to_char(p_date, 'DD Mon'),
      v_old.items || ' → ' || trim(p_items) || coalesce(' (' || p_change_reason || ')', ''));
  end if;
  return v_id;
end $$;

create or replace function public.set_meal_availability(p_date date, p_meal_type text, p_unavailable boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_a record; v_cut time; v_tz text; v_now timestamp;
begin
  perform public._uid();
  select a.* into v_a from public.resident_room_assignments a
    where a.end_at is null and a.resident_id in (select public.my_resident_ids()) limit 1;
  if v_a is null then raise exception 'FORBIDDEN: only active residents can update meals' using errcode = 'P0001'; end if;
  select timezone into v_tz from public.tenants where id = v_a.tenant_id;
  select case p_meal_type when 'breakfast' then breakfast_cutoff when 'lunch' then lunch_cutoff when 'dinner' then dinner_cutoff end
    into v_cut from public.meal_settings where tenant_id = v_a.tenant_id;
  if v_cut is null then raise exception 'VALIDATION_ERROR: invalid meal' using errcode = 'P0001'; end if;
  v_now := now() at time zone v_tz;
  if v_now >= (p_date + v_cut) then
    raise exception 'BUSINESS_RULE_VIOLATION: cutoff (% ) has passed for this meal', to_char(v_cut, 'HH12:MI AM') using errcode = 'P0001'; end if;
  if p_date > v_now::date + 7 then raise exception 'VALIDATION_ERROR: you can only plan up to 7 days ahead' using errcode = 'P0001'; end if;
  insert into public.meal_availability (tenant_id, building_id, resident_id, meal_date, meal_type, is_unavailable)
  values (v_a.tenant_id, v_a.building_id, v_a.resident_id, p_date, p_meal_type, p_unavailable)
  on conflict (resident_id, meal_date, meal_type) do update set is_unavailable = excluded.is_unavailable, updated_at = now();
end $$;

-- Expected headcount per meal = active residents (with mess) − residents who marked unavailable.
create or replace function public.meal_count_summary(p_building uuid, p_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid := public._require_building(p_building, array['owner','manager','chef']); v_total integer;
begin
  select count(*) into v_total from public.resident_room_assignments a
    join public.admissions ad on ad.id = a.admission_id
    where a.building_id = p_building and a.end_at is null and ad.mess_included
      and a.start_at::date <= p_date;
  return jsonb_build_object('date', p_date, 'total_residents', v_total, 'meals', (
    select jsonb_agg(jsonb_build_object(
      'meal_type', mt.meal_type,
      'menu', (select jsonb_build_object('id', m.id, 'items', m.items, 'serving_start', m.serving_start, 'serving_end', m.serving_end)
               from public.meal_menus m where m.building_id = p_building and m.meal_date = p_date and m.meal_type = mt.meal_type),
      'not_eating', (select count(*) from public.meal_availability ma
                     join public.resident_room_assignments a on a.resident_id = ma.resident_id and a.end_at is null and a.building_id = p_building
                     where ma.building_id = p_building and ma.meal_date = p_date and ma.meal_type = mt.meal_type and ma.is_unavailable),
      'unavailable', coalesce((select jsonb_agg(jsonb_build_object('name', r.full_name, 'room', rm.room_number, 'bed', bd.bed_label,
                                                                  'marked_at', ma.updated_at) order by ma.updated_at)
                     from public.meal_availability ma
                     join public.residents r on r.id = ma.resident_id
                     join public.resident_room_assignments a on a.resident_id = ma.resident_id and a.end_at is null and a.building_id = p_building
                     join public.rooms rm on rm.id = a.room_id join public.beds bd on bd.id = a.bed_id
                     where ma.building_id = p_building and ma.meal_date = p_date and ma.meal_type = mt.meal_type and ma.is_unavailable), '[]'::jsonb),
      'report', (select jsonb_build_object('id', k.id, 'actual', k.actual_meal_count, 'submitted_at', k.submitted_at)
                 from public.kitchen_daily_reports k where k.building_id = p_building and k.report_date = p_date and k.meal_type = mt.meal_type)
    ) order by mt.ord)
    from (values ('breakfast', 1), ('lunch', 2), ('dinner', 3)) as mt(meal_type, ord)));
end $$;

create or replace function public.submit_meal_review(p_menu uuid, p_rating integer, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m record; v_res uuid;
begin
  perform public._uid();
  select * into v_m from public.meal_menus where id = p_menu and status = 'published';
  if v_m is null or v_m.building_id not in (select public.my_resident_building_ids()) then
    raise exception 'NOT_FOUND: menu not found' using errcode = 'P0001'; end if;
  if v_m.meal_date > public._tenant_today(v_m.tenant_id) then
    raise exception 'VALIDATION_ERROR: you can review a meal after it is served' using errcode = 'P0001'; end if;
  if not coalesce((select allow_reviews from public.meal_settings where tenant_id = v_m.tenant_id), true) then
    raise exception 'FORBIDDEN: reviews are turned off' using errcode = 'P0001'; end if;
  select id into v_res from public.residents where id in (select public.my_resident_ids()) and tenant_id = v_m.tenant_id limit 1;
  insert into public.meal_reviews (tenant_id, building_id, resident_id, meal_menu_id, rating, comment)
  values (v_m.tenant_id, v_m.building_id, v_res, p_menu, p_rating, nullif(trim(p_comment), ''))
  on conflict (resident_id, meal_menu_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create or replace function public._location(p_building uuid, p_kind text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.inventory_locations where building_id = p_building and kind = p_kind;
$$;

create or replace function public._post_stock(p_tenant uuid, p_building uuid, p_location uuid, p_item uuid, p_type text,
                                              p_qty numeric, p_unit_cost numeric, p_vendor uuid, p_ref_type text,
                                              p_ref uuid, p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_bal numeric; v_id uuid;
begin
  if coalesce(p_qty, 0) <= 0 then raise exception 'VALIDATION_ERROR: quantity must be greater than zero' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.inventory_items where id = p_item and tenant_id = p_tenant and is_active) then
    raise exception 'NOT_FOUND: item not found' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('stock:' || p_location::text || ':' || p_item::text));
  if public.inventory_direction(p_type) < 0 then
    select coalesce(sum(public.inventory_direction(transaction_type) * quantity), 0) into v_bal
      from public.inventory_transactions where inventory_location_id = p_location and item_id = p_item;
    if v_bal < p_qty then
      raise exception 'BUSINESS_RULE_VIOLATION: only % % available for %',
        trim(to_char(v_bal, 'FM999999990.###')), (select base_unit from public.inventory_items where id = p_item),
        (select name from public.inventory_items where id = p_item) using errcode = 'P0001';
    end if;
  end if;
  insert into public.inventory_transactions (tenant_id, building_id, inventory_location_id, item_id, transaction_type, quantity,
                                             unit_cost, vendor_id, reference_type, reference_id, notes, recorded_by)
  values (p_tenant, p_building, p_location, p_item, p_type, p_qty, p_unit_cost, p_vendor, p_ref_type, p_ref, p_notes, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public._post_stock(uuid, uuid, uuid, uuid, text, numeric, numeric, uuid, text, uuid, text) from public, anon, authenticated;

-- p_action: purchase | issue (store→kitchen) | return (kitchen→store) | wastage (from kitchen) | adjust_in | adjust_out (store)
create or replace function public.inventory_move(
  p_building uuid, p_item uuid, p_action text, p_qty numeric, p_unit_cost numeric, p_vendor uuid,
  p_notes text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_roles text[] := case when p_action in ('adjust_in','adjust_out') then array['owner','manager'] else array['owner','manager','chef'] end;
  v_tenant uuid := public._require_building(p_building, v_roles);
  v_store uuid := public._location(p_building, 'store');
  v_kitchen uuid := public._location(p_building, 'kitchen');
  v_prev jsonb; v_ref uuid := gen_random_uuid(); v_res jsonb;
begin
  v_prev := public._idem_get(v_tenant, 'inventory_move', p_idempotency_key);
  if v_prev is not null then return v_prev || jsonb_build_object('replayed', true); end if;
  if p_vendor is not null and not exists (select 1 from public.vendors where id = p_vendor and tenant_id = v_tenant) then
    raise exception 'NOT_FOUND: vendor not found' using errcode = 'P0001'; end if;
  case p_action
    when 'purchase' then perform public._post_stock(v_tenant, p_building, v_store, p_item, 'purchase', p_qty, p_unit_cost, p_vendor, 'purchase', v_ref, p_notes);
    when 'issue' then
      perform public._post_stock(v_tenant, p_building, v_store, p_item, 'issue_out', p_qty, null, null, 'issue', v_ref, p_notes);
      perform public._post_stock(v_tenant, p_building, v_kitchen, p_item, 'issue_in', p_qty, null, null, 'issue', v_ref, p_notes);
    when 'return' then
      perform public._post_stock(v_tenant, p_building, v_kitchen, p_item, 'return_out', p_qty, null, null, 'return', v_ref, p_notes);
      perform public._post_stock(v_tenant, p_building, v_store, p_item, 'return_in', p_qty, null, null, 'return', v_ref, p_notes);
    when 'wastage' then perform public._post_stock(v_tenant, p_building, v_kitchen, p_item, 'wastage', p_qty, null, null, 'wastage', v_ref, p_notes);
    when 'adjust_in' then perform public._post_stock(v_tenant, p_building, v_store, p_item, 'adjustment_in', p_qty, null, null, 'adjustment', v_ref, p_notes);
    when 'adjust_out' then perform public._post_stock(v_tenant, p_building, v_store, p_item, 'adjustment_out', p_qty, null, null, 'adjustment', v_ref, p_notes);
    else raise exception 'VALIDATION_ERROR: invalid action' using errcode = 'P0001';
  end case;
  v_res := jsonb_build_object('reference_id', v_ref);
  perform public._idem_put(v_tenant, 'inventory_move', p_idempotency_key, v_res);
  perform public.write_audit(v_tenant, 'inventory.' || p_action, 'inventory_item', p_item, null,
                             jsonb_build_object('qty', p_qty, 'building', p_building));
  return v_res;
end $$;

-- Chef submits a meal record: consumption + wastage from kitchen, returns back to store, all atomically.
-- p_lines: [{item_id, kind: 'consumption'|'wastage'|'return', quantity, reason}]
create or replace function public.submit_kitchen_report(
  p_building uuid, p_date date, p_meal_type text, p_actual_count integer, p_summary text,
  p_lines jsonb, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public._require_building(p_building, array['owner','manager','chef']);
  v_store uuid := public._location(p_building, 'store');
  v_kitchen uuid := public._location(p_building, 'kitchen');
  v_prev jsonb; v_id uuid; l jsonb; v_expected integer;
begin
  v_prev := public._idem_get(v_tenant, 'kitchen_report', p_idempotency_key);
  if v_prev is not null then return (v_prev->>'id')::uuid; end if;
  if p_meal_type not in ('breakfast','lunch','dinner') then raise exception 'VALIDATION_ERROR: invalid meal' using errcode = 'P0001'; end if;
  if p_date > public._tenant_today(v_tenant) then raise exception 'VALIDATION_ERROR: cannot record a future meal' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'VALIDATION_ERROR: add at least one ingredient' using errcode = 'P0001'; end if;
  if exists (select 1 from public.kitchen_daily_reports where building_id = p_building and report_date = p_date and meal_type = p_meal_type) then
    raise exception 'CONFLICT: this meal has already been recorded' using errcode = 'P0001'; end if;

  select (m->>'total_residents')::int - coalesce((select (x->>'not_eating')::int from jsonb_array_elements(m->'meals') x where x->>'meal_type' = p_meal_type), 0)
    into v_expected from (select public.meal_count_summary(p_building, p_date) as m) s;

  insert into public.kitchen_daily_reports (tenant_id, building_id, report_date, meal_type, chef_user_id, expected_meal_count,
                                            actual_meal_count, summary, status, submitted_at)
  values (v_tenant, p_building, p_date, p_meal_type, auth.uid(), v_expected, p_actual_count, p_summary, 'submitted', now())
  returning id into v_id;

  for l in select * from jsonb_array_elements(p_lines) loop
    case l->>'kind'
      when 'consumption' then perform public._post_stock(v_tenant, p_building, v_kitchen, (l->>'item_id')::uuid, 'consumption',
                                (l->>'quantity')::numeric, null, null, 'kitchen_report', v_id, nullif(l->>'reason', ''));
      when 'wastage' then perform public._post_stock(v_tenant, p_building, v_kitchen, (l->>'item_id')::uuid, 'wastage',
                                (l->>'quantity')::numeric, null, null, 'kitchen_report', v_id, nullif(l->>'reason', ''));
      when 'return' then
        perform public._post_stock(v_tenant, p_building, v_kitchen, (l->>'item_id')::uuid, 'return_out', (l->>'quantity')::numeric, null, null, 'kitchen_report', v_id, null);
        perform public._post_stock(v_tenant, p_building, v_store, (l->>'item_id')::uuid, 'return_in', (l->>'quantity')::numeric, null, null, 'kitchen_report', v_id, null);
      else raise exception 'VALIDATION_ERROR: invalid line kind' using errcode = 'P0001';
    end case;
  end loop;
  perform public._idem_put(v_tenant, 'kitchen_report', p_idempotency_key, jsonb_build_object('id', v_id));
  perform public.write_audit(v_tenant, 'kitchen.report_submitted', 'kitchen_daily_report', v_id);
  return v_id;
end $$;

create view public.inventory_stock with (security_invoker = true) as
select i.id as item_id, i.tenant_id, i.name, i.category, i.base_unit, i.reorder_level, i.is_active,
       b.id as building_id, b.name as building_name,
       coalesce((select sum(public.inventory_direction(t.transaction_type) * t.quantity) from public.inventory_transactions t
                 join public.inventory_locations l on l.id = t.inventory_location_id and l.kind = 'store'
                 where t.item_id = i.id and t.building_id = b.id), 0)::numeric(12,3) as store_qty,
       coalesce((select sum(public.inventory_direction(t.transaction_type) * t.quantity) from public.inventory_transactions t
                 join public.inventory_locations l on l.id = t.inventory_location_id and l.kind = 'kitchen'
                 where t.item_id = i.id and t.building_id = b.id), 0)::numeric(12,3) as kitchen_qty,
       (select t.unit_cost from public.inventory_transactions t where t.item_id = i.id and t.building_id = b.id
          and t.transaction_type = 'purchase' and t.unit_cost is not null order by t.occurred_at desc limit 1) as last_unit_cost,
       exists (select 1 from public.inventory_transactions t where t.item_id = i.id and t.building_id = b.id) as has_movements
from public.inventory_items i
join public.buildings b on b.tenant_id = i.tenant_id and b.status = 'active';

-- ---------------------------------------------------------------------------
-- Notices & chat
-- ---------------------------------------------------------------------------
create or replace function public.publish_notice(p_building uuid, p_title text, p_body text, p_category text, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_id uuid;
begin
  perform public._uid();
  if p_building is null then
    select m.tenant_id into v_tenant from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id and t.status = 'active'
      where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active' limit 1;
    if v_tenant is null then raise exception 'FORBIDDEN: only the owner can post to all buildings' using errcode = 'P0001'; end if;
  else
    v_tenant := public._require_building(p_building, array['owner','manager']);
  end if;
  insert into public.notices (tenant_id, building_id, title, body, category, status, published_at, expires_at, created_by)
  values (v_tenant, p_building, trim(p_title), trim(p_body), coalesce(p_category, 'announcement'), 'published', now(), p_expires_at, auth.uid())
  returning id into v_id;
  perform public._notify_building_residents(v_tenant, p_building, 'notice', trim(p_title), left(trim(p_body), 140));
  return v_id;
end $$;

create or replace function public.archive_notice(p_notice uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_n record;
begin
  select * into v_n from public.notices where id = p_notice;
  if v_n is null or not (public.has_tenant_role(v_n.tenant_id, array['owner'])
                         or (v_n.building_id is not null and public.can_access_building(v_n.tenant_id, v_n.building_id, array['manager']))) then
    raise exception 'NOT_FOUND: notice not found' using errcode = 'P0001'; end if;
  update public.notices set status = 'archived' where id = p_notice;
end $$;

create or replace function public.mark_notice_read(p_notice uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_n record; v_res uuid;
begin
  select * into v_n from public.notices where id = p_notice and status = 'published';
  select id into v_res from public.residents where id in (select public.my_resident_ids()) and tenant_id = v_n.tenant_id limit 1;
  if v_n is null or v_res is null then return; end if;
  insert into public.notice_reads (tenant_id, notice_id, resident_id) values (v_n.tenant_id, p_notice, v_res) on conflict do nothing;
end $$;

create or replace function public.send_chat_message(p_channel uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_c record; v_staff boolean; v_name text; v_id uuid;
begin
  perform public._uid();
  select * into v_c from public.chat_channels where id = p_channel;
  if v_c is null or not public.can_read_channel(p_channel) then raise exception 'NOT_FOUND: channel not found' using errcode = 'P0001'; end if;
  v_staff := public.can_access_building(v_c.tenant_id, v_c.building_id);
  if not v_staff and not v_c.residents_can_post then
    raise exception 'FORBIDDEN: only staff can post in this channel' using errcode = 'P0001'; end if;
  if coalesce(length(trim(p_body)), 0) = 0 then raise exception 'VALIDATION_ERROR: message is empty' using errcode = 'P0001'; end if;
  if (select count(*) from public.chat_messages where sender_user_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'RATE_LIMITED: slow down' using errcode = 'P0001'; end if;
  select coalesce(
    (select r.full_name from public.residents r where r.user_id = auth.uid() and r.tenant_id = v_c.tenant_id and r.status = 'active' and not v_staff),
    (select p.full_name from public.profiles p where p.id = auth.uid()), 'User') into v_name;
  insert into public.chat_messages (tenant_id, channel_id, sender_user_id, sender_name, sender_is_staff, body)
  values (v_c.tenant_id, p_channel, auth.uid(), v_name, v_staff, trim(p_body)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_message_pinned(p_message uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m record;
begin
  select m.*, c.building_id into v_m from public.chat_messages m join public.chat_channels c on c.id = m.channel_id where m.id = p_message;
  if v_m is null or not public.can_access_building(v_m.tenant_id, v_m.building_id, array['owner','manager']) then
    raise exception 'NOT_FOUND: message not found' using errcode = 'P0001'; end if;
  update public.chat_messages set is_pinned = p_pinned where id = p_message;
end $$;

create or replace function public.create_chat_group(p_building uuid, p_name text, p_residents_can_post boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := public._require_building(p_building, array['owner','manager']); v_id uuid;
begin
  if coalesce(length(trim(p_name)), 0) < 2 then raise exception 'VALIDATION_ERROR: group name is required' using errcode = 'P0001'; end if;
  insert into public.chat_channels (tenant_id, building_id, kind, name, residents_can_post, created_by)
  values (v_tenant, p_building, 'custom', trim(p_name), coalesce(p_residents_can_post, true), auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Owner / manager dashboard
-- ---------------------------------------------------------------------------
create or replace function public.owner_dashboard_summary(p_building uuid default null, p_month date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_start date; v_end date; v_tenant uuid;
begin
  perform public._uid();
  select array_agg(id) into v_ids from public.my_building_ids(array['owner','manager']) as id
    where p_building is null or id = p_building;
  if v_ids is null then
    raise exception 'NOT_FOUND: no accessible buildings' using errcode = 'P0001'; end if;
  select tenant_id into v_tenant from public.buildings where id = v_ids[1];
  v_start := date_trunc('month', coalesce(p_month, public._tenant_today(v_tenant)))::date;
  v_end := (v_start + interval '1 month')::date;

  return jsonb_build_object(
    'period_start', v_start,
    'beds_total', (select count(*) from public.beds where building_id = any(v_ids) and status = 'active'),
    'beds_occupied', (select count(*) from public.resident_room_assignments where building_id = any(v_ids) and end_at is null),
    'rooms_total', (select count(*) from public.rooms where building_id = any(v_ids)),
    'residents_active', (select count(*) from public.resident_room_assignments where building_id = any(v_ids) and end_at is null),
    'new_residents_month', (select count(*) from public.admissions where building_id = any(v_ids) and status = 'approved'
                              and admission_date >= v_start and admission_date < v_end),
    'collected_month', (select coalesce(sum(amount), 0) from public.payment_transactions
                         where building_id = any(v_ids) and status = 'confirmed' and paid_at >= v_start and paid_at < v_end),
    'billed_month', (select coalesce(sum(amount), 0) from public.rent_charges where building_id = any(v_ids)
                      and status not in ('waived','cancelled') and due_date >= v_start and due_date < v_end),
    'outstanding_total', (select coalesce(sum(balance), 0) from public.rent_charge_balances where building_id = any(v_ids)
                           and status in ('unpaid','partially_paid')),
    'overdue_total', (select coalesce(sum(balance), 0) from public.rent_charge_balances where building_id = any(v_ids)
                       and status in ('unpaid','partially_paid') and due_date < public._tenant_today(v_tenant)),
    'overdue_residents', (select count(distinct resident_id) from public.rent_charge_balances where building_id = any(v_ids)
                           and status in ('unpaid','partially_paid') and due_date < public._tenant_today(v_tenant)),
    'expenses_month', (select coalesce(sum(total_amount), 0) from public.expenses where building_id = any(v_ids)
                        and status = 'approved' and expense_date >= v_start and expense_date < v_end),
    'expenses_by_category', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'amount', x.amount) order by x.amount desc)
                        from (select c.name, sum(e.total_amount) as amount from public.expenses e
                              join public.expense_categories c on c.id = e.category_id
                              where e.building_id = any(v_ids) and e.status = 'approved' and e.expense_date >= v_start and e.expense_date < v_end
                              group by c.name) x), '[]'::jsonb),
    'expenses_unpaid', (select coalesce(sum(outstanding_amount), 0) from public.expense_balances where building_id = any(v_ids)
                         and status = 'approved'),
    'daily_collection', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'collected', d.collected, 'spent', d.spent) order by d.day)
                        from (select g::date as day,
                                (select coalesce(sum(amount), 0) from public.payment_transactions p where p.building_id = any(v_ids)
                                   and p.status = 'confirmed' and p.paid_at::date = g::date) as collected,
                                (select coalesce(sum(total_amount), 0) from public.expenses e where e.building_id = any(v_ids)
                                   and e.status = 'approved' and e.expense_date = g::date) as spent
                              from generate_series(v_start, least(v_end - 1, public._tenant_today(v_tenant)), interval '1 day') g) d), '[]'::jsonb),
    'pending_admissions', (select count(*) from public.admissions where building_id = any(v_ids) and status = 'pending_review'),
    'open_complaints', (select count(*) from public.complaints where building_id = any(v_ids) and status in ('open','in_progress','awaiting_resident')),
    'open_maintenance', (select count(*) from public.maintenance_requests where building_id = any(v_ids)
                          and status in ('open','assigned','in_progress','on_hold')),
    'low_stock', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'building', s.building_name, 'qty', s.store_qty + s.kitchen_qty,
                                                              'unit', s.base_unit, 'reorder', s.reorder_level))
                 from public.inventory_stock s where s.building_id = any(v_ids) and s.is_active and s.reorder_level > 0 and s.has_movements
                   and s.store_qty + s.kitchen_qty <= s.reorder_level), '[]'::jsonb),
    'staff_on_duty', (select count(*) from public.staff_attendance where building_id = any(v_ids)
                       and attendance_date = public._tenant_today(v_tenant) and status in ('present','late','half_day'))
  );
end $$;

-- Mark own notifications read
create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000010_grants.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 10: privilege hardening.
-- Anonymous users get no table or function access; every request must be authenticated.
-- Authenticated users rely on RLS for reads and on security-definer functions for writes.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- Authenticated clients may only SELECT directly, plus the narrow UPDATE/INSERT paths
-- that have explicit RLS policies. Everything else goes through RPC.
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;
grant update (name, address, city, code) on public.buildings to authenticated;
grant update (name) on public.floors to authenticated;
grant update (base_monthly_rent, status, notes) on public.rooms to authenticated;
grant update (full_name, phone, email, gender, date_of_birth, occupation, emergency_contact_name,
              emergency_contact_phone) on public.residents to authenticated;
grant insert (tenant_id, name, is_maintenance) on public.expense_categories to authenticated;
grant update (name, is_active) on public.expense_categories to authenticated;
grant insert (tenant_id, name, contact_person, phone, email, address, service_categories, notes) on public.vendors to authenticated;
grant update (name, contact_person, phone, email, address, service_categories, notes, is_active) on public.vendors to authenticated;
grant insert (tenant_id, name) on public.maintenance_categories to authenticated;
grant insert (tenant_id, name, category, base_unit, reorder_level) on public.inventory_items to authenticated;
grant update (name, category, base_unit, reorder_level, is_active) on public.inventory_items to authenticated;
grant update (breakfast_cutoff, lunch_cutoff, dinner_cutoff, allow_reviews) on public.meal_settings to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Internal tables never readable by clients
revoke select on public.idempotency_keys, public.receipt_counters from authenticated;

grant execute on all functions in schema public to authenticated;
-- Re-revoke internal helpers (the blanket grant above re-enabled them)
revoke execute on function public._require_platform_admin() from authenticated;
revoke execute on function public._idem_get(uuid, text, text) from authenticated;
revoke execute on function public._idem_put(uuid, text, text, jsonb) from authenticated;
revoke execute on function public._notify(uuid, uuid, text, text, text, text, uuid) from authenticated;
revoke execute on function public._notify_building_residents(uuid, uuid, text, text, text) from authenticated;
revoke execute on function public._notify_owners(uuid, text, text, text, text, uuid) from authenticated;
revoke execute on function public._trusted() from authenticated;
revoke execute on function public._provision_building(uuid, uuid) from authenticated;
revoke execute on function public._provision_tenant_defaults(uuid) from authenticated;
revoke execute on function public._refresh_charge_status(uuid) from authenticated;
revoke execute on function public._post_stock(uuid, uuid, uuid, uuid, text, numeric, numeric, uuid, text, uuid, text) from authenticated;
revoke execute on function public.write_audit(uuid, text, text, uuid, jsonb, jsonb) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000011_resident_profile.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 11: resident self-service profile. Residents cannot read rooms/beds/buildings
-- directly (those tables are staff-scoped), so this returns only their own placement.

create or replace function public.my_resident_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'resident_id', r.id, 'tenant_id', r.tenant_id, 'full_name', r.full_name, 'phone', r.phone, 'email', r.email,
    'business_name', t.business_name, 'building_id', a.building_id, 'building_name', b.name, 'building_address', b.address,
    'floor_name', f.name, 'room_number', rm.room_number, 'sharing', rm.sharing_capacity, 'bed_label', bd.bed_label,
    'admission_date', ad.admission_date, 'monthly_rent', ad.monthly_rent, 'security_deposit', ad.security_deposit,
    'mess_included', ad.mess_included,
    'cutoffs', (select jsonb_build_object('breakfast', s.breakfast_cutoff, 'lunch', s.lunch_cutoff, 'dinner', s.dinner_cutoff, 'allow_reviews', s.allow_reviews)
                from public.meal_settings s where s.tenant_id = r.tenant_id),
    'timezone', t.timezone
  )
  from public.residents r
  join public.tenants t on t.id = r.tenant_id and t.status = 'active'
  join public.resident_room_assignments a on a.resident_id = r.id and a.end_at is null
  join public.buildings b on b.id = a.building_id
  join public.rooms rm on rm.id = a.room_id
  join public.floors f on f.id = rm.floor_id
  join public.beds bd on bd.id = a.bed_id
  join public.admissions ad on ad.id = a.admission_id
  where r.user_id = auth.uid() and r.status = 'active'
  limit 1;
$$;
revoke execute on function public.my_resident_profile() from anon, public;
grant execute on function public.my_resident_profile() to authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000012_relationship_fks.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 12: explicit tenant-safe foreign keys that were implied but not declared.
-- They enforce location integrity and let PostgREST embed related rows.
-- Composite keys include tenant_id so a row can never point at another tenant's building/room.

alter table public.admissions
  add constraint admissions_building_fk foreign key (tenant_id, building_id) references public.buildings(tenant_id, id);

alter table public.complaints
  add constraint complaints_room_fk foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id);

alter table public.maintenance_requests
  add constraint maintenance_floor_fk foreign key (tenant_id, building_id, floor_id) references public.floors(tenant_id, building_id, id),
  add constraint maintenance_room_fk foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id);

alter table public.resident_room_assignments
  add constraint assignments_room_fk foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id);

alter table public.expenses
  add constraint expenses_floor_fk foreign key (tenant_id, building_id, floor_id) references public.floors(tenant_id, building_id, id),
  add constraint expenses_room_fk foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id);

alter table public.meal_availability
  add constraint meal_availability_building_fk foreign key (tenant_id, building_id) references public.buildings(tenant_id, id);

alter table public.staff_attendance
  add constraint staff_attendance_building_fk foreign key (tenant_id, building_id) references public.buildings(tenant_id, id);


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261018000013_storage.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 13: private file storage (resident KYC documents, expense invoices, maintenance photos).
--
-- Upload flow (all paths are server generated):
--   1. client calls begin_upload(kind, record, mime, size, file_name) -> metadata row + path
--      tenant_id/building_id/record_id/<uuid>.<ext>
--   2. client uploads to that exact path; storage.objects INSERT is only allowed when a
--      pending metadata row for that path exists, was issued to this user, and the user
--      still has staff access to the record's building.
--   3. client calls complete_upload(kind, id) which checks the stored object's real size/type.
-- Reads (including signing URLs) are authorized by looking the object up in its metadata
-- table and applying the record's access rule — the path itself is never trusted.
--
-- Rollback: drop the storage.objects policies below, the storage_* / *_upload functions,
-- expense_attachments and maintenance_attachments, the added resident_documents columns,
-- then delete the three buckets (after removing their objects through the Storage API).

-- ---------------------------------------------------------------------------
-- Buckets: private, 5 MB, pdf/jpg/png/webp only (enforced by the storage service)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resident-documents', 'resident-documents', false, 5242880, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('expense-invoices', 'expense-invoices', false, 5242880, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('maintenance-attachments', 'maintenance-attachments', false, 5242880, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Metadata tables
-- ---------------------------------------------------------------------------
alter table public.resident_documents
  add column building_id uuid,
  add column file_name text,
  add column mime_type text,
  add column size_bytes bigint,
  add column uploaded_at timestamptz,      -- null until complete_upload() confirms the object
  add column review_note text,
  add foreign key (tenant_id, building_id) references public.buildings(tenant_id, id);
create unique index resident_documents_path on public.resident_documents (storage_path);
create index resident_documents_resident on public.resident_documents (resident_id);

create table public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  expense_id uuid not null,
  storage_path text not null unique,
  file_name text,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, expense_id) references public.expenses(tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id)
);
create index expense_attachments_expense on public.expense_attachments (expense_id);

create table public.maintenance_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  maintenance_request_id uuid not null,
  storage_path text not null unique,
  file_name text,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, maintenance_request_id) references public.maintenance_requests(tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id)
);
create index maintenance_attachments_request on public.maintenance_attachments (maintenance_request_id);

alter table public.expense_attachments enable row level security;
alter table public.maintenance_attachments enable row level security;

-- Same audience as the parent records: owners/managers of the building. Chefs/residents: none.
create policy expense_attachments_select on public.expense_attachments for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));
create policy maintenance_attachments_select on public.maintenance_attachments for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));

-- Clients only read these tables; every write goes through the functions below.
revoke insert, update, delete, truncate on public.expense_attachments, public.maintenance_attachments from authenticated;
grant select on public.expense_attachments, public.maintenance_attachments to authenticated;
revoke all on public.expense_attachments, public.maintenance_attachments from anon;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._upload_ext(p_mime text)
returns text language sql immutable set search_path = '' as $$
  select case p_mime
    when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png' when 'image/webp' then 'webp' end;
$$;

create or replace function public._upload_bucket(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case p_kind
    when 'resident_document' then 'resident-documents'
    when 'expense_invoice' then 'expense-invoices'
    when 'maintenance_attachment' then 'maintenance-attachments' end;
$$;

-- Can the current user read this object? Looks up the owning record; the path is only a key.
create or replace function public.storage_can_read(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_bucket
    when 'resident-documents' then exists (
      select 1 from public.resident_documents d
      where d.storage_path = p_name
        and (public.can_staff_view_resident(d.tenant_id, d.resident_id)   -- owner/manager only
             or d.resident_id in (select public.my_resident_ids())))
    when 'expense-invoices' then exists (
      select 1 from public.expense_attachments a
      where a.storage_path = p_name
        and public.can_access_building(a.tenant_id, a.building_id, array['owner','manager']))
    when 'maintenance-attachments' then exists (
      select 1 from public.maintenance_attachments a
      where a.storage_path = p_name
        and public.can_access_building(a.tenant_id, a.building_id, array['owner','manager']))
    else false end;
$$;

-- Can the current user create this object? Only for a pending row issued to them.
create or replace function public.storage_can_write(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_bucket
    when 'resident-documents' then exists (
      select 1 from public.resident_documents d
      where d.storage_path = p_name and d.uploaded_at is null and d.uploaded_by = auth.uid()
        and public.can_staff_view_resident(d.tenant_id, d.resident_id))
    when 'expense-invoices' then exists (
      select 1 from public.expense_attachments a
      where a.storage_path = p_name and a.uploaded_at is null and a.uploaded_by = auth.uid()
        and public.can_access_building(a.tenant_id, a.building_id, array['owner','manager']))
    when 'maintenance-attachments' then exists (
      select 1 from public.maintenance_attachments a
      where a.storage_path = p_name and a.uploaded_at is null and a.uploaded_by = auth.uid()
        and public.can_access_building(a.tenant_id, a.building_id, array['owner','manager']))
    else false end;
$$;

-- ---------------------------------------------------------------------------
-- storage.objects policies. No UPDATE/DELETE policies: files are never overwritten
-- or removed by clients (documents are rejected, not deleted, to keep history).
-- ---------------------------------------------------------------------------
create policy zipnary_objects_select on storage.objects for select to authenticated
  using (bucket_id in ('resident-documents','expense-invoices','maintenance-attachments')
         and public.storage_can_read(bucket_id, name));

create policy zipnary_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('resident-documents','expense-invoices','maintenance-attachments')
              and public.storage_can_write(bucket_id, name));

-- ---------------------------------------------------------------------------
-- Workflows
-- ---------------------------------------------------------------------------
create or replace function public.begin_upload(
  p_kind text, p_record uuid, p_mime text, p_size bigint, p_file_name text default null, p_document_type text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_ext text := public._upload_ext(p_mime);
  v_bucket text := public._upload_bucket(p_kind);
  v_tenant uuid; v_building uuid; v_id uuid := gen_random_uuid(); v_path text;
  v_name text := left(regexp_replace(coalesce(p_file_name, ''), '[^A-Za-z0-9._ ()-]', '_', 'g'), 120);
  v_pending integer; v_existing integer;
begin
  if v_bucket is null then raise exception 'VALIDATION_ERROR: unknown upload type' using errcode = 'P0001'; end if;
  if v_ext is null then raise exception 'VALIDATION_ERROR: only PDF, JPG, PNG or WEBP files are allowed' using errcode = 'P0001'; end if;
  if p_size is null or p_size <= 0 or p_size > 5242880 then
    raise exception 'VALIDATION_ERROR: file must be smaller than 5 MB' using errcode = 'P0001'; end if;

  -- Abuse guard: limit unconfirmed upload slots per user
  select (select count(*) from public.resident_documents where uploaded_by = v_uid and uploaded_at is null and created_at > now() - interval '1 hour')
       + (select count(*) from public.expense_attachments where uploaded_by = v_uid and uploaded_at is null and created_at > now() - interval '1 hour')
       + (select count(*) from public.maintenance_attachments where uploaded_by = v_uid and uploaded_at is null and created_at > now() - interval '1 hour')
    into v_pending;
  if v_pending >= 30 then raise exception 'RATE_LIMITED: too many unfinished uploads, try again later' using errcode = 'P0001'; end if;

  if p_kind = 'resident_document' then
    if coalesce(p_document_type, '') not in ('photo','id_proof','address_proof','guardian_id','other') then
      raise exception 'VALIDATION_ERROR: choose a document type' using errcode = 'P0001'; end if;
    select r.tenant_id into v_tenant from public.residents r where r.id = p_record;
    if v_tenant is null or not public.can_staff_view_resident(v_tenant, p_record) then
      raise exception 'NOT_FOUND: resident not found' using errcode = 'P0001'; end if;
    -- building of the resident's latest admission the user can access
    select a.building_id into v_building from public.admissions a
    where a.tenant_id = v_tenant and a.resident_id = p_record
      and public.can_access_building(v_tenant, a.building_id, array['owner','manager'])
    order by a.created_at desc limit 1;
    if v_building is null then raise exception 'NOT_FOUND: resident not found' using errcode = 'P0001'; end if;
    select count(*) into v_existing from public.resident_documents where resident_id = p_record;
  elsif p_kind = 'expense_invoice' then
    select e.tenant_id, e.building_id into v_tenant, v_building from public.expenses e where e.id = p_record;
    if v_tenant is null or not public.can_access_building(v_tenant, v_building, array['owner','manager']) then
      raise exception 'NOT_FOUND: expense not found' using errcode = 'P0001'; end if;
    select count(*) into v_existing from public.expense_attachments where expense_id = p_record;
  else
    select m.tenant_id, m.building_id into v_tenant, v_building from public.maintenance_requests m where m.id = p_record;
    if v_tenant is null or not public.can_access_building(v_tenant, v_building, array['owner','manager']) then
      raise exception 'NOT_FOUND: maintenance request not found' using errcode = 'P0001'; end if;
    select count(*) into v_existing from public.maintenance_attachments where maintenance_request_id = p_record;
  end if;
  if v_existing >= 20 then raise exception 'BUSINESS_RULE_VIOLATION: a record can have at most 20 files' using errcode = 'P0001'; end if;

  v_path := v_tenant::text || '/' || v_building::text || '/' || p_record::text || '/' || gen_random_uuid()::text || '.' || v_ext;

  if p_kind = 'resident_document' then
    insert into public.resident_documents (id, tenant_id, resident_id, building_id, document_type, storage_path, file_name, mime_type, size_bytes, uploaded_by)
    values (v_id, v_tenant, p_record, v_building, p_document_type, v_path, nullif(v_name, ''), p_mime, p_size, v_uid);
  elsif p_kind = 'expense_invoice' then
    insert into public.expense_attachments (id, tenant_id, building_id, expense_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
    values (v_id, v_tenant, v_building, p_record, v_path, nullif(v_name, ''), p_mime, p_size, v_uid);
  else
    insert into public.maintenance_attachments (id, tenant_id, building_id, maintenance_request_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
    values (v_id, v_tenant, v_building, p_record, v_path, nullif(v_name, ''), p_mime, p_size, v_uid);
  end if;
  return jsonb_build_object('id', v_id, 'bucket', v_bucket, 'path', v_path);
end $$;

-- Confirms the object exists and matches the declared type/size limits.
create or replace function public.complete_upload(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid(); v_bucket text := public._upload_bucket(p_kind);
  v_row record; v_obj record;
begin
  if v_bucket is null then raise exception 'VALIDATION_ERROR: unknown upload type' using errcode = 'P0001'; end if;
  if p_kind = 'resident_document' then
    select id, tenant_id, storage_path, mime_type, uploaded_by, uploaded_at, resident_id as record_id into v_row from public.resident_documents where id = p_id for update;
  elsif p_kind = 'expense_invoice' then
    select id, tenant_id, storage_path, mime_type, uploaded_by, uploaded_at, expense_id as record_id into v_row from public.expense_attachments where id = p_id for update;
  else
    select id, tenant_id, storage_path, mime_type, uploaded_by, uploaded_at, maintenance_request_id as record_id into v_row from public.maintenance_attachments where id = p_id for update;
  end if;
  if v_row.id is null or v_row.uploaded_by is distinct from v_uid then
    raise exception 'NOT_FOUND: upload not found' using errcode = 'P0001'; end if;
  if v_row.uploaded_at is not null then return; end if;  -- idempotent

  select (o.metadata->>'size')::bigint as size, o.metadata->>'mimetype' as mime into v_obj
  from storage.objects o where o.bucket_id = v_bucket and o.name = v_row.storage_path;
  if v_obj.size is null then raise exception 'VALIDATION_ERROR: file was not uploaded' using errcode = 'P0001'; end if;
  if v_obj.size > 5242880 or v_obj.mime is distinct from v_row.mime_type then
    raise exception 'VALIDATION_ERROR: uploaded file does not match the allowed type or size' using errcode = 'P0001'; end if;

  if p_kind = 'resident_document' then
    update public.resident_documents set uploaded_at = now(), size_bytes = v_obj.size where id = p_id;
  elsif p_kind = 'expense_invoice' then
    update public.expense_attachments set uploaded_at = now(), size_bytes = v_obj.size where id = p_id;
  else
    update public.maintenance_attachments set uploaded_at = now(), size_bytes = v_obj.size where id = p_id;
  end if;
  perform public.write_audit(v_row.tenant_id, 'file.uploaded', p_kind, p_id, null,
    jsonb_build_object('record_id', v_row.record_id, 'size', v_obj.size, 'mime', v_obj.mime));
end $$;

create or replace function public.review_resident_document(p_document uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public._uid(); v_doc record;
begin
  if p_decision not in ('verified','rejected') then
    raise exception 'VALIDATION_ERROR: decision must be verified or rejected' using errcode = 'P0001'; end if;
  select * into v_doc from public.resident_documents where id = p_document for update;
  if v_doc.id is null or not public.can_staff_view_resident(v_doc.tenant_id, v_doc.resident_id) then
    raise exception 'NOT_FOUND: document not found' using errcode = 'P0001'; end if;
  if v_doc.uploaded_at is null then
    raise exception 'BUSINESS_RULE_VIOLATION: the file upload has not finished' using errcode = 'P0001'; end if;
  update public.resident_documents
    set verification_status = p_decision, verified_by = v_uid, verified_at = now(), review_note = nullif(trim(coalesce(p_note, '')), '')
    where id = p_document;
  perform public.write_audit(v_doc.tenant_id, 'resident_document.' || p_decision, 'resident_document', p_document,
    jsonb_build_object('status', v_doc.verification_status), jsonb_build_object('status', p_decision));
end $$;

revoke execute on function public._upload_ext(text), public._upload_bucket(text) from anon, public, authenticated;
revoke execute on function public.storage_can_read(text, text), public.storage_can_write(text, text) from anon, public;
grant execute on function public.storage_can_read(text, text), public.storage_can_write(text, text) to authenticated;
revoke execute on function public.begin_upload(text, uuid, text, bigint, text, text), public.complete_upload(text, uuid),
  public.review_resident_document(uuid, text, text) from anon, public;
grant execute on function public.begin_upload(text, uuid, text, bigint, text, text), public.complete_upload(text, uuid),
  public.review_resident_document(uuid, text, text) to authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261019000014_tenant_code.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ---------------------------------------------------------------------------
-- Human-readable, globally unique tenant (hostel business) ID, e.g. ZPN-000001.
--
-- Assigned automatically by the database when the tenant row is created, which happens
-- when a signed-in owner (Google or email) submits onboarding. The client never chooses it.
-- `tenants.id` (uuid) stays the key every other table references; the code is for people
-- (support calls, invoices, screens).
--
-- Rollback: alter table public.tenants drop column tenant_code; drop sequence public.tenant_code_seq;
-- ---------------------------------------------------------------------------

create sequence public.tenant_code_seq start 1;

alter table public.tenants
  add column tenant_code text;

-- Backfill existing tenants in creation order.
update public.tenants t
   set tenant_code = 'ZPN-' || lpad(nextval('public.tenant_code_seq')::text, 6, '0')
  from (select id from public.tenants order by created_at, id) o
 where o.id = t.id and t.tenant_code is null;

alter table public.tenants
  alter column tenant_code set default ('ZPN-' || lpad(nextval('public.tenant_code_seq')::text, 6, '0')),
  alter column tenant_code set not null,
  add constraint tenants_tenant_code_key unique (tenant_code),
  add constraint tenants_tenant_code_format check (tenant_code ~ '^ZPN-[0-9]{6,}$');

-- The code is permanent: it can never be changed after creation.
create or replace function public.tenants_guard_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tenant_code is distinct from old.tenant_code then
    raise exception 'FORBIDDEN: tenant code cannot be changed' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger tenants_guard_code before update on public.tenants
  for each row execute function public.tenants_guard_code();

-- Expose the code to the client through my_access (owners see it on screens).
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'is_platform_admin', public.is_platform_admin(),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membership_id', m.id, 'tenant_id', m.tenant_id, 'tenant_code', t.tenant_code, 'role', m.role, 'status', m.status,
        'tenant_name', t.business_name, 'tenant_status', t.status, 'currency', t.currency, 'timezone', t.timezone,
        'building_ids', case when m.role = 'owner'
            then coalesce((select jsonb_agg(b.id) from public.buildings b where b.tenant_id = m.tenant_id and b.status = 'active'), '[]'::jsonb)
            else coalesce((select jsonb_agg(bm.building_id) from public.building_memberships bm where bm.membership_id = m.id), '[]'::jsonb) end
      ) order by m.created_at)
      from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id
      where m.user_id = auth.uid() and m.status = 'active'), '[]'::jsonb),
    'owned_tenant', (select jsonb_build_object('tenant_id', t.id, 'tenant_code', t.tenant_code, 'status', t.status,
                                               'business_name', t.business_name)
                     from public.tenants t where t.owner_user_id = auth.uid() order by t.created_at desc limit 1)
  );
$$;

-- Only the database assigns codes.
revoke all on sequence public.tenant_code_seq from anon, authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261019000015_resident_community.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ---------------------------------------------------------------------------
-- Migration 15: resident community features (resident portal redesign).
--
--   community_posts      lost & found, marketplace (visible to the resident's building),
--                        suggestions and feedback (visible to the author and staff only)
--   polls / poll_options / poll_votes   staff-created polls, one vote per resident (changeable while open)
--   visitor_passes       resident requests, owner/manager approves (pass code), checks in/out
--   chat_channel_reads   per-user "last read" marker → unread counts in the community screen
--   residents.share_birthday            opt-in; only opted-in residents appear in building birthdays
--
-- Same rules as every other table: tenant_id on every row, composite FKs to the tenant's buildings and
-- residents, RLS on, clients only SELECT, all writes through security-definer RPCs that re-check scope.
--
-- Rollback: drop the RPCs below, then drop tables chat_channel_reads, visitor_passes, poll_votes, poll_options,
-- polls, community_posts; alter table residents drop column share_birthday; restore my_resident_profile from migration 11.
-- ---------------------------------------------------------------------------

-- ============================================================== community_posts
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  resident_id uuid not null,
  -- Display name of the author (first name), so other residents never need to read residents rows.
  author_name text not null,
  kind text not null check (kind in ('lost_found','marketplace','suggestion','feedback')),
  title text not null check (length(title) between 3 and 140),
  body text not null check (length(body) between 1 and 2000),
  price numeric(12,2) check (price is null or price >= 0),
  status text not null default 'open' check (status in ('open','closed')),
  staff_response text check (staff_response is null or length(staff_response) <= 2000),
  responded_by uuid references auth.users(id),
  responded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id),
  -- price only makes sense on marketplace listings
  check (price is null or kind = 'marketplace')
);
create index community_posts_lookup on public.community_posts (tenant_id, building_id, kind, status, created_at desc);
create trigger community_posts_touch before update on public.community_posts
  for each row execute function public.touch_updated_at();

alter table public.community_posts enable row level security;
-- Author always; lost & found / marketplace to residents of the same building; staff of the building.
create policy community_posts_select on public.community_posts for select
  using (resident_id in (select public.my_resident_ids())
         or (kind in ('lost_found','marketplace') and building_id in (select public.my_resident_building_ids()))
         or public.can_access_building(tenant_id, building_id, array['owner','manager']));

-- ============================================================== polls
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  building_id uuid,                         -- null = every building of the tenant (owner only)
  question text not null check (length(question) between 5 and 200),
  status text not null default 'open' check (status in ('open','closed')),
  closes_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id)
);
create index polls_lookup on public.polls (tenant_id, building_id, created_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  poll_id uuid not null,
  label text not null check (length(label) between 1 and 100),
  position integer not null,
  unique (tenant_id, id),
  unique (poll_id, position),
  foreign key (tenant_id, poll_id) references public.polls(tenant_id, id) on delete cascade
);

create table public.poll_votes (
  tenant_id uuid not null,
  poll_id uuid not null,
  option_id uuid not null,
  resident_id uuid not null,
  voted_at timestamptz not null default now(),
  primary key (poll_id, resident_id),        -- one vote per resident per poll
  foreign key (tenant_id, poll_id) references public.polls(tenant_id, id) on delete cascade,
  foreign key (tenant_id, option_id) references public.poll_options(tenant_id, id) on delete cascade,
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id)
);

-- Can the current user see this poll? (staff of the building/tenant, or a resident of the building)
create or replace function public.can_see_poll(p_tenant uuid, p_building uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (public.has_tenant_role(p_tenant, array['owner','manager'])
          and (p_building is null or public.can_access_building(p_tenant, p_building, array['owner','manager'])))
      or exists (
        select 1 from public.residents r
        where r.id in (select public.my_resident_ids()) and r.tenant_id = p_tenant
          and (p_building is null or p_building in (select public.my_resident_building_ids())));
$$;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
create policy polls_select on public.polls for select using (public.can_see_poll(tenant_id, building_id));
create policy poll_options_select on public.poll_options for select
  using (exists (select 1 from public.polls p where p.id = poll_id));
-- Individual votes: only your own; staff see totals through poll_summaries().
create policy poll_votes_select on public.poll_votes for select
  using (resident_id in (select public.my_resident_ids()));

-- ============================================================== visitor_passes
create table public.visitor_passes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  resident_id uuid not null,
  visitor_name text not null check (length(visitor_name) between 2 and 80),
  visitor_phone text check (visitor_phone is null or visitor_phone ~ '^\+?[0-9 ]{10,15}$'),
  visit_date date not null,
  purpose text check (purpose is null or length(purpose) <= 200),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled','checked_in','checked_out')),
  pass_code text,                              -- issued on approval, shown to security at the gate
  decision_note text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id)
);
create index visitor_passes_lookup on public.visitor_passes (tenant_id, building_id, visit_date desc);
create trigger visitor_passes_touch before update on public.visitor_passes
  for each row execute function public.touch_updated_at();

alter table public.visitor_passes enable row level security;
create policy visitor_passes_select on public.visitor_passes for select
  using (resident_id in (select public.my_resident_ids())
         or public.can_access_building(tenant_id, building_id, array['owner','manager']));

-- ============================================================== chat_channel_reads
create table public.chat_channel_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  channel_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id),
  foreign key (tenant_id, channel_id) references public.chat_channels(tenant_id, id) on delete cascade
);
alter table public.chat_channel_reads enable row level security;
create policy chat_channel_reads_select on public.chat_channel_reads for select using (user_id = auth.uid());

-- ============================================================== birthdays (opt-in)
alter table public.residents add column share_birthday boolean not null default false;

-- ============================================================== grants
grant select on public.community_posts, public.polls, public.poll_options, public.poll_votes,
                public.visitor_passes, public.chat_channel_reads to authenticated;
revoke all on public.community_posts, public.polls, public.poll_options, public.poll_votes,
              public.visitor_passes, public.chat_channel_reads from anon;

-- ============================================================== helpers
-- The caller's active stay (resident, tenant, building, room); raises if the caller is not an active resident.
create or replace function public._my_stay()
returns table (resident_id uuid, tenant_id uuid, building_id uuid, room_id uuid, full_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._uid();
  return query
    select a.resident_id, a.tenant_id, a.building_id, a.room_id, r.full_name
    from public.resident_room_assignments a join public.residents r on r.id = a.resident_id
    where a.end_at is null and a.resident_id in (select public.my_resident_ids())
    limit 1;
  if not found then
    raise exception 'FORBIDDEN: only active residents can do this' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public._my_stay() from public, anon, authenticated;

-- ============================================================== community post RPCs
create or replace function public.create_community_post(p_kind text, p_title text, p_body text, p_price numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v record; v_id uuid;
begin
  select * into v from public._my_stay();
  if p_kind not in ('lost_found','marketplace','suggestion','feedback') then
    raise exception 'VALIDATION_ERROR: invalid post type' using errcode = 'P0001'; end if;
  if (select count(*) from public.community_posts where resident_id = v.resident_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED: too many posts in the last hour' using errcode = 'P0001'; end if;
  insert into public.community_posts (tenant_id, building_id, resident_id, author_name, kind, title, body, price)
  values (v.tenant_id, v.building_id, v.resident_id, split_part(v.full_name, ' ', 1), p_kind, trim(p_title), trim(p_body),
          case when p_kind = 'marketplace' then p_price end)
  returning id into v_id;
  if p_kind in ('suggestion','feedback') then
    perform public._notify_owners(v.tenant_id, 'community', 'New ' || p_kind || ': ' || trim(p_title), v.full_name,
                                  'community_post', v_id);
  end if;
  return v_id;
end $$;

-- Author closes their own post; owner/manager of the building may close it and/or reply.
create or replace function public.respond_community_post(p_post uuid, p_response text default null, p_close boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_p record; v_staff boolean; v_user uuid;
begin
  perform public._uid();
  select * into v_p from public.community_posts where id = p_post for update;
  if v_p is null then raise exception 'NOT_FOUND: post not found' using errcode = 'P0001'; end if;
  v_staff := public.can_access_building(v_p.tenant_id, v_p.building_id, array['owner','manager']);
  if not v_staff and v_p.resident_id not in (select public.my_resident_ids()) then
    raise exception 'NOT_FOUND: post not found' using errcode = 'P0001'; end if;
  if p_response is not null and not v_staff then
    raise exception 'FORBIDDEN: only staff can reply' using errcode = 'P0001'; end if;
  update public.community_posts set
    staff_response = coalesce(nullif(trim(p_response), ''), staff_response),
    responded_by = case when p_response is not null then auth.uid() else responded_by end,
    responded_at = case when p_response is not null then now() else responded_at end,
    status = case when p_close then 'closed' else status end,
    closed_at = case when p_close then now() else closed_at end
  where id = p_post;
  if v_staff and p_response is not null then
    select user_id into v_user from public.residents where id = v_p.resident_id;
    perform public._notify(v_p.tenant_id, v_user, 'community', 'Reply to: ' || v_p.title, trim(p_response),
                           'community_post', p_post);
  end if;
end $$;

-- ============================================================== poll RPCs
create or replace function public.create_poll(p_building uuid, p_question text, p_options text[], p_closes_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_id uuid; v_i integer := 0; v_opt text;
begin
  perform public._uid();
  if p_building is null then
    select m.tenant_id into v_tenant from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id and t.status = 'active'
      where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active' limit 1;
    if v_tenant is null then raise exception 'FORBIDDEN: only the owner can poll every building' using errcode = 'P0001'; end if;
  else
    v_tenant := public._require_building(p_building, array['owner','manager']);
  end if;
  if coalesce(array_length(p_options, 1), 0) not between 2 and 6 then
    raise exception 'VALIDATION_ERROR: a poll needs 2 to 6 options' using errcode = 'P0001'; end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'VALIDATION_ERROR: closing time must be in the future' using errcode = 'P0001'; end if;
  insert into public.polls (tenant_id, building_id, question, closes_at, created_by)
  values (v_tenant, p_building, trim(p_question), p_closes_at, auth.uid()) returning id into v_id;
  foreach v_opt in array p_options loop
    if length(trim(v_opt)) = 0 then raise exception 'VALIDATION_ERROR: options cannot be empty' using errcode = 'P0001'; end if;
    v_i := v_i + 1;
    insert into public.poll_options (tenant_id, poll_id, label, position) values (v_tenant, v_id, trim(v_opt), v_i);
  end loop;
  perform public._notify_building_residents(v_tenant, p_building, 'poll', 'New poll', trim(p_question));
  perform public.write_audit(v_tenant, 'poll.created', 'poll', v_id, null, jsonb_build_object('question', trim(p_question)));
  return v_id;
end $$;

-- One vote per resident; voting again while the poll is open changes the vote.
create or replace function public.vote_poll(p_poll uuid, p_option uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v record; v_p record;
begin
  select * into v from public._my_stay();
  select * into v_p from public.polls where id = p_poll and tenant_id = v.tenant_id
    and (building_id is null or building_id = v.building_id);
  if v_p is null then raise exception 'NOT_FOUND: poll not found' using errcode = 'P0001'; end if;
  if v_p.status <> 'open' or (v_p.closes_at is not null and v_p.closes_at <= now()) then
    raise exception 'BUSINESS_RULE_VIOLATION: this poll is closed' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.poll_options where id = p_option and poll_id = p_poll) then
    raise exception 'VALIDATION_ERROR: invalid option' using errcode = 'P0001'; end if;
  insert into public.poll_votes (tenant_id, poll_id, option_id, resident_id)
  values (v.tenant_id, p_poll, p_option, v.resident_id)
  on conflict (poll_id, resident_id) do update set option_id = excluded.option_id, voted_at = now();
end $$;

create or replace function public.close_poll(p_poll uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_p record;
begin
  perform public._uid();
  select * into v_p from public.polls where id = p_poll;
  if v_p is null or not (
       (v_p.building_id is null and public.has_tenant_role(v_p.tenant_id, array['owner']))
    or (v_p.building_id is not null and public.can_access_building(v_p.tenant_id, v_p.building_id, array['owner','manager']))) then
    raise exception 'NOT_FOUND: poll not found' using errcode = 'P0001'; end if;
  update public.polls set status = 'closed' where id = p_poll;
end $$;

-- Visible polls (newest first) with option vote counts and the caller's own vote.
create or replace function public.poll_summaries(p_building uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', p.id, 'question', p.question, 'building_id', p.building_id, 'created_at', p.created_at,
      'closes_at', p.closes_at,
      'status', case when p.status = 'open' and p.closes_at is not null and p.closes_at <= now() then 'closed' else p.status end,
      'total_votes', (select count(*) from public.poll_votes v where v.poll_id = p.id),
      'my_option', (select v.option_id from public.poll_votes v where v.poll_id = p.id
                     and v.resident_id in (select public.my_resident_ids())),
      'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label,
                    'votes', (select count(*) from public.poll_votes v where v.option_id = o.id)) order by o.position)
                  from public.poll_options o where o.poll_id = p.id)
    ) x
    from public.polls p
    where public.can_see_poll(p.tenant_id, p.building_id)
      and (p_building is null or p.building_id is null or p.building_id = p_building)
  ) s;
$$;

-- ============================================================== visitor pass RPCs
create or replace function public.request_visitor_pass(p_name text, p_phone text, p_date date, p_purpose text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v record; v_id uuid;
begin
  select * into v from public._my_stay();
  if p_date < public._tenant_today(v.tenant_id) or p_date > public._tenant_today(v.tenant_id) + 30 then
    raise exception 'VALIDATION_ERROR: visit date must be within the next 30 days' using errcode = 'P0001'; end if;
  if (select count(*) from public.visitor_passes where resident_id = v.resident_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'RATE_LIMITED: too many visitor passes today' using errcode = 'P0001'; end if;
  insert into public.visitor_passes (tenant_id, building_id, resident_id, visitor_name, visitor_phone, visit_date, purpose)
  values (v.tenant_id, v.building_id, v.resident_id, trim(p_name), nullif(trim(p_phone), ''), p_date, nullif(trim(p_purpose), ''))
  returning id into v_id;
  perform public._notify_owners(v.tenant_id, 'visitor', 'Visitor pass request: ' || trim(p_name), v.full_name,
                                'visitor_pass', v_id);
  return v_id;
end $$;

create or replace function public.cancel_visitor_pass(p_pass uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._uid();
  update public.visitor_passes set status = 'cancelled'
   where id = p_pass and resident_id in (select public.my_resident_ids()) and status in ('pending','approved');
  if not found then raise exception 'NOT_FOUND: pass not found or can no longer be cancelled' using errcode = 'P0001'; end if;
end $$;

-- Staff: approve | reject a pending pass, or record check_in | check_out of an approved / checked-in pass.
create or replace function public.update_visitor_pass(p_pass uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_p record; v_code text; v_user uuid; v_new text;
begin
  perform public._uid();
  select * into v_p from public.visitor_passes where id = p_pass for update;
  if v_p is null or not public.can_access_building(v_p.tenant_id, v_p.building_id, array['owner','manager']) then
    raise exception 'NOT_FOUND: pass not found' using errcode = 'P0001'; end if;
  v_new := case
    when p_action = 'approve' and v_p.status = 'pending' then 'approved'
    when p_action = 'reject' and v_p.status = 'pending' then 'rejected'
    when p_action = 'check_in' and v_p.status = 'approved' then 'checked_in'
    when p_action = 'check_out' and v_p.status = 'checked_in' then 'checked_out' end;
  if v_new is null then
    raise exception 'BUSINESS_RULE_VIOLATION: cannot % a % pass', p_action, v_p.status using errcode = 'P0001'; end if;
  if v_new = 'approved' then v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)); end if;
  update public.visitor_passes set
    status = v_new,
    pass_code = coalesce(v_code, pass_code),
    decision_note = case when p_action in ('approve','reject') then nullif(trim(p_note), '') else decision_note end,
    decided_by = case when p_action in ('approve','reject') then auth.uid() else decided_by end,
    decided_at = case when p_action in ('approve','reject') then now() else decided_at end,
    checked_in_at = case when v_new = 'checked_in' then now() else checked_in_at end,
    checked_out_at = case when v_new = 'checked_out' then now() else checked_out_at end
  where id = p_pass;
  if p_action in ('approve','reject') then
    select user_id into v_user from public.residents where id = v_p.resident_id;
    perform public._notify(v_p.tenant_id, v_user, 'visitor',
      case when v_new = 'approved' then 'Visitor pass approved · code ' || v_code else 'Visitor pass rejected' end,
      v_p.visitor_name || ' · ' || to_char(v_p.visit_date, 'DD Mon'), 'visitor_pass', p_pass);
  end if;
  perform public.write_audit(v_p.tenant_id, 'visitor_pass.' || v_new, 'visitor_pass', p_pass,
                             jsonb_build_object('status', v_p.status), jsonb_build_object('status', v_new));
  return jsonb_build_object('status', v_new, 'pass_code', v_code);
end $$;

-- ============================================================== chat unread tracking
create or replace function public.mark_channel_read(p_channel uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  perform public._uid();
  if not public.can_read_channel(p_channel) then raise exception 'NOT_FOUND: chat not found' using errcode = 'P0001'; end if;
  select tenant_id into v_tenant from public.chat_channels where id = p_channel;
  insert into public.chat_channel_reads (user_id, tenant_id, channel_id, last_read_at)
  values (auth.uid(), v_tenant, p_channel, now())
  on conflict (user_id, channel_id) do update set last_read_at = now();
end $$;

-- Every chat the caller can read, with its latest message and the caller's unread count.
create or replace function public.my_chat_overview()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by (x->>'last_at') desc nulls last), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'name', c.name, 'building_id', c.building_id,
      'residents_can_post', c.residents_can_post,
      'last_body', m.body, 'last_sender', m.sender_name, 'last_at', m.created_at,
      'unread', (select count(*) from public.chat_messages u
                 where u.channel_id = c.id and u.sender_user_id <> auth.uid()
                   and u.created_at > coalesce((select r.last_read_at from public.chat_channel_reads r
                                                where r.user_id = auth.uid() and r.channel_id = c.id), '-infinity'))
    ) x
    from public.chat_channels c
    left join lateral (select body, sender_name, created_at from public.chat_messages
                       where channel_id = c.id order by created_at desc limit 1) m on true
    where public.can_read_channel(c.id)
  ) s;
$$;

-- ============================================================== birthdays
create or replace function public.set_share_birthday(p_share boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._uid();
  update public.residents set share_birthday = coalesce(p_share, false)
   where id in (select public.my_resident_ids());
end $$;

-- Opted-in residents of the caller's building with a birthday in the next 30 days (first name, room, day).
create or replace function public.building_birthdays()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select * from public._my_stay()),
  b as (
    select split_part(r.full_name, ' ', 1) as first_name, rm.room_number,
           to_char(r.date_of_birth, 'DD Mon') as birthday,
           ((make_date(extract(year from current_date)::int, extract(month from r.date_of_birth)::int,
                       least(extract(day from r.date_of_birth)::int, 28)) - current_date + 366) % 366) as days_away
    from public.resident_room_assignments a
    join public.residents r on r.id = a.resident_id
    join public.rooms rm on rm.id = a.room_id
    join me on me.building_id = a.building_id and me.tenant_id = a.tenant_id
    where a.end_at is null and r.status = 'active' and r.share_birthday and r.date_of_birth is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('first_name', first_name, 'room_number', room_number,
                                               'birthday', birthday, 'days_away', days_away) order by days_away), '[]'::jsonb)
  from b where days_away <= 30;
$$;

-- my_resident_profile gains share_birthday (otherwise identical to migration 11).
create or replace function public.my_resident_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'resident_id', r.id, 'tenant_id', r.tenant_id, 'full_name', r.full_name, 'phone', r.phone, 'email', r.email,
    'business_name', t.business_name, 'building_id', a.building_id, 'building_name', b.name, 'building_address', b.address,
    'floor_name', f.name, 'room_number', rm.room_number, 'sharing', rm.sharing_capacity, 'bed_label', bd.bed_label,
    'admission_date', ad.admission_date, 'monthly_rent', ad.monthly_rent, 'security_deposit', ad.security_deposit,
    'mess_included', ad.mess_included, 'share_birthday', r.share_birthday, 'has_birthday', r.date_of_birth is not null,
    'cutoffs', (select jsonb_build_object('breakfast', s.breakfast_cutoff, 'lunch', s.lunch_cutoff, 'dinner', s.dinner_cutoff, 'allow_reviews', s.allow_reviews)
                from public.meal_settings s where s.tenant_id = r.tenant_id),
    'timezone', t.timezone
  )
  from public.residents r
  join public.tenants t on t.id = r.tenant_id and t.status = 'active'
  join public.resident_room_assignments a on a.resident_id = r.id and a.end_at is null
  join public.buildings b on b.id = a.building_id
  join public.rooms rm on rm.id = a.room_id
  join public.floors f on f.id = rm.floor_id
  join public.beds bd on bd.id = a.bed_id
  join public.admissions ad on ad.id = a.admission_id
  where r.user_id = auth.uid() and r.status = 'active'
  limit 1;
$$;

-- ============================================================== function grants
revoke all on function public.can_see_poll(uuid, uuid) from public, anon;
grant execute on function public.can_see_poll(uuid, uuid) to authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'create_community_post(text, text, text, numeric)', 'respond_community_post(uuid, text, boolean)',
    'create_poll(uuid, text, text[], timestamptz)', 'vote_poll(uuid, uuid)', 'close_poll(uuid)', 'poll_summaries(uuid)',
    'request_visitor_pass(text, text, date, text)', 'cancel_visitor_pass(uuid)', 'update_visitor_pass(uuid, text, text)',
    'mark_channel_read(uuid)', 'my_chat_overview()', 'set_share_birthday(boolean)', 'building_birthdays()',
    'my_resident_profile()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261022000016_staff_aadhar.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration 16: Staff Aadhaar number & Aadhaar document URL
alter table public.staff_members
  add column if not exists aadhar_number text,
  add column if not exists aadhar_image_url text;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261022000017_unified_inventory.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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
