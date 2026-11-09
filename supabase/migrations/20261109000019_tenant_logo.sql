-- Migration 19: Add logo_url to public.tenants and expose in my_access() and my_resident_profile()
-- Adds update_tenant_branding() for tenant owners to upload/change PG logo and business name.

alter table public.tenants add column if not exists logo_url text;

-- Expose logo_url in my_access()
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'is_platform_admin', public.is_platform_admin(),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membership_id', m.id, 'tenant_id', m.tenant_id, 'tenant_code', t.tenant_code, 'role', m.role, 'status', m.status,
        'tenant_name', t.business_name, 'tenant_status', t.status, 'logo_url', t.logo_url, 'currency', t.currency, 'timezone', t.timezone,
        'building_ids', case when m.role = 'owner'
            then coalesce((select jsonb_agg(b.id) from public.buildings b where b.tenant_id = m.tenant_id and b.status = 'active'), '[]'::jsonb)
            else coalesce((select jsonb_agg(bm.building_id) from public.building_memberships bm where bm.membership_id = m.id), '[]'::jsonb) end
      ) order by m.created_at)
      from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id
      where m.user_id = auth.uid() and m.status = 'active'), '[]'::jsonb),
    'owned_tenant', (select jsonb_build_object('tenant_id', t.id, 'tenant_code', t.tenant_code, 'status', t.status,
                                               'business_name', t.business_name, 'logo_url', t.logo_url)
                     from public.tenants t where t.owner_user_id = auth.uid() order by t.created_at desc limit 1)
  );
$$;

-- Expose logo_url in my_resident_profile()
create or replace function public.my_resident_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'resident_id', r.id, 'tenant_id', r.tenant_id, 'full_name', r.full_name, 'phone', r.phone, 'email', r.email,
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

-- Secure function for owner to update PG branding (logo and name)
create or replace function public.update_tenant_branding(
  p_logo_url text,
  p_business_name text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tenant_id uuid;
begin
  select t.id into v_tenant_id
  from public.tenants t
  where t.owner_user_id = auth.uid()
  limit 1;

  if v_tenant_id is null then
    select m.tenant_id into v_tenant_id
    from public.tenant_memberships m
    where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    limit 1;
  end if;

  if v_tenant_id is null then
    raise exception 'FORBIDDEN: Only the tenant owner can update PG branding';
  end if;

  update public.tenants
  set
    logo_url = p_logo_url,
    business_name = coalesce(nullif(trim(p_business_name), ''), business_name),
    updated_at = now()
  where id = v_tenant_id;
end;
$$;

revoke all on function public.update_tenant_branding(text, text) from anon, public;
grant execute on function public.update_tenant_branding(text, text) to authenticated;

