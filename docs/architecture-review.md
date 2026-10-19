# Architecture & Readability Review

**Date:** 2026-10-18
**Scope:** whole repository (`src/`, `supabase/`, `scripts/`) checked against `docs/architecture.md` §1–18 and AGENTS.md.
**Mode:** review only — no code changed. Refactor plan in Part 3 is for Phase 2.

> **Tooling note.** The requested "Skills For Real Engineers" plugin skills (`*:improve-codebase-architecture`, `*:codebase-design`) are **not installed in this session** (the skill list and `ListSkills` return nothing for them). This review was done by hand with the same goals: find shallow modules and leaky boundaries, propose deeper modules with small interfaces, and keep every step behaviour-preserving.
>
> **Caveat.** A parallel session ("Add private file uploads") was still editing storage code (`supabase/migrations/20261018000013_storage.sql`, `src/components/Attachments.tsx`, `src/lib/files.ts`, some owner pages) while this was written. Storage findings reflect the state at the time of reading.

---

## Summary

The **database layer is strong**: 50 tables, RLS on every one, tenant-safe composite foreign keys, partial unique indexes for bed occupancy, advisory locks for limits/stock, idempotency keys on money/stock RPCs, 34 audit call sites, and a 74-check RLS/integrity suite (`scripts/rls-test.mjs`).

The **frontend is the weak part**: pages talk to the database directly (86 `supabase.from()` calls in `src/pages`), row shapes are re-typed by hand and forced through `as unknown as` (25 casts), JSX is packed onto very long lines (467 lines over 160 chars in `src/pages`), and page files carry almost no explanatory comments. It works, but a new developer has to read SQL and JSX together to understand any workflow.

The **platform/ops layer is mostly missing**: no background jobs, outbox, CI, E2E tests, password reset, MFA, or trial-expiry enforcement.

| Area | Verdict |
| --- | --- |
| Tenant isolation / RLS / transactional integrity | Implemented, tested |
| Domain workflows (admissions, payments, expenses, maintenance, inventory, staff) | Implemented |
| Auth lifecycle (reset, MFA, revocation) | Partial |
| Subscription lifecycle (trial expiry, invoices, payments) | Partial |
| Jobs, realtime, notifications delivery, observability | Missing / Partial |
| CI, staging, E2E | Missing |
| Frontend structure & readability | Needs refactor (Part 2/3) |

---

## Part 1 — Section-by-section verification against `docs/architecture.md`

Legend: **Implemented** / **Partial** / **Missing**. Paths are clickable; line numbers are from the files as read today.

### §1 Architecture goals — **Partial**
- Multi-tenant shared DB with isolation: Implemented (see §5).
- Platform admin, onboarding approval, multi-building: Implemented — [PlatformApp.tsx](../src/pages/platform/PlatformApp.tsx), `submit_onboarding` / `platform_review_onboarding` / `request_building` / `platform_review_building` in [20261018000008_workflows_core.sql:157-319](../supabase/migrations/20261018000008_workflows_core.sql:157).
- Floors/rooms/beds/admissions/checkout, payments, expenses, complaints, maintenance, staff, kitchen, inventory, communication: Implemented (migrations 2–9, owner pages).
- Four customer portals + platform: Implemented as route trees in [App.tsx:53-75](../src/App.tsx:53). Manager shares `/app` with the owner (owner-only items filtered in [StaffShell.tsx:26-34](../src/layouts/StaffShell.tsx:26)).
- Configurable subscription limits: Implemented for residents/managers/chefs ([workflows_core.sql:404-410](../supabase/migrations/20261018000008_workflows_core.sql:404), [:660](../supabase/migrations/20261018000008_workflows_core.sql:660)).
- "Secure authentication … auditability": Partial — see §3.2 and §13.

