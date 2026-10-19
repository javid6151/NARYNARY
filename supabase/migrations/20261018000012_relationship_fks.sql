-- Migration 12: explicit tenant-safe foreign keys that were implied but not declared.
-- They enforce location integrity and let PostgREST embed related rows.
-- Composite keys include tenant_id so a row can never point at another tenant's building/room.

alter table public.admissions
  add constraint admissions_building_fk foreign key (tenant_id, building_id) references public.buildings(tenant_id, id);

alter table public.complaints
  add constraint complaints_room_fk foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id);

alter table public.maintenance_requests
  add constraint maintenance_floor_fk foreign key (tenant_id, building_id, floor_id) references public.floors(tenant_id, building_id, id),
  add constraint maintenance_room_fk foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id);

alter table public.resident_room_assignments
  add constraint assignments_room_fk foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id);

alter table public.expenses
  add constraint expenses_floor_fk foreign key (tenant_id, building_id, floor_id) references public.floors(tenant_id, building_id, id),
  add constraint expenses_room_fk foreign key (tenant_id, building_id, room_id) references public.rooms(tenant_id, building_id, id);

alter table public.meal_availability
  add constraint meal_availability_building_fk foreign key (tenant_id, building_id) references public.buildings(tenant_id, id);

alter table public.staff_attendance
  add constraint staff_attendance_building_fk foreign key (tenant_id, building_id) references public.buildings(tenant_id, id);
