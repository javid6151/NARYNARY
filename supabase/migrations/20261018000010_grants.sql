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