### §2 High-level architecture — **Partial**
- One codebase, one Supabase project, shared Postgres: Implemented.
- Service-role key never in the frontend: Implemented — [supabase.ts:10](../src/lib/supabase.ts:10) uses the anon key only; the service key is used only by `scripts/*.mjs` (local tooling).
- "Privileged actions go through trusted server-side code or Edge Functions": Implemented as **security-definer Postgres RPCs** instead of Edge Functions (`supabase/functions/` does not exist). This is a legitimate design choice (atomic, RLS-adjacent) but **diverges from the doc**; architecture.md should be updated to say so.
- Notification Service, Scheduled Jobs/Workers, Email/WhatsApp providers from the diagram: **Missing** (only in-app `notifications` rows + WhatsApp click-to-chat links; README "Known limitations").

### §3 Logical layers — **Partial**
- 3.1 Presentation: Implemented; routes are `/app`, `/kitchen`, `/resident`, `/platform` rather than `/owner`, `/manager`, `/chef` (doc allows renaming). Authorization does not rely on routes — every read is RLS-checked.
- 3.2 Authentication — **Partial**:
  - Email/password sign-in & sign-up: [Login.tsx:17-30](../src/pages/auth/Login.tsx:17). Google OAuth button exists ([Login.tsx:33](../src/pages/auth/Login.tsx:33)) but the provider is not configured in [config.toml](../supabase/config.toml).
  - **Password reset / account recovery: Missing** — no `resetPasswordForEmail` / `updateUser` anywhere in `src`.
  - Verified email: `enable_confirmations = false` in [config.toml:227](../supabase/config.toml:227) (local). **Risk:** `claim_pending_access` ([workflows_core.sql:448](../supabase/migrations/20261018000008_workflows_core.sql:448)) links invitations/resident records by `email_confirmed_at`; with confirmations off, Supabase auto-confirms, so anyone signing up with a resident's email would be linked. Production **must** enable confirmations; add this to the release checklist.
  - Session revocation for suspended accounts: Partial — RLS denies data once the tenant/membership is not active ([identity_tenancy.sql:222](../supabase/migrations/20261018000001_identity_tenancy.sql:222)), but sessions are not revoked and the client still routes a suspended owner to `/app` (empty screens rather than a clear "suspended" state).
- 3.3 Authorization: Implemented — `profiles`, `tenants`, `tenant_memberships`, `building_memberships`, `platform_admins` with helper functions `is_platform_admin`, `has_tenant_role`, `can_access_building` ([identity_tenancy.sql:204-232](../supabase/migrations/20261018000001_identity_tenancy.sql:204), [property.sql:87](../supabase/migrations/20261018000002_property.sql:87)). Platform admins are provisioned only via SQL/service role. **MFA for platform admins: Missing** (`[auth.mfa.totp] enroll_enabled = false`, [config.toml:304](../supabase/config.toml:304); `_require_platform_admin` does not check `aal2`).
- 3.4 Service layer: Implemented as RPCs for onboarding, building approval, admissions, checkout, payments/reversals, subscription changes, inventory, exports (client-side CSV only). **Missing:** resident account *invitation* (residents self-sign-up and are linked by email; no activation link is sent), notification sending, data deletion/export requests.
- 3.5 Data layer: Implemented for Postgres; storage is in progress (see §11).

### §4 Multi-tenant data model — **Partial**
- 4.1 Hierarchy: Implemented exactly (tenant → buildings → floors → rooms → beds; composite FKs).
- 4.2 Tables present (50): all identity/tenancy tables; `tenant_building_requests` is modelled as `buildings.status = 'pending'` (acceptable); properties/occupancy all present; finance present incl. `expense_payments`, `receipt_counters`; operations present as `maintenance_activity`, `meal_reviews`, `inventory_items` (= ingredient_items), `kitchen_daily_reports`, `chat_*`, `notices` (= announcements).
- **Missing tables:** `subscription_invoices`, `subscription_payments`, `maintenance_schedules`, `staff_tasks`, `notification_preferences`, `support_tickets`, `platform_settings`, `feature_flags`, `recipes` (optional), `meal_consumption_records` (covered by kitchen reports + inventory `consume`), and an **outbox** table for external delivery (AGENTS.md §7).

