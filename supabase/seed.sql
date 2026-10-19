-- Platform configuration seed. Values are provisional and editable by a Platform Super Admin
-- in the Platform > Plans screen; nothing in application code depends on them.
insert into public.subscription_plans (name, monthly_price, included_residents, max_managers, max_chefs, trial_days, is_default)
values ('Standard', 4999, 120, 3, 3, 90, true);

-- Development users and sample operations are created by `npm run seed:dev`
-- (scripts/seed-dev.mjs), which exercises the real RPC workflows.
