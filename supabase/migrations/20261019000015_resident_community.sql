-- ---------------------------------------------------------------------------
-- Migration 15: resident community features (resident portal redesign).
--
--   community_posts      lost & found, marketplace (visible to the resident's building),
--                        suggestions and feedback (visible to the author and staff only)
--   polls / poll_options / poll_votes   staff-created polls, one vote per resident (changeable while open)
--   visitor_passes       resident requests, owner/manager approves (pass code), checks in/out
--   chat_channel_reads   per-user "last read" marker → unread counts in the community screen
--   residents.share_birthday            opt-in; only opted-in residents appear in building birthdays
--
-- Same rules as every other table: tenant_id on every row, composite FKs to the tenant's buildings and
-- residents, RLS on, clients only SELECT, all writes through security-definer RPCs that re-check scope.
--
-- Rollback: drop the RPCs below, then drop tables chat_channel_reads, visitor_passes, poll_votes, poll_options,
-- polls, community_posts; alter table residents drop column share_birthday; restore my_resident_profile from migration 11.
-- ---------------------------------------------------------------------------

-- ============================================================== community_posts
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  resident_id uuid not null,
  -- Display name of the author (first name), so other residents never need to read residents rows.
  author_name text not null,
  kind text not null check (kind in ('lost_found','marketplace','suggestion','feedback')),
  title text not null check (length(title) between 3 and 140),
  body text not null check (length(body) between 1 and 2000),
  price numeric(12,2) check (price is null or price >= 0),
  status text not null default 'open' check (status in ('open','closed')),
  staff_response text check (staff_response is null or length(staff_response) <= 2000),
  responded_by uuid references auth.users(id),
  responded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id),
  -- price only makes sense on marketplace listings
  check (price is null or kind = 'marketplace')
);
create index community_posts_lookup on public.community_posts (tenant_id, building_id, kind, status, created_at desc);
create trigger community_posts_touch before update on public.community_posts
  for each row execute function public.touch_updated_at();

alter table public.community_posts enable row level security;
-- Author always; lost & found / marketplace to residents of the same building; staff of the building.
create policy community_posts_select on public.community_posts for select
  using (resident_id in (select public.my_resident_ids())
         or (kind in ('lost_found','marketplace') and building_id in (select public.my_resident_building_ids()))
         or public.can_access_building(tenant_id, building_id, array['owner','manager']));

-- ============================================================== polls
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  building_id uuid,                         -- null = every building of the tenant (owner only)
  question text not null check (length(question) between 5 and 200),
  status text not null default 'open' check (status in ('open','closed')),
  closes_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id)
);
create index polls_lookup on public.polls (tenant_id, building_id, created_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  poll_id uuid not null,
  label text not null check (length(label) between 1 and 100),
  position integer not null,
  unique (tenant_id, id),
  unique (poll_id, position),
  foreign key (tenant_id, poll_id) references public.polls(tenant_id, id) on delete cascade
);

create table public.poll_votes (
  tenant_id uuid not null,
  poll_id uuid not null,
  option_id uuid not null,
  resident_id uuid not null,
  voted_at timestamptz not null default now(),
  primary key (poll_id, resident_id),        -- one vote per resident per poll
  foreign key (tenant_id, poll_id) references public.polls(tenant_id, id) on delete cascade,
  foreign key (tenant_id, option_id) references public.poll_options(tenant_id, id) on delete cascade,
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id)
);

-- Can the current user see this poll? (staff of the building/tenant, or a resident of the building)
create or replace function public.can_see_poll(p_tenant uuid, p_building uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (public.has_tenant_role(p_tenant, array['owner','manager'])
          and (p_building is null or public.can_access_building(p_tenant, p_building, array['owner','manager'])))
      or exists (
        select 1 from public.residents r
        where r.id in (select public.my_resident_ids()) and r.tenant_id = p_tenant
          and (p_building is null or p_building in (select public.my_resident_building_ids())));
$$;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
create policy polls_select on public.polls for select using (public.can_see_poll(tenant_id, building_id));
create policy poll_options_select on public.poll_options for select
  using (exists (select 1 from public.polls p where p.id = poll_id));
-- Individual votes: only your own; staff see totals through poll_summaries().
create policy poll_votes_select on public.poll_votes for select
  using (resident_id in (select public.my_resident_ids()));

-- ============================================================== visitor_passes
create table public.visitor_passes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  resident_id uuid not null,
  visitor_name text not null check (length(visitor_name) between 2 and 80),
  visitor_phone text check (visitor_phone is null or visitor_phone ~ '^\+?[0-9 ]{10,15}$'),
  visit_date date not null,
  purpose text check (purpose is null or length(purpose) <= 200),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled','checked_in','checked_out')),
  pass_code text,                              -- issued on approval, shown to security at the gate
  decision_note text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id),
  foreign key (tenant_id, resident_id) references public.residents(tenant_id, id)
);
create index visitor_passes_lookup on public.visitor_passes (tenant_id, building_id, visit_date desc);
create trigger visitor_passes_touch before update on public.visitor_passes
  for each row execute function public.touch_updated_at();