### §5 Tenant isolation & database security — **Implemented**
- RLS enabled on every table (50 tables, 50 `enable row level security` statements across migrations 1–7 and 13).
- Policies check active membership + role + building + tenant `status = 'active'` ([identity_tenancy.sql:212-224](../supabase/migrations/20261018000001_identity_tenancy.sql:212)).
- Composite tenant-safe FKs: [property.sql:33-80](../supabase/migrations/20261018000002_property.sql:33), [residents_admissions.sql:51-54](../supabase/migrations/20261018000003_residents_admissions.sql:51), plus [20261018000012_relationship_fks.sql](../supabase/migrations/20261018000012_relationship_fks.sql).
- One active occupant per bed / one active bed per resident: [residents_admissions.sql:78-79](../supabase/migrations/20261018000003_residents_admissions.sql:78).
- Grants hardened: anon has nothing, authenticated has SELECT + narrow column grants, writes via RPC ([20261018000010_grants.sql](../supabase/migrations/20261018000010_grants.sql)).
- Tested: cross-tenant, manager scope, chef limits, resident privacy, self-grant of platform admin, anon — [rls-test.mjs:41-120](../scripts/rls-test.mjs:41).
- Gaps: **MFA for platform admins** (see §3.3); cross-tenant support access by platform admins is read-wide on some tables without a "justification" record.

### §6 Onboarding & approval — **Partial**
- Steps 1–8 and 10–11 Implemented: restricted `/onboarding` workspace ([Onboarding.tsx](../src/pages/auth/Onboarding.tsx)), `submit_onboarding`, platform review with approve/reject/changes_requested, tenant + building activation, additional building requests.
- Statuses: tenants use `pending/active/changes_requested/rejected/suspended/banned/closed` ([identity_tenancy.sql:89](../supabase/migrations/20261018000001_identity_tenancy.sql:89)); no `draft`/`under_review` (acceptable simplification; document it).
- Step 4 "photos": building photos not collected. Step 9 "notify the owner": in-app notification only, no email.
- Google sign-in for owners (step 1): not configured.

### §7 Resident admission & provisioning — **Partial**
- Admission flow steps 1–6, 8, 10: Implemented — `create_admission`, `review_admission` with bed lock and resident-limit check ([workflows_core.sql:628-764](../supabase/migrations/20261018000008_workflows_core.sql:628)); UI [NewAdmission.tsx](../src/pages/owner/NewAdmission.tsx), [Admissions.tsx](../src/pages/owner/Admissions.tsx).
- Step 7/9 (server creates/invites the auth account and sends a secure activation link): **Missing** — the resident must sign up themselves with the email on file, then `claim_pending_access` links them. No plaintext passwords anywhere (good).
- Tested: concurrent admissions on one bed ([rls-test.mjs:124](../scripts/rls-test.mjs:124)).

### §8 Domain workflows & consistency — **Implemented** (minor gaps)
- 8.1 Vacancy derived from active assignments (`building_layout`); capacity cannot drop below occupancy ([rls-test.mjs:163](../scripts/rls-test.mjs:163)).
- 8.2 Charges vs transactions vs allocations vs receipts; reversals not edits; idempotent `record_payment` ([workflows_operations.sql:68-169](../supabase/migrations/20261018000009_workflows_operations.sql:68)); tested ([rls-test.mjs:137-148](../scripts/rls-test.mjs:137)).
- 8.3 Single expense ledger shared by maintenance; incurred/paid/outstanding tracked; files via storage (in progress).
- 8.4 Store/kitchen locations, typed ledger, no negative stock with advisory lock ([workflows_operations.sql:562-588](../supabase/migrations/20261018000009_workflows_operations.sql:562)). The "owner-enabled audited negative-stock exception" is not implemented (safe default). Meal-change deadline lives in `meal_settings`.
- 8.5 Attendance + daily reports: Implemented (`mark_staff_attendance`, `submit_staff_daily_report`); attachments on daily reports not implemented.
- 8.6 Notices scoped to tenant/building; complaints snapshot room/building; complaint ↔ maintenance linked but distinct.

