-- Migration 22: Human-readable Unique Resident ID (e.g. RES-000001)
-- Assigns a permanent, human-readable unique code to each resident for easy reference,
-- receipts, KYC identification, and portal login.

create sequence if not exists public.resident_code_seq start 1;

alter table public.residents
  add column if not exists resident_code text;

-- Backfill existing residents in creation order
update public.residents r
   set resident_code = 'RES-' || lpad(nextval('public.resident_code_seq')::text, 6, '0')
  from (select id from public.residents order by created_at, id) o
 where o.id = r.id and r.resident_code is null;

-- Set default for newly admitted residents
alter table public.residents
  alter column resident_code set default ('RES-' || lpad(nextval('public.resident_code_seq')::text, 6, '0'));

-- Update resident_directory view to include resident_code
create or replace view public.resident_directory with (security_invoker = true) as
select r.id, coalesce(r.resident_code, 'RES-' || lpad(abs(hashtext(r.id::text)) % 1000000, 6, '0')) as resident_code,
       r.tenant_id, r.full_name, r.phone, r.email, r.status, r.user_id is not null as has_login, r.created_at,
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

-- Expose resident_code in my_resident_profile()
create or replace function public.my_resident_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'resident_id', r.id,
    'resident_code', coalesce(r.resident_code, 'RES-' || lpad(abs(hashtext(r.id::text)) % 1000000, 6, '0')),
    'tenant_id', r.tenant_id, 'full_name', r.full_name, 'phone', r.phone, 'email', r.email,
    'business_name', t.business_name, 'logo_url', t.logo_url, 'building_id', a.building_id, 'building_name', b.name, 'building_address', b.address,
    'pg_phone', t.phone, 'pg_email', t.email,
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

