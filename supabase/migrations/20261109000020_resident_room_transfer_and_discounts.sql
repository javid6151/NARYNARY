-- Migration 20: resident room transfer/swap, charge editing, and discount waivers without income inflation.

-- 1. Transfer active resident to a vacant bed
create or replace function public.transfer_resident_bed(
  p_resident uuid,
  p_new_bed uuid,
  p_new_rent numeric default null,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_assign record;
  v_bed record;
  v_room record;
  v_tenant uuid;
  v_new_assign uuid;
begin
  -- Find current active assignment
  select a.* into v_assign from public.resident_room_assignments a
  where a.resident_id = p_resident and a.end_at is null;
  if v_assign is null then
    raise exception 'NOT_FOUND: active resident room assignment not found' using errcode = 'P0001';
  end if;

  -- Verify permissions
  if not public.can_access_building(v_assign.tenant_id, v_assign.building_id, array['owner','manager']) then
    raise exception 'FORBIDDEN: access denied' using errcode = 'P0001';
  end if;

  -- Lock and verify the destination bed
  select * into v_bed from public.beds where id = p_new_bed and status = 'active' for update;
  if v_bed is null then
    raise exception 'NOT_FOUND: target bed not found or inactive' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.resident_room_assignments where bed_id = p_new_bed and end_at is null) then
    raise exception 'CONFLICT: target bed is already occupied' using errcode = 'P0001';
  end if;

  select * into v_room from public.rooms where id = v_bed.room_id;
  v_tenant := v_assign.tenant_id;

  -- Perform transfer in trusted context
  perform public._trusted();

  -- End old assignment
  update public.resident_room_assignments
  set end_at = now()
  where id = v_assign.id;

  -- Create new assignment
  insert into public.resident_room_assignments (
    tenant_id, resident_id, admission_id, building_id, room_id, bed_id, start_at, assigned_by
  ) values (
    v_tenant, p_resident, v_assign.admission_id, v_bed.building_id, v_room.id, p_new_bed, now(), auth.uid()
  ) returning id into v_new_assign;

  -- Optionally update monthly rent on active admission if rent changed
  if p_new_rent is not null and p_new_rent > 0 then
    update public.admissions
    set monthly_rent = p_new_rent
    where id = v_assign.admission_id;
  end if;

  -- Write audit record
  perform public.write_audit(
    v_tenant,
    'resident.transferred_bed',
    'resident',
    p_resident,
    jsonb_build_object('old_bed_id', v_assign.bed_id, 'old_room_id', v_assign.room_id),
    jsonb_build_object('new_bed_id', p_new_bed, 'new_room_id', v_room.id, 'notes', p_notes)
  );

  return jsonb_build_object(
    'ok', true,
    'resident_id', p_resident,
    'new_assignment_id', v_new_assign,
    'room_number', v_room.room_number,
    'bed_label', v_bed.bed_label
  );
end $$;