### §9 Subscription & limits — **Partial**
- Plans configurable by platform admin, no hard-coded price in UI: Implemented (`platform_upsert_plan`, [PlatformApp.tsx:210](../src/pages/platform/PlatformApp.tsx:210)).
- Resident/manager/chef limits enforced server-side: Implemented.
- **Trial expiry: Missing enforcement** — `trial_end` is stored ([identity_tenancy.sql:156](../supabase/migrations/20261018000001_identity_tenancy.sql:156)) but nothing moves a subscription to `expired/read_only`, and no RLS/RPC checks `subscriptions.status`. Grace-period/read-only/export policies undefined.
- `subscription_invoices` / `subscription_payments`: Missing.

### §10 API / service boundaries — **Partial**
- Server side: privileged operations exist as RPCs (names map well: `review_admission` ≈ approveAdmission, `record_payment`, `reverse_payment`, `inventory_move` ≈ postInventoryTransaction, `platform_set_tenant_status` ≈ suspendTenant).
- Client side: **no service/data-access layer.** Only `rpc()`/`q()` wrappers in [api.ts](../src/lib/api.ts); every page builds its own PostgREST query. RPC names and argument names are untyped strings. See Part 2.

### §11 File & storage — **Partial (in progress)**
- Private buckets, server-generated tenant-scoped paths, record-based authorization (`storage_can_read/write`), short-lived signed URLs, type/size validation via `begin_upload`/`complete_upload`: present in [20261018000013_storage.sql](../supabase/migrations/20261018000013_storage.sql) and tested ([rls-test.mjs:188-207](../scripts/rls-test.mjs:188)).
- Covered kinds: resident KYC documents, expense invoices, maintenance attachments. **Not yet:** profile images, payment receipts (PDF), building photos, signed agreements.

### §12 Realtime & background jobs — **Missing**
- No `supabase.channel()` / `postgres_changes` anywhere; **chat polls every 8 s** ([Chat.tsx:64](../src/components/Chat.tsx:64)). Notification bell also polls/reloads.
- **No background jobs**: no pg_cron, no scheduled Edge Functions. Rent reminders, trial reminders/expiry, maintenance reminders, recurring maintenance, report generation, notification retries — all missing. `generate_monthly_charges` exists but is triggered manually from the UI.

### §13 Observability & audit — **Partial**
- Audit: Implemented for approvals, suspensions, membership changes, payments/reversals, expenses, inventory, admissions/checkouts (34 `write_audit` call sites). Viewable by owner ([Reports.tsx:55](../src/pages/owner/Reports.tsx:55)) and platform ([PlatformApp.tsx:254](../src/pages/platform/PlatformApp.tsx:254)).
- **Not audited:** authentication events, CSV exports of sensitive data (client-side CSV, no server record).
- **Monitoring: Missing** — no error reporting, latency metrics, failed-job tracking. `toApiError` logs unexpected errors to the browser console only ([api.ts:24](../src/lib/api.ts:24)).

### §14 Deployment & environments — **Missing (local only)**
- Local dev stack + seeding + RLS suite exist ([README.md](../README.md), [scripts/](../scripts)).
- **No CI** (`.github/` absent), no staging project config, no deployment pipeline, no rollback notes per migration.

### §15 Testing strategy — **Partial**
- Unit: only [format.test.ts](../src/lib/format.test.ts). Rent/allocation/inventory/limit logic lives in SQL and is exercised only via the integration suite.
- Integration/security: strong — 74 checks in [rls-test.mjs](../scripts/rls-test.mjs) cover the AGENTS.md §10 checklist (cross-tenant, manager scope, chef limits, resident privacy, concurrent bed, idempotent payment/inventory, private storage, suspension).
- **E2E: Missing** (no Playwright/Cypress).
- Gaps in the suite: revoked membership loses access (only tenant suspension tested), trial expiry, subscription limits for staff invitations.

