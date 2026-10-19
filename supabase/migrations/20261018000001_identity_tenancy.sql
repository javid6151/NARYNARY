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
