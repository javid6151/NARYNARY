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