### §16 Implementation order — **Followed**
Foundation (tenancy, RLS, transactions) was built before screens; dashboards use real queries (`owner_dashboard_summary`), not placeholders. Step 13 (platform settings, exports) and 14 (full responsive/security pass) remain.

### §17 Decisions to confirm — **Partial (answered implicitly in code, not documented)**
1. Framework: **Vite + React 19 SPA**, not Next.js. 2. Backend: Supabase direct + security-definer RPCs, no separate API. 3. Resident auth: email/password self-sign-up linked by verified email. 4. Buildings: separately approved (yes). 5. Trial expiry: **undecided/unenforced**. 6. Managers: may record payments and expenses; only owners approve admissions and invite staff. 7. Inventory: per building with store + kitchen locations. 8. Messaging provider: **undecided**. 9. Currency: INR default, `tenants.currency` column exists.
→ Recommend recording these as an ADR section in architecture.md.

### §18 Final principle — **Mostly met**
Shared platform, explicit roles, tenant-scoped records, strict policies, audited privileged actions, transactional money/occupancy/inventory: yes. "Clearly separated domains": true in SQL, **not true in the frontend** (Part 2).

### Confirmed gap list
No password-reset flow · MFA for platform admins not enforced · trial expiry not enforced (no job) · no `subscription_invoices` / `maintenance_schedules` / outbox / `support_tickets` / `platform_settings` tables · no background jobs · chat polls instead of Realtime · no CI · no E2E tests · no generated DB types · resident activation link not sent · email confirmations off locally (must be on in prod) · auth events and exports not audited · no monitoring.

---

## Part 2 — Readability

**Question: can a new developer understand every line?** For the SQL, mostly yes (sectioned migrations, named helpers, comments at the top of each block). For the frontend, **no** — not without reading the database schema alongside.

### Measurements (`src/`, today)

| Metric | Value | Worst files |
| --- | --- | --- |
| Lines > 160 chars in `src/pages` | **467** (≈ 520 in all of `src`) | ResidentApp 47, KitchenApp 44, PlatformApp 42, Inventory 33, Expenses 32, Staff 31 |
| `supabase.from()` calls | **92** total, **86** in pages | Settings 11, Reports 9, Residents 9, ResidentApp 9, Expenses 8, Maintenance 7 |
| Lines with untyped `rpc(...)` calls in components/pages | ~35 | PlatformApp 5, Buildings 4, ResidentApp 4 |
| `as unknown as` casts | **25** | Reports 6, PlatformApp 3 |
| Hand-written inline row types | 20 in pages | e.g. [Payments.tsx:12-13](../src/pages/owner/Payments.tsx:12), [PlatformApp.tsx:46,132](../src/pages/platform/PlatformApp.tsx:46) |
| Comment lines in page files | **7 across 20 files** | 15 page files have zero |
| Components per file | PlatformApp 9, ResidentApp 8, KitchenApp 7, Payments 7, Buildings 7 | |
| Generated DB types | none | |
| Formatter | none (no Prettier) | |

### Specific problems

