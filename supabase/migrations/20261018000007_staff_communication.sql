-- Migration 7: staff roster & payroll, attendance, daily reports, notices, notifications, chat.

-- Operational staff (warden, cook, cleaning, security...). They may or may not have a login;
-- login-enabled staff link to a tenant_membership.
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  membership_id uuid references public.tenant_memberships(id) on delete set null,
  full_name text not null,
  role text not null check (role in ('warden','cook','kitchen_helper','cleaning','security','helper','driver','manager','other')),
  phone text,
  joining_date date,
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary >= 0),
  pay_day integer check (pay_day between 1 and 28),
  status text not null default 'active' check (status in ('active','on_leave','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id)
);
create trigger staff_members_touch before update on public.staff_members
  for each row execute function public.touch_updated_at();

create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  staff_member_id uuid not null,
  attendance_date date not null,
  status text not null check (status in ('present','absent','late','half_day','leave','off_day')),
  notes text,
  marked_by uuid not null references auth.users(id),
  marked_at timestamptz not null default now(),
  unique (staff_member_id, attendance_date),
  foreign key (tenant_id, staff_member_id) references public.staff_members(tenant_id, id)
);
create index staff_attendance_date on public.staff_attendance (building_id, attendance_date);

create table public.staff_daily_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  staff_member_id uuid not null,
  report_date date not null,
  work_summary text not null check (length(work_summary) <= 2000),
  recorded_by uuid not null references auth.users(id),
  status text not null default 'submitted' check (status in ('draft','submitted','reviewed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (staff_member_id, report_date),
  foreign key (tenant_id, staff_member_id) references public.staff_members(tenant_id, id)
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  building_id uuid,
  title text not null check (length(title) between 3 and 140),
  body text not null check (length(body) <= 4000),
  category text not null default 'announcement'
    check (category in ('announcement','important','event','food_menu','maintenance')),
  status text not null default 'published' check (status in ('draft','published','archived')),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notices_lookup on public.notices (tenant_id, building_id, status, published_at desc);

create table public.notice_reads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  notice_id uuid not null references public.notices(id) on delete cascade,
  resident_id uuid not null,
  read_at timestamptz not null default now(),
  unique (notice_id, resident_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);

-- Chat: building-wide, floor, room, staff groups and direct threads.
create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  building_id uuid not null,
  kind text not null check (kind in ('building','floor','room','staff','custom')),
  name text not null,
  floor_id uuid,
  room_id uuid,
  residents_can_post boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, building_id) references public.buildings(tenant_id, id) on delete cascade
);
create unique index chat_channel_room on public.chat_channels (room_id) where kind = 'room';
create unique index chat_channel_floor on public.chat_channels (floor_id) where kind = 'floor';
create unique index chat_channel_building on public.chat_channels (building_id) where kind = 'building';

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  channel_id uuid not null,
  sender_user_id uuid not null references auth.users(id),
  sender_name text not null,
  sender_is_staff boolean not null default false,
  body text not null check (length(body) between 1 and 2000),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, channel_id) references public.chat_channels(tenant_id, id) on delete cascade
);
create index chat_messages_channel on public.chat_messages (channel_id, created_at desc);

-- Can the current user read a given chat channel?
create or replace function public.can_read_channel(p_channel uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_channels c
    where c.id = p_channel and (
      public.can_access_building(c.tenant_id, c.building_id, array['owner','manager'])
      or (c.kind <> 'staff' and exists (
        select 1 from public.resident_room_assignments a
        join public.rooms r on r.id = a.room_id
        where a.end_at is null and a.resident_id in (select public.my_resident_ids())
          and a.building_id = c.building_id
          and (c.kind in ('building','custom')
               or (c.kind = 'room' and c.room_id = a.room_id)
               or (c.kind = 'floor' and c.floor_id = r.floor_id))
      ))
      or (c.kind = 'staff' and public.can_access_building(c.tenant_id, c.building_id, array['chef']))
    )
  );
$$;

alter table public.staff_members enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.staff_daily_reports enable row level security;
alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;

-- Salary data is owner-only; managers see roster for their buildings via staff_roster view.
create policy staff_members_select on public.staff_members for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));
create policy staff_attendance_select on public.staff_attendance for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));
create policy staff_reports_select on public.staff_daily_reports for select
  using (public.can_access_building(tenant_id, building_id, array['owner','manager']));

create policy notices_select on public.notices for select
  using (public.has_tenant_role(tenant_id, array['owner','manager','chef'])
         and (building_id is null or public.can_access_building(tenant_id, building_id))
      or (status = 'published' and (expires_at is null or expires_at > now())
          and tenant_id in (select r.tenant_id from public.residents r where r.id in (select public.my_resident_ids()))
          and (building_id is null or building_id in (select public.my_resident_building_ids()))));

create policy notice_reads_select on public.notice_reads for select
  using (resident_id in (select public.my_resident_ids()) or public.has_tenant_role(tenant_id, array['owner','manager']));

create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chat_channels_select on public.chat_channels for select using (public.can_read_channel(id));
create policy chat_messages_select on public.chat_messages for select using (public.can_read_channel(channel_id));
