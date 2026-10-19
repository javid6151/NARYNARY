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