1. **No data-access layer (AGENTS.md §4: "Keep UI, business logic, data access … separated").** Query shape, filters, joins and casting live inside JSX components, e.g. [Reports.tsx:24-32](../src/pages/owner/Reports.tsx:24) — three queries each with a 200+ char inline type. The same tables are queried with different column lists in several places (`residents` in Residents, Payments, NewAdmission; `rent_charge_balances` in Payments, Reports, ResidentApp), so a schema change has to be hunted down by grep.
2. **Types are asserted, not derived.** `as unknown as {…}[]` tells TypeScript to stop checking; a renamed column compiles fine and fails at runtime. Generated `Database` types would turn these into compile errors.
3. **RPC calls are stringly typed.** `rpc('record_payment', { p_resident: …, p_idempotency_key: … })` — a typo in a function or parameter name is only caught at runtime.
4. **Multi-component files.** [PlatformApp.tsx](../src/pages/platform/PlatformApp.tsx) holds the shell + 8 screens/drawers; [ResidentApp.tsx](../src/pages/resident/ResidentApp.tsx) the shell + 7 tabs; [KitchenApp.tsx](../src/pages/chef/KitchenApp.tsx) the shell + 6 screens. Finding "the resident meals screen" means scrolling a 290-line file.
5. **Dense JSX.** Long lines combine layout, data mapping and handlers ([Payments.tsx:73-75](../src/pages/owner/Payments.tsx:73), [Inventory.tsx:61-62](../src/pages/owner/Inventory.tsx:61)); arrays-of-tuples with casts ([Login.tsx:42-53](../src/pages/auth/Login.tsx:42)).
6. **Workflow intent is undocumented in the UI.** Important invariants (idempotency key reused on retry, owner-only actions, why a value is derived) are explained in SQL but not where the button is wired. The one good example is [Expenses.tsx:114](../src/pages/owner/Expenses.tsx:114).
7. **Cross-page imports between pages** (`RecordPaymentDrawer` exported from Payments, `CheckoutDialog` from Buildings) — pages act as component libraries.
8. **Smaller items:** `useAsync` disables exhaustive-deps (callers must pass deps correctly); `localStorage` key `zp.building` duplicated in [auth.tsx](../src/lib/auth.tsx) and [building.tsx](../src/lib/building.tsx); `auth.tsx` picks the *first* owner/manager membership, so a user in two tenants cannot choose.

### What is already good (keep)
`toApiError` with stable codes; `useMutation` double-submit guard; idempotency keys from `newKey()`; shared `ui.tsx` primitives; lazy-loaded routes; strict TS with `noUnused*`.

---

## Part 3 — Refactor plan (Phase 2, no behaviour change)

### Target structure

```text
src/
  app/                       # composition only
    App.tsx                  # routes (moved from src/App.tsx)
    Gate.tsx                 # auth gate + FullLoading
    shells/StaffShell.tsx    # (moved from src/layouts)
  lib/                       # framework glue, no domain knowledge
    supabase.ts              # typed client: createClient<Database>
    database.types.ts        # GENERATED — do not edit
    api.ts                   # rpc<Fn>() typed by Database['public']['Functions'], q(), useAsync, useMutation, errors
    auth.tsx, building.tsx, format.ts, files.ts
  components/                # domain-free UI (ui.tsx, Charts, Logo, BuildingPicker, NotificationBell, Chat, Attachments)
  features/
    onboarding/   { api.ts, types.ts, pages/Onboarding.tsx }
    auth/         { pages/Login.tsx }
    property/     { api.ts, types.ts, pages/Buildings.tsx, components/{FloorDrawer,RoomDrawer,EditRoomDrawer,BuildingRequestDrawer,PendingBuildings,CheckoutDialog}.tsx }
    residents/    { api.ts, types.ts, pages/{Residents,Admissions,NewAdmission}.tsx, components/… }
    billing/      { api.ts, types.ts, pages/Payments.tsx, components/{RecordPaymentDrawer,GenerateDialog,AddChargeDrawer,ReverseDialog,ReceiptView,ResidentSelect}.tsx }
    expenses/     { api.ts, types.ts, pages/Expenses.tsx, components/… }
    maintenance/  { api.ts, types.ts, pages/{Complaints,Maintenance}.tsx, components/… }
    kitchen/      { api.ts, types.ts, pages/{Food,Inventory}.tsx, chef/{KitchenApp,KitchenHome,RecordMeal,KitchenMenu,KitchenStock,KitchenHistory,LineEditor}.tsx }
    staff/        { api.ts, types.ts, pages/Staff.tsx, components/… }
    communication/{ api.ts, types.ts, pages/Communication.tsx }
    reports/      { api.ts, types.ts, pages/{Dashboard,Reports}.tsx }
    settings/     { api.ts, types.ts, pages/Settings.tsx }
    resident-portal/ { ResidentApp.tsx, tabs/{Home,Payments,Meals,Complaints,Notices,Profile}.tsx, ReviewDrawer.tsx }  # uses billing/kitchen/maintenance api
    platform/     { api.ts, types.ts, PlatformApp.tsx, screens/{OnboardingQueue,BuildingQueue,Tenants,Plans,Audit}.tsx, components/{ReviewDrawer,TenantDrawer,PlanDrawer}.tsx }
```

