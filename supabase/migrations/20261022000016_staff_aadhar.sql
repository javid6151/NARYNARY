-- Migration 16: Staff Aadhaar number & Aadhaar document URL
alter table public.staff_members
  add column if not exists aadhar_number text,
  add column if not exists aadhar_image_url text;
