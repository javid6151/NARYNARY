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