Rules: a page imports only from its own feature, `components/`, and `lib/`; cross-feature reuse goes through that feature's `api.ts` or an explicitly exported component (e.g. `billing/components/RecordPaymentDrawer`), never from another page file.

### Data-access layer (per feature `api.ts`)
- Each function wraps one query/RPC, names the business intent, and returns a type derived from generated types:
  ```ts
  /** Open charges (unpaid or partly paid) for one building, oldest due first. */
  export function listOpenCharges(buildingId: string) {
    return q(supabase.from('rent_charge_balances').select(OPEN_CHARGE_COLUMNS)
      .eq('building_id', buildingId).in('status', ['unpaid', 'partially_paid']).order('due_date'));
  }
  export type OpenCharge = Awaited<ReturnType<typeof listOpenCharges>>[number];
  ```
- Column lists become named constants so the select string and the inferred type stay together; PostgREST type inference from `supabase-js` then removes the `as unknown as` casts. Where inference cannot express a view/join, use a single documented cast inside `api.ts`, never in a component.
- `rpc` gains a typed overload: `rpc<'record_payment'>('record_payment', args)` checks function names and argument names against `Database['public']['Functions']`.
- Queries stay byte-for-byte identical (same columns, filters, ordering) to guarantee no behaviour change.

### Generated types
- Add `"db:types": "supabase gen types typescript --local > src/lib/database.types.ts"` (the `supabase` CLI is already a devDependency — no new dependency).
- Type the client: `createClient<Database>(…)`.
- Document in README: regenerate after every migration.

### Formatting
- Proposal: add **Prettier** (devDependency only, `printWidth: 120`, single quotes, matching current style) plus `npm run format`. Justification: 467+ over-long lines cannot be fixed reliably by hand, and a formatter keeps them fixed. This is a new dependency, so it needs the user's OK; fallback is hand-wrapping lines in files touched by the split (slower, less consistent).

### Comments
- One short header doc comment per module (`/** Payments screen: charges, history, record/reverse payment. Writes go through record_payment / reverse_payment RPCs (idempotent). */`).
- One-line `/** */` on every exported api function and on non-obvious workflow steps (idempotency key reuse, owner-only gates, derived values). No line-by-line narration.

### Step order (each step: `npm run build`, `npx eslint src`, `npm test`)
0. **Safety net:** the folder is not a git repository, so take a full copy of `src/` (and `package.json`) to a backup location before starting (or `git init` + baseline commit if the user prefers).
1. Generate `database.types.ts`, type the Supabase client, add typed `rpc`. Fix only the type errors this surfaces (should be none at runtime).
2. Create `src/app/` (move App, Gate, StaffShell); update imports.
3. Per feature, smallest first (communication → maintenance → expenses → billing → property → residents → kitchen → staff → reports → settings → onboarding/auth): move page, extract `api.ts` + `types.ts`, split extra components into `components/`, remove casts, add doc comments.
4. Split the three portal files (platform, resident-portal, kitchen/chef) into one component per file.
5. Formatting pass (Prettier if approved, otherwise hand-wrap).
6. Update README "Project structure" section.
7. Full verification: `npm run db:reset && npm run seed:dev && npm run test:rls`, then click through all five portals (owner, manager, chef, resident, platform) on the `web` launch config, port 5173.

