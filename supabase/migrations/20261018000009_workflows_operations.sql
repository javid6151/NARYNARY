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