alter table public.visitor_passes enable row level security;
create policy visitor_passes_select on public.visitor_passes for select
  using (resident_id in (select public.my_resident_ids())
         or public.can_access_building(tenant_id, building_id, array['owner','manager']));

-- ============================================================== chat_channel_reads
create table public.chat_channel_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  channel_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id),
  foreign key (tenant_id, channel_id) references public.chat_channels(tenant_id, id) on delete cascade
);
alter table public.chat_channel_reads enable row level security;
create policy chat_channel_reads_select on public.chat_channel_reads for select using (user_id = auth.uid());

-- ============================================================== birthdays (opt-in)
alter table public.residents add column share_birthday boolean not null default false;

-- ============================================================== grants
grant select on public.community_posts, public.polls, public.poll_options, public.poll_votes,
                public.visitor_passes, public.chat_channel_reads to authenticated;
revoke all on public.community_posts, public.polls, public.poll_options, public.poll_votes,
              public.visitor_passes, public.chat_channel_reads from anon;

-- ============================================================== helpers
-- The caller's active stay (resident, tenant, building, room); raises if the caller is not an active resident.
create or replace function public._my_stay()
returns table (resident_id uuid, tenant_id uuid, building_id uuid, room_id uuid, full_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._uid();
  return query
    select a.resident_id, a.tenant_id, a.building_id, a.room_id, r.full_name
    from public.resident_room_assignments a join public.residents r on r.id = a.resident_id
    where a.end_at is null and a.resident_id in (select public.my_resident_ids())
    limit 1;
  if not found then
    raise exception 'FORBIDDEN: only active residents can do this' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public._my_stay() from public, anon, authenticated;

-- ============================================================== community post RPCs
create or replace function public.create_community_post(p_kind text, p_title text, p_body text, p_price numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v record; v_id uuid;
begin
  select * into v from public._my_stay();
  if p_kind not in ('lost_found','marketplace','suggestion','feedback') then
    raise exception 'VALIDATION_ERROR: invalid post type' using errcode = 'P0001'; end if;
  if (select count(*) from public.community_posts where resident_id = v.resident_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED: too many posts in the last hour' using errcode = 'P0001'; end if;
  insert into public.community_posts (tenant_id, building_id, resident_id, author_name, kind, title, body, price)
  values (v.tenant_id, v.building_id, v.resident_id, split_part(v.full_name, ' ', 1), p_kind, trim(p_title), trim(p_body),
          case when p_kind = 'marketplace' then p_price end)
  returning id into v_id;
  if p_kind in ('suggestion','feedback') then
    perform public._notify_owners(v.tenant_id, 'community', 'New ' || p_kind || ': ' || trim(p_title), v.full_name,
                                  'community_post', v_id);
  end if;
  return v_id;
end $$;

-- Author closes their own post; owner/manager of the building may close it and/or reply.
create or replace function public.respond_community_post(p_post uuid, p_response text default null, p_close boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_p record; v_staff boolean; v_user uuid;
begin
  perform public._uid();
  select * into v_p from public.community_posts where id = p_post for update;
  if v_p is null then raise exception 'NOT_FOUND: post not found' using errcode = 'P0001'; end if;
  v_staff := public.can_access_building(v_p.tenant_id, v_p.building_id, array['owner','manager']);
  if not v_staff and v_p.resident_id not in (select public.my_resident_ids()) then
    raise exception 'NOT_FOUND: post not found' using errcode = 'P0001'; end if;
  if p_response is not null and not v_staff then
    raise exception 'FORBIDDEN: only staff can reply' using errcode = 'P0001'; end if;
  update public.community_posts set
    staff_response = coalesce(nullif(trim(p_response), ''), staff_response),
    responded_by = case when p_response is not null then auth.uid() else responded_by end,
    responded_at = case when p_response is not null then now() else responded_at end,
    status = case when p_close then 'closed' else status end,
    closed_at = case when p_close then now() else closed_at end
  where id = p_post;
  if v_staff and p_response is not null then
    select user_id into v_user from public.residents where id = v_p.resident_id;
    perform public._notify(v_p.tenant_id, v_user, 'community', 'Reply to: ' || v_p.title, trim(p_response),
                           'community_post', p_post);
  end if;
end $$;

-- ============================================================== poll RPCs
create or replace function public.create_poll(p_building uuid, p_question text, p_options text[], p_closes_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_id uuid; v_i integer := 0; v_opt text;
begin
  perform public._uid();
  if p_building is null then
    select m.tenant_id into v_tenant from public.tenant_memberships m join public.tenants t on t.id = m.tenant_id and t.status = 'active'
      where m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active' limit 1;
    if v_tenant is null then raise exception 'FORBIDDEN: only the owner can poll every building' using errcode = 'P0001'; end if;
  else
    v_tenant := public._require_building(p_building, array['owner','manager']);
  end if;
  if coalesce(array_length(p_options, 1), 0) not between 2 and 6 then
    raise exception 'VALIDATION_ERROR: a poll needs 2 to 6 options' using errcode = 'P0001'; end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'VALIDATION_ERROR: closing time must be in the future' using errcode = 'P0001'; end if;
  insert into public.polls (tenant_id, building_id, question, closes_at, created_by)
  values (v_tenant, p_building, trim(p_question), p_closes_at, auth.uid()) returning id into v_id;
  foreach v_opt in array p_options loop
    if length(trim(v_opt)) = 0 then raise exception 'VALIDATION_ERROR: options cannot be empty' using errcode = 'P0001'; end if;
    v_i := v_i + 1;
    insert into public.poll_options (tenant_id, poll_id, label, position) values (v_tenant, v_id, trim(v_opt), v_i);
  end loop;
  perform public._notify_building_residents(v_tenant, p_building, 'poll', 'New poll', trim(p_question));
  perform public.write_audit(v_tenant, 'poll.created', 'poll', v_id, null, jsonb_build_object('question', trim(p_question)));
  return v_id;
end $$;

-- One vote per resident; voting again while the poll is open changes the vote.
create or replace function public.vote_poll(p_poll uuid, p_option uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v record; v_p record;
begin
  select * into v from public._my_stay();
  select * into v_p from public.polls where id = p_poll and tenant_id = v.tenant_id
    and (building_id is null or building_id = v.building_id);
  if v_p is null then raise exception 'NOT_FOUND: poll not found' using errcode = 'P0001'; end if;
  if v_p.status <> 'open' or (v_p.closes_at is not null and v_p.closes_at <= now()) then
    raise exception 'BUSINESS_RULE_VIOLATION: this poll is closed' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.poll_options where id = p_option and poll_id = p_poll) then
    raise exception 'VALIDATION_ERROR: invalid option' using errcode = 'P0001'; end if;
  insert into public.poll_votes (tenant_id, poll_id, option_id, resident_id)
  values (v.tenant_id, p_poll, p_option, v.resident_id)
  on conflict (poll_id, resident_id) do update set option_id = excluded.option_id, voted_at = now();
end $$;

create or replace function public.close_poll(p_poll uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_p record;
begin
  perform public._uid();
  select * into v_p from public.polls where id = p_poll;
  if v_p is null or not (
       (v_p.building_id is null and public.has_tenant_role(v_p.tenant_id, array['owner']))
    or (v_p.building_id is not null and public.can_access_building(v_p.tenant_id, v_p.building_id, array['owner','manager']))) then
    raise exception 'NOT_FOUND: poll not found' using errcode = 'P0001'; end if;
  update public.polls set status = 'closed' where id = p_poll;
end $$;

-- Visible polls (newest first) with option vote counts and the caller's own vote.
create or replace function public.poll_summaries(p_building uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', p.id, 'question', p.question, 'building_id', p.building_id, 'created_at', p.created_at,
      'closes_at', p.closes_at,
      'status', case when p.status = 'open' and p.closes_at is not null and p.closes_at <= now() then 'closed' else p.status end,
      'total_votes', (select count(*) from public.poll_votes v where v.poll_id = p.id),
      'my_option', (select v.option_id from public.poll_votes v where v.poll_id = p.id
                     and v.resident_id in (select public.my_resident_ids())),
      'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label,
                    'votes', (select count(*) from public.poll_votes v where v.option_id = o.id)) order by o.position)
                  from public.poll_options o where o.poll_id = p.id)
    ) x
    from public.polls p
    where public.can_see_poll(p.tenant_id, p.building_id)
      and (p_building is null or p.building_id is null or p.building_id = p_building)
  ) s;
$$;

-- ============================================================== visitor pass RPCs
create or replace function public.request_visitor_pass(p_name text, p_phone text, p_date date, p_purpose text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v record; v_id uuid;
begin
  select * into v from public._my_stay();
  if p_date < public._tenant_today(v.tenant_id) or p_date > public._tenant_today(v.tenant_id) + 30 then
    raise exception 'VALIDATION_ERROR: visit date must be within the next 30 days' using errcode = 'P0001'; end if;
  if (select count(*) from public.visitor_passes where resident_id = v.resident_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'RATE_LIMITED: too many visitor passes today' using errcode = 'P0001'; end if;
  insert into public.visitor_passes (tenant_id, building_id, resident_id, visitor_name, visitor_phone, visit_date, purpose)
  values (v.tenant_id, v.building_id, v.resident_id, trim(p_name), nullif(trim(p_phone), ''), p_date, nullif(trim(p_purpose), ''))
  returning id into v_id;
  perform public._notify_owners(v.tenant_id, 'visitor', 'Visitor pass request: ' || trim(p_name), v.full_name,
                                'visitor_pass', v_id);
  return v_id;
end $$;

create or replace function public.cancel_visitor_pass(p_pass uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._uid();
  update public.visitor_passes set status = 'cancelled'
   where id = p_pass and resident_id in (select public.my_resident_ids()) and status in ('pending','approved');
  if not found then raise exception 'NOT_FOUND: pass not found or can no longer be cancelled' using errcode = 'P0001'; end if;
end $$;

-- Staff: approve | reject a pending pass, or record check_in | check_out of an approved / checked-in pass.
create or replace function public.update_visitor_pass(p_pass uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_p record; v_code text; v_user uuid; v_new text;
begin
  perform public._uid();
  select * into v_p from public.visitor_passes where id = p_pass for update;
  if v_p is null or not public.can_access_building(v_p.tenant_id, v_p.building_id, array['owner','manager']) then
    raise exception 'NOT_FOUND: pass not found' using errcode = 'P0001'; end if;
  v_new := case
    when p_action = 'approve' and v_p.status = 'pending' then 'approved'
    when p_action = 'reject' and v_p.status = 'pending' then 'rejected'
    when p_action = 'check_in' and v_p.status = 'approved' then 'checked_in'
    when p_action = 'check_out' and v_p.status = 'checked_in' then 'checked_out' end;
  if v_new is null then
    raise exception 'BUSINESS_RULE_VIOLATION: cannot % a % pass', p_action, v_p.status using errcode = 'P0001'; end if;
  if v_new = 'approved' then v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)); end if;
  update public.visitor_passes set
    status = v_new,
    pass_code = coalesce(v_code, pass_code),
    decision_note = case when p_action in ('approve','reject') then nullif(trim(p_note), '') else decision_note end,
    decided_by = case when p_action in ('approve','reject') then auth.uid() else decided_by end,
    decided_at = case when p_action in ('approve','reject') then now() else decided_at end,
    checked_in_at = case when v_new = 'checked_in' then now() else checked_in_at end,
    checked_out_at = case when v_new = 'checked_out' then now() else checked_out_at end
  where id = p_pass;
  if p_action in ('approve','reject') then
    select user_id into v_user from public.residents where id = v_p.resident_id;
    perform public._notify(v_p.tenant_id, v_user, 'visitor',
      case when v_new = 'approved' then 'Visitor pass approved · code ' || v_code else 'Visitor pass rejected' end,
      v_p.visitor_name || ' · ' || to_char(v_p.visit_date, 'DD Mon'), 'visitor_pass', p_pass);
  end if;
  perform public.write_audit(v_p.tenant_id, 'visitor_pass.' || v_new, 'visitor_pass', p_pass,
                             jsonb_build_object('status', v_p.status), jsonb_build_object('status', v_new));
  return jsonb_build_object('status', v_new, 'pass_code', v_code);
end $$;

-- ============================================================== chat unread tracking
create or replace function public.mark_channel_read(p_channel uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  perform public._uid();
  if not public.can_read_channel(p_channel) then raise exception 'NOT_FOUND: chat not found' using errcode = 'P0001'; end if;
  select tenant_id into v_tenant from public.chat_channels where id = p_channel;
  insert into public.chat_channel_reads (user_id, tenant_id, channel_id, last_read_at)
  values (auth.uid(), v_tenant, p_channel, now())
  on conflict (user_id, channel_id) do update set last_read_at = now();
end $$;

-- Every chat the caller can read, with its latest message and the caller's unread count.
create or replace function public.my_chat_overview()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by (x->>'last_at') desc nulls last), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'name', c.name, 'building_id', c.building_id,
      'residents_can_post', c.residents_can_post,
      'last_body', m.body, 'last_sender', m.sender_name, 'last_at', m.created_at,
      'unread', (select count(*) from public.chat_messages u
                 where u.channel_id = c.id and u.sender_user_id <> auth.uid()
                   and u.created_at > coalesce((select r.last_read_at from public.chat_channel_reads r
                                                where r.user_id = auth.uid() and r.channel_id = c.id), '-infinity'))
    ) x
    from public.chat_channels c
    left join lateral (select body, sender_name, created_at from public.chat_messages
                       where channel_id = c.id order by created_at desc limit 1) m on true
    where public.can_read_channel(c.id)
  ) s;
$$;

-- ============================================================== birthdays
create or replace function public.set_share_birthday(p_share boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._uid();
  update public.residents set share_birthday = coalesce(p_share, false)
   where id in (select public.my_resident_ids());
end $$;

-- Opted-in residents of the caller's building with a birthday in the next 30 days (first name, room, day).
create or replace function public.building_birthdays()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select * from public._my_stay()),
  b as (
    select split_part(r.full_name, ' ', 1) as first_name, rm.room_number,
           to_char(r.date_of_birth, 'DD Mon') as birthday,
           ((make_date(extract(year from current_date)::int, extract(month from r.date_of_birth)::int,
                       least(extract(day from r.date_of_birth)::int, 28)) - current_date + 366) % 366) as days_away
    from public.resident_room_assignments a
    join public.residents r on r.id = a.resident_id
    join public.rooms rm on rm.id = a.room_id
    join me on me.building_id = a.building_id and me.tenant_id = a.tenant_id
    where a.end_at is null and r.status = 'active' and r.share_birthday and r.date_of_birth is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('first_name', first_name, 'room_number', room_number,
                                               'birthday', birthday, 'days_away', days_away) order by days_away), '[]'::jsonb)
  from b where days_away <= 30;
$$;

-- my_resident_profile gains share_birthday (otherwise identical to migration 11).
create or replace function public.my_resident_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'resident_id', r.id, 'tenant_id', r.tenant_id, 'full_name', r.full_name, 'phone', r.phone, 'email', r.email,
    'business_name', t.business_name, 'building_id', a.building_id, 'building_name', b.name, 'building_address', b.address,
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

-- ============================================================== function grants
revoke all on function public.can_see_poll(uuid, uuid) from public, anon;
grant execute on function public.can_see_poll(uuid, uuid) to authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'create_community_post(text, text, text, numeric)', 'respond_community_post(uuid, text, boolean)',
    'create_poll(uuid, text, text[], timestamptz)', 'vote_poll(uuid, uuid)', 'close_poll(uuid)', 'poll_summaries(uuid)',
    'request_visitor_pass(text, text, date, text)', 'cancel_visitor_pass(uuid)', 'update_visitor_pass(uuid, text, text)',
    'mark_channel_read(uuid)', 'my_chat_overview()', 'set_share_birthday(boolean)', 'building_birthdays()',
    'my_resident_profile()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
