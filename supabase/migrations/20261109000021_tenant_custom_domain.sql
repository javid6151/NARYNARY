-- Migration: Add custom_domain to tenants
-- Allows PG owners to specify a custom domain or resident portal web address.
-- If not set, resident portal URL dynamically resolves from current browser domain/host.

alter table public.tenants add column if not exists custom_domain text;