-- 2. Swap active beds between two residents
create or replace function public.swap_resident_beds(
  p_resident_a uuid,
  p_resident_b uuid,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_assign_a record;
  v_assign_b record;
  v_tenant uuid;
begin
  select a.* into v_assign_a from public.resident_room_assignments a
  where a.resident_id = p_resident_a and a.end_at is null;
  if v_assign_a is null then
    raise exception 'NOT_FOUND: active assignment not found for resident A' using errcode = 'P0001';
  end if;

  select a.* into v_assign_b from public.resident_room_assignments a
  where a.resident_id = p_resident_b and a.end_at is null;
  if v_assign_b is null then
    raise exception 'NOT_FOUND: active assignment not found for resident B' using errcode = 'P0001';
  end if;

  if v_assign_a.tenant_id <> v_assign_b.tenant_id then
    raise exception 'CONFLICT: residents must belong to the same tenant' using errcode = 'P0001';
  end if;

  v_tenant := v_assign_a.tenant_id;
  if not public.can_access_building(v_tenant, v_assign_a.building_id, array['owner','manager']) or
     not public.can_access_building(v_tenant, v_assign_b.building_id, array['owner','manager']) then
    raise exception 'FORBIDDEN: access denied' using errcode = 'P0001';
  end if;

  perform public._trusted();

  -- End both assignments
  update public.resident_room_assignments set end_at = now()
  where id in (v_assign_a.id, v_assign_b.id);

  -- Assign A to B's bed
  insert into public.resident_room_assignments (
    tenant_id, resident_id, admission_id, building_id, room_id, bed_id, start_at, assigned_by
  ) values (
    v_tenant, p_resident_a, v_assign_a.admission_id, v_assign_b.building_id, v_assign_b.room_id, v_assign_b.bed_id, now(), auth.uid()
  );

  -- Assign B to A's bed
  insert into public.resident_room_assignments (
    tenant_id, resident_id, admission_id, building_id, room_id, bed_id, start_at, assigned_by
  ) values (
    v_tenant, p_resident_b, v_assign_b.admission_id, v_assign_a.building_id, v_assign_a.room_id, v_assign_a.bed_id, now(), auth.uid()
  );

  perform public.write_audit(
    v_tenant,
    'resident.swapped_beds',
    'resident',
    p_resident_a,
    jsonb_build_object('resident_a', p_resident_a, 'bed_a', v_assign_a.bed_id),
    jsonb_build_object('resident_b', p_resident_b, 'bed_b', v_assign_b.bed_id, 'notes', p_notes)
  );

  return jsonb_build_object('ok', true, 'resident_a', p_resident_a, 'resident_b', p_resident_b);
end $$;

-- 3. Update an existing charge (amount, description, due_date)
create or replace function public.update_charge(
  p_charge uuid,
  p_new_amount numeric,
  p_description text,
  p_due_date date
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_charge record;
begin
  select cb.* into v_charge from public.rent_charge_balances cb where cb.id = p_charge;
  if v_charge is null then
    raise exception 'NOT_FOUND: charge not found' using errcode = 'P0001';
  end if;

  if not public.can_access_building(v_charge.tenant_id, v_charge.building_id, array['owner','manager']) then
    raise exception 'FORBIDDEN: access denied' using errcode = 'P0001';
  end if;

  if p_new_amount is not null and p_new_amount < v_charge.paid_amount then
    raise exception 'VALIDATION_ERROR: new amount cannot be less than already paid amount (%)', v_charge.paid_amount using errcode = 'P0001';
  end if;

  update public.rent_charges
  set
    amount = coalesce(p_new_amount, amount),
    description = coalesce(nullif(trim(p_description), ''), description),
    due_date = coalesce(p_due_date, due_date),
    updated_at = now()
  where id = p_charge;

  perform public._refresh_charge_status(p_charge);
  perform public.write_audit(v_charge.tenant_id, 'charge.updated', 'rent_charge', p_charge,
    jsonb_build_object('old_amount', v_charge.amount, 'new_amount', p_new_amount));

  return jsonb_build_object('ok', true, 'charge_id', p_charge);
end $$;

-- 4. Apply a discount to a charge without recording income/profit
create or replace function public.apply_charge_discount(
  p_charge uuid,
  p_discount numeric,
  p_reason text default 'Discount concession granted'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_charge record;
  v_new_amount numeric(12,2);
begin
  select cb.* into v_charge from public.rent_charge_balances cb where cb.id = p_charge;
  if v_charge is null then
    raise exception 'NOT_FOUND: charge not found' using errcode = 'P0001';
  end if;

  if not public.can_access_building(v_charge.tenant_id, v_charge.building_id, array['owner','manager']) then
    raise exception 'FORBIDDEN: access denied' using errcode = 'P0001';
  end if;

  if coalesce(p_discount, 0) <= 0 then
    raise exception 'VALIDATION_ERROR: discount must be greater than zero' using errcode = 'P0001';
  end if;

  if p_discount > v_charge.balance then
    raise exception 'VALIDATION_ERROR: discount cannot exceed remaining balance (%)', v_charge.balance using errcode = 'P0001';
  end if;

  if p_discount = v_charge.balance and v_charge.paid_amount = 0 then
    -- Full waiver
    update public.rent_charges
    set status = 'waived',
        description = coalesce(description, '') || ' (Waived: ' || coalesce(p_reason, 'Full discount') || ')'
    where id = p_charge;
  else
    -- Partial reduction
    v_new_amount := v_charge.amount - p_discount;
    update public.rent_charges
    set amount = v_new_amount,
        description = coalesce(description, '') || ' (Less ₹' || p_discount::text || ' discount: ' || coalesce(p_reason, 'Concession') || ')'
    where id = p_charge;
  end if;

  perform public._refresh_charge_status(p_charge);
  perform public.write_audit(v_charge.tenant_id, 'charge.discount_applied', 'rent_charge', p_charge,
    null, jsonb_build_object('discount', p_discount, 'reason', p_reason));

  return jsonb_build_object('ok', true, 'charge_id', p_charge, 'discount', p_discount);
end $$;
