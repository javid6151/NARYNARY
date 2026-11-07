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
  if v_a is null or (auth.uid() is not null and not (public.is_platform_admin() or public.can_access_building(v_a.tenant_id, v_a.building_id, array['owner','manager']))) then
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