### Explicitly out of scope for Phase 2 (behaviour changes — separate tasks)
Password reset, platform-admin MFA (`aal2` check), trial-expiry job + enforcement, Realtime chat, outbox + provider delivery, resident activation links, CI pipeline, Playwright E2E, missing tables, audit of exports/auth events, multi-tenant membership switcher.

### Risks
- Moving files breaks lazy-import paths in `App.tsx` → caught by `npm run build`.
- PostgREST type inference on views (`rent_charge_balances`, `inventory_stock`) depends on generated view types; if a join is not inferable, keep one cast inside `api.ts`.
- A parallel session editing the same pages (storage work) would conflict — Phase 2 must start only after it finishes.

---

## Part 4 — Phase 2 results (refactor carried out, 2026-10-18)

The "Skills For Real Engineers" plugin skills were **still not available** in this session; the refactor was done by hand following Part 3.

### What changed (no intended behaviour change)
- `src/pages/*` and `src/layouts/*` replaced by `src/app/` (routes, gate, staff shell) and `src/features/<domain>/` with `api.ts`, `types.ts`, pages and `components/` per domain. See README → *Project structure*.
- Generated `src/lib/database.types.ts`; the Supabase client is typed (`createClient<Database>`); `rpc()` checks function **and argument names** against the generated types. `npm run db:types` (`scripts/gen-types.mjs`) regenerates the file and refuses to overwrite it when generation fails.
- `lib/api.ts` split into data helpers (`api.ts`) and React hooks (`hooks.ts`); auth/building context split into provider + hook files.
- Multi-component files split: PlatformApp (→ 5 screens + 3 drawers), ResidentApp (→ 7 tabs), KitchenApp (→ 6 chef screens), NewAdmission (→ 6 wizard steps), and every owner page's drawers/dialogs.
- Short doc comment on every module, exported api function and non-obvious workflow step.
- Long JSX wrapped by hand (Prettier was **not** added: it is a new dependency and was not approved).

### Measurements before → after
| Metric | Before | After |
| --- | --- | --- |
| Lines > 160 chars in `src` | ≈ 520 | **0** (36 lines between 141–150) |
| `supabase.from()` in components | 86 | **0** (all in feature `api.ts`) |
| `as unknown as` casts | 25, spread through pages | 25, **all in `api.ts`**, each next to a reason (jsonb RPC results / views); many inline row types now inferred instead |
| ESLint | 0 errors, 20 warnings | **0 errors, 0 warnings** |
| Largest file | 331 lines with 7 components | 312 (`ui.tsx`); largest page 246 |

### Small fixes made while moving code (visible but intentional)
- `KitchenApp` wastage reason placeholder contained a corrupted character (`Reason\uFFFD`); now `Reason…`.
- The owner dashboard's side lists and the chef history still load in parallel as before (hooks kept in the page).

### Verification actually run
- After each major step: `npm run build` ✓, `npx eslint src` ✓ (0/0), `npm test` ✓ (7/7).
- `npm run db:reset && npm run seed:dev && npm run test:rls` → **39 passed, 0 failed**.
- Browser click-through on `web` (port 5173): owner (all 15 pages + resident/admission/expense/maintenance/payment drawers, a ₹100 payment recorded), manager (building scope, Settings redirects), chef (home, record-meal, menu, stock with an issue movement, history), resident (all 7 tabs, meal toggle), platform admin (all 5 screens + tenant and review drawers). No console errors.

### Still open (behaviour changes, out of scope for this refactor)
Everything in Part 1's gap list remains: password reset, platform-admin MFA, trial-expiry enforcement/job, Realtime chat, outbox + provider delivery, resident activation links, CI, E2E tests, missing tables, audit of exports/auth events. No git repository exists in this folder; a pre-refactor copy of `src/` was saved outside the repo during the work.
