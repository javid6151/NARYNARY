# ZIPCO Solutions PG SaaS — Database Design

**Product:** PG & Hostel Management SaaS  
**Database:** Supabase PostgreSQL  
**Document:** `database.md`  
**Version:** 1.0  
**Status:** Proposed schema for review; validate against the existing repository before migration  
**Default currency:** INR (`INR`)

---

## 1. Database Design Principles

1. **One shared SaaS database initially:** all customers use the same Supabase project, with strict tenant isolation.
2. **Tenant-owned data:** every business record belongs to one `tenant_id`; building-specific records also reference a `building_id`.
3. **Database-enforced security:** enable Row-Level Security (RLS) on every tenant-owned table.
4. **No trusted client-side roles:** roles and memberships come from protected database records, not browser storage.
5. **Transactional business operations:** admissions, bed allocation, payments, and inventory movements must be atomic.
6. **Preserve history:** do not overwrite or delete financial, attendance, inventory, or audit history to correct a mistake; use adjustments where appropriate.
7. **Derived values:** occupancy, balances, and stock on hand should be derived from source records or maintained through controlled transactional logic.
8. **Private files:** documents, receipts, invoices, and resident KYC files are stored in private Supabase Storage buckets.
9. **Consistent IDs and timestamps:** use UUID primary keys and `timestamptz` timestamps.
10. **Migrations first:** implement changes through reviewed SQL migrations, not manual production edits.

This document is a logical schema proposal. It is not a ready-to-run migration until the existing codebase, Supabase version/configuration, and business rules are confirmed.

---

## 2. Tenant and User Hierarchy

```text
ZIPCO Platform
├── platform_admins
└── tenants (one PG business/customer)
    ├── tenant_memberships
    │   ├── owner (one active primary owner)
    │   ├── managers (maximum configured count; currently discussed max 3)
    │   ├── chefs (maximum configured count; currently discussed max 3)
    │   └── residents
    ├── buildings (one or many approved buildings)
    │   └── floors
    │       └── rooms
    │           └── beds
    ├── admissions / resident assignments
    ├── rent charges / payments / receipts
    ├── expenses / maintenance
    ├── inventory / kitchen records
    ├── staff attendance / daily reports
    └── notices / complaints / communications
```

A **tenant** is one PG business/customer account. A tenant may own or operate multiple buildings. A resident account belongs to a tenant and has an active or historical assignment to a bed/room/building.

The ZIPCO Platform Super Admin is separate from a PG Owner. Platform administrators must be explicitly provisioned and audited.

---

## 3. Common Data Conventions

### 3.1 Primary keys
Use `uuid` primary keys, normally with `gen_random_uuid()` defaults.

### 3.2 Timestamps
Use:
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Maintain `updated_at` with a database trigger or a consistent server-side update strategy.

### 3.3 Monetary values
Use `numeric(12,2)` for currency values. Avoid floating-point types for money. Store currency as an ISO currency code where multi-currency support is planned; default `INR`.

### 3.4 Quantities
Use `numeric(12,3)` for measured stock quantities where fractional units are valid. Store the unit explicitly (`kg`, `g`, `litre`, `piece`, etc.).

### 3.5 Status fields
Use checked text values or PostgreSQL enums. For early product iteration, checked text values may be easier to evolve. Status transitions must still be validated by server-side business logic.

### 3.6 Soft deletion
Use `archived_at` or `is_active` for records that should no longer appear in active lists. Do not hard-delete financial transactions, resident history, or audit records.

---

## 4. Core Identity and SaaS Tables

### 4.1 `profiles`
One application profile per Supabase Auth user.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Must reference `auth.users(id)` |
| `full_name` | `text` | Display name |
| `phone` | `text` | Normalize and validate |
| `avatar_path` | `text` | Private/public policy depends on image sensitivity |
| `created_at` | `timestamptz` | Creation time |
| `updated_at` | `timestamptz` | Last update |

Do not store passwords in this table. Supabase Auth manages credentials.

### 4.2 `platform_admins`
Explicit allow-list for ZIPCO platform administrators.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` PK/FK | References `auth.users(id)` |
| `status` | `text` | `active`, `disabled` |
| `created_by` | `uuid` | Provisioning admin, if applicable |
| `created_at` | `timestamptz` | Audit timestamp |

Only trusted server-side provisioning may add platform admins.

### 4.3 `tenants`
One customer PG business.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Tenant ID |
| `business_name` | `text` | Customer/business name |
| `owner_user_id` | `uuid` FK | Primary owner |
| `phone` | `text` | Contact phone |
| `email` | `text` | Contact email |
| `status` | `text` | `pending`, `active`, `changes_requested`, `rejected`, `suspended`, `banned`, `closed` |
| `approved_at` | `timestamptz` | Platform approval time |
| `approved_by` | `uuid` | Platform admin ID |
| `timezone` | `text` | IANA timezone; default appropriate to customer |
| `currency` | `text` | Default `INR` |
| `created_at` | `timestamptz` | Creation time |
| `updated_at` | `timestamptz` | Last update |

Use constraints to prevent multiple active primary-owner memberships if the business rules require exactly one owner per tenant.

### 4.4 `tenant_memberships`
Maps users to a customer and role.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Membership ID |
| `tenant_id` | `uuid` FK | Customer tenant |
| `user_id` | `uuid` FK | Auth user |
| `role` | `text` | `owner`, `manager`, `chef`, `resident` |
| `status` | `text` | `invited`, `active`, `suspended`, `revoked` |
| `invited_by` | `uuid` | Inviting user |
| `joined_at` | `timestamptz` | Activation time |
| `created_at` | `timestamptz` | Creation time |

Add a unique constraint on `(tenant_id, user_id)` unless multi-role membership is explicitly required. If a user needs multiple roles within one tenant, model roles separately instead of duplicating membership rows.

Manager/chef account limits must be enforced transactionally in trusted backend code. Do not rely only on frontend validation.

### 4.5 `building_memberships`
Optional mapping for managers/chefs restricted to selected buildings.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Mapping ID |
| `tenant_id` | `uuid` FK | Tenant |
| `building_id` | `uuid` FK | Building |
| `membership_id` | `uuid` FK | User's tenant membership |
| `created_at` | `timestamptz` | Mapping time |

Use a unique constraint on `(building_id, membership_id)` and enforce that both records belong to the same tenant.

### 4.6 `tenant_onboarding_requests`
Stores the owner's onboarding form and approval history.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Request ID |
| `tenant_id` | `uuid` FK | Tenant being requested |
| `submitted_by` | `uuid` FK | Owner user |
| `status` | `text` | `draft`, `submitted`, `under_review`, `changes_requested`, `approved`, `rejected` |
| `contact_details` | `jsonb` | Flexible initial form data |
| `business_details` | `jsonb` | Business details |
| `review_notes` | `text` | Admin notes |
| `reviewed_by` | `uuid` | Platform admin |
| `reviewed_at` | `timestamptz` | Review time |
| `created_at` | `timestamptz` | Creation time |
| `updated_at` | `timestamptz` | Last update |

Use JSONB only for flexible onboarding form fields. Important operational entities should have typed relational tables.

### 4.7 `tenant_building_requests`
Tracks requested building access and approvals.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Request ID |
| `tenant_id` | `uuid` FK | Tenant |
| `building_id` | `uuid` FK, nullable | Populated after draft building creation if used |
| `requested_details` | `jsonb` | Proposed building details |
| `status` | `text` | `submitted`, `approved`, `rejected`, `changes_requested` |
| `reviewed_by` | `uuid` | Platform admin |
| `reviewed_at` | `timestamptz` | Review time |
| `created_at` | `timestamptz` | Creation time |

Final implementation should choose one clear pattern: store proposed buildings as request records, then create approved operational buildings; or create draft buildings and activate them on approval. Avoid maintaining two competing sources of truth.

---

## 5. Property and Occupancy Tables

### 5.1 `buildings`

Suggested fields:
- `id uuid primary key`
- `tenant_id uuid not null`
- `name text not null`
- `code text`
- `address text`
- `latitude numeric(10,7)` and `longitude numeric(10,7)` only if location is required
- `photo_paths jsonb` or a normalized building-photo table
- `status text` (`draft`, `pending_approval`, `active`, `rejected`, `suspended`, `archived`)
- `approved_by uuid`
- `approved_at timestamptz`
- `created_at`, `updated_at`

Unique building code/name rules should be scoped to a tenant as agreed.

### 5.2 `floors`

- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `floor_number text not null`
- `name text`
- `created_at`, `updated_at`

Unique `(building_id, floor_number)`.

### 5.3 `rooms`

- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `floor_id uuid not null`
- `room_number text not null`
- `sharing_capacity integer not null check (sharing_capacity > 0)`
- `base_monthly_rent numeric(12,2)`
- `status text` (`active`, `maintenance`, `inactive`)
- `notes text`
- `created_at`, `updated_at`

Unique `(building_id, room_number)` unless the building's room-numbering rules require floor-scoped uniqueness.

### 5.4 `beds`

- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `room_id uuid not null`
- `bed_label text not null`
- `status text` (`active`, `maintenance`, `inactive`)
- `created_at`, `updated_at`

Unique `(room_id, bed_label)`.

Use a controlled transaction to create bed records when a room's sharing capacity is set or changed.

### 5.5 `residents`

Stores resident-specific profile and administrative information.

- `id uuid primary key`
- `tenant_id uuid not null`
- `user_id uuid nullable references auth.users(id)` until login is provisioned
- `full_name text not null`
- `phone text not null`
- `email text`
- `date_of_birth date`
- `occupation text`
- `emergency_contact_name text`
- `emergency_contact_phone text`
- `avatar_path text`
- `status text` (`pending`, `active`, `checked_out`, `blocked`)
- `created_at`, `updated_at`

Avoid duplicating resident contact details in payments and admissions. Historical snapshots may be stored only where there is a clear legal/accounting need.

### 5.6 `admissions`

- `id uuid primary key`
- `tenant_id uuid not null`
- `resident_id uuid not null`
- `building_id uuid not null`
- `floor_id uuid not null`
- `room_id uuid not null`
- `bed_id uuid not null`
- `admission_date date not null`
- `expected_checkout_date date`
- `monthly_rent numeric(12,2) not null`
- `security_deposit numeric(12,2) not null default 0`
- `advance_amount numeric(12,2) not null default 0`
- `status text` (`draft`, `pending_review`, `approved`, `rejected`, `cancelled`, `completed`)
- `approved_by uuid`
- `approved_at timestamptz`
- `created_by uuid not null`
- `created_at`, `updated_at`

Validate that resident, building, floor, room, and bed all belong to the same tenant and that the floor/room/bed hierarchy matches.

### 5.7 `resident_room_assignments`

Use a separate history table for room/bed moves.

- `id uuid primary key`
- `tenant_id uuid not null`
- `resident_id uuid not null`
- `admission_id uuid not null`
- `building_id uuid not null`
- `room_id uuid not null`
- `bed_id uuid not null`
- `start_at timestamptz not null`
- `end_at timestamptz nullable`
- `assigned_by uuid not null`
- `created_at timestamptz`

Enforce at most one active assignment per bed and, where required, at most one active bed assignment per resident. PostgreSQL partial unique indexes can help; all allocation operations must be transactional to avoid race conditions.

### 5.8 `checkouts`

- `id uuid primary key`
- `tenant_id uuid not null`
- `resident_id uuid not null`
- `admission_id uuid not null`
- `checkout_date date not null`
- `reason text`
- `deposit_refund_amount numeric(12,2)`
- `outstanding_amount numeric(12,2)`
- `processed_by uuid not null`
- `created_at timestamptz`

Checkout must close the active bed assignment and preserve historical payments and admission data.

### 5.9 `resident_documents`

- `id uuid primary key`
- `tenant_id uuid not null`
- `resident_id uuid not null`
- `document_type text not null`
- `storage_path text not null`
- `verification_status text` (`pending`, `verified`, `rejected`)
- `verified_by uuid`
- `verified_at timestamptz`
- `created_at timestamptz`

Do not expose identity document paths publicly. Collect only the minimum sensitive information needed by the product and applicable law.

---

## 6. Payments, Rent, and Finance

### 6.1 `rent_charges`

One row per charge/obligation.

- `id uuid primary key`
- `tenant_id uuid not null`
- `resident_id uuid not null`
- `admission_id uuid not null`
- `building_id uuid not null`
- `charge_type text` (`rent`, `deposit`, `utility`, `meal`, `other`)
- `period_start date`
- `period_end date`
- `due_date date not null`
- `amount numeric(12,2) not null`
- `status text` (`unpaid`, `partially_paid`, `paid`, `waived`, `cancelled`)
- `created_by uuid not null`
- `created_at`, `updated_at`

### 6.2 `payment_transactions`

One row per actual receipt/payment event.

- `id uuid primary key`
- `tenant_id uuid not null`
- `resident_id uuid nullable`
- `building_id uuid nullable`
- `amount numeric(12,2) not null check (amount > 0)`
- `payment_method text` (`cash`, `upi`, `bank_transfer`, `card`, `online_gateway`, `other`)
- `transaction_reference text`
- `paid_at timestamptz not null`
- `recorded_by uuid not null`
- `status text` (`recorded`, `confirmed`, `reversed`, `failed`)
- `notes text`
- `created_at timestamptz`

### 6.3 `payment_allocations`

Links payments to rent charges.

- `id uuid primary key`
- `tenant_id uuid not null`
- `payment_transaction_id uuid not null`
- `rent_charge_id uuid not null`
- `allocated_amount numeric(12,2) not null check (allocated_amount > 0)`
- `created_at timestamptz`

A payment may be allocated to multiple charges. Enforce that the total allocation does not exceed the valid payment amount, using transactional server-side logic.

### 6.4 `receipts`

- `id uuid primary key`
- `tenant_id uuid not null`
- `payment_transaction_id uuid not null`
- `receipt_number text not null`
- `storage_path text nullable`
- `issued_at timestamptz not null`
- `issued_by uuid not null`

Receipt numbers should be unique within the appropriate tenant or legal numbering scope.

### 6.5 `expenses`

Canonical expense ledger shared by Expenses, Finance, and Maintenance.

- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `floor_id uuid nullable`
- `room_id uuid nullable`
- `category_id uuid not null`
- `source_type text` (`general`, `maintenance`, `inventory`, `salary`, `utility`, `other`)
- `source_id uuid nullable`
- `vendor_id uuid nullable`
- `description text not null`
- `expense_date date not null`
- `subtotal numeric(12,2) not null`
- `tax_amount numeric(12,2) not null default 0`
- `total_amount numeric(12,2) not null`
- `status text` (`draft`, `submitted`, `approved`, `rejected`, `cancelled`)
- `created_by uuid not null`
- `approved_by uuid nullable`
- `created_at`, `updated_at`

Do not store `amount_paid` as an independently editable truth if it can be calculated from expense-payment transactions.

### 6.6 `expense_categories`
- `id uuid primary key`
- `tenant_id uuid not null`
- `name text not null`
- `is_active boolean not null default true`

### 6.7 `expense_payments`
- `id uuid primary key`
- `tenant_id uuid not null`
- `expense_id uuid not null`
- `amount numeric(12,2) not null check (amount > 0)`
- `paid_at timestamptz not null`
- `payment_method text not null`
- `transaction_reference text`
- `receipt_path text`
- `recorded_by uuid not null`
- `status text` (`confirmed`, `reversed`)
- `created_at timestamptz`

### 6.8 `vendors`
- `id uuid primary key`
- `tenant_id uuid not null`
- `name text not null`
- `contact_person text`
- `phone text`
- `email text`
- `address text`
- `service_categories jsonb`
- `is_active boolean not null default true`
- `created_at`, `updated_at`

Maintenance payment history should read from canonical expense payment records when linked to a maintenance expense, rather than maintaining a second independent payment ledger.

---

## 7. Maintenance

### 7.1 `maintenance_categories`
- `id uuid primary key`
- `tenant_id uuid not null`
- `name text not null`
- `is_active boolean not null default true`

### 7.2 `maintenance_requests`
- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `floor_id uuid nullable`
- `room_id uuid nullable`
- `complaint_id uuid nullable`
- `title text not null`
- `description text not null`
- `category_id uuid not null`
- `priority text` (`low`, `medium`, `high`, `critical`)
- `status text` (`open`, `assigned`, `in_progress`, `on_hold`, `completed`, `cancelled`)
- `assigned_membership_id uuid nullable`
- `vendor_id uuid nullable`
- `reported_at timestamptz not null`
- `due_at timestamptz nullable`
- `completed_at timestamptz nullable`
- `created_by uuid not null`
- `created_at`, `updated_at`

### 7.3 `maintenance_schedules`
- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `floor_id uuid nullable`
- `room_id uuid nullable`
- `category_id uuid not null`
- `title text not null`
- `assigned_membership_id uuid nullable`
- `vendor_id uuid nullable`
- `scheduled_at timestamptz not null`
- `recurrence_rule text nullable`
- `status text` (`scheduled`, `completed`, `cancelled`)
- `created_by uuid not null`
- `created_at`, `updated_at`

For recurring schedules, consider a separate `maintenance_occurrences` table so each occurrence can be completed independently without losing the parent schedule.

### 7.4 `maintenance_attachments`
- `id uuid primary key`
- `tenant_id uuid not null`
- `maintenance_request_id uuid nullable`
- `expense_id uuid nullable`
- `storage_path text not null`
- `file_type text`
- `uploaded_by uuid not null`
- `created_at timestamptz`

Use the same canonical `expenses` and `expense_payments` records for maintenance financials. Avoid duplicate maintenance-only expense/payment tables.

---

## 8. Complaints and Communication

### 8.1 `complaints`
- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `resident_id uuid not null`
- `room_id uuid nullable`
- `category text not null`
- `title text not null`
- `description text not null`
- `priority text`
- `status text` (`open`, `in_progress`, `awaiting_resident`, `resolved`, `closed`, `rejected`)
- `assigned_membership_id uuid nullable`
- `submitted_at timestamptz not null`
- `resolved_at timestamptz nullable`
- `created_at`, `updated_at`

### 8.2 `notices`
- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid nullable` — null may mean all buildings in that tenant
- `title text not null`
- `body text not null`
- `category text` (`announcement`, `important`, `event`, `food_menu`, `maintenance`)
- `published_at timestamptz nullable`
- `expires_at timestamptz nullable`
- `created_by uuid not null`
- `status text` (`draft`, `published`, `archived`)
- `created_at`, `updated_at`

### 8.3 `notice_reads`
- `id uuid primary key`
- `tenant_id uuid not null`
- `notice_id uuid not null`
- `resident_id uuid not null`
- `read_at timestamptz not null`
- Unique `(notice_id, resident_id)`.

### 8.4 `notifications`
- `id uuid primary key`
- `tenant_id uuid nullable` for platform-level notifications where appropriate
- `user_id uuid not null`
- `type text not null`
- `title text not null`
- `body text`
- `entity_type text`
- `entity_id uuid`
- `read_at timestamptz nullable`
- `created_at timestamptz`

---

## 9. Food, Chef, and Inventory

### 9.1 `meal_menus`
- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `meal_date date not null`
- `meal_type text` (`breakfast`, `lunch`, `dinner`)
- `dishes jsonb` or a normalized `meal_dishes` table
- `published_by uuid not null`
- `published_at timestamptz nullable`
- `status text` (`draft`, `published`, `cancelled`)
- `created_at`, `updated_at`

For structured reporting and ratings, a normalized dish table is preferable to storing all dishes in JSON.

### 9.2 `meal_availability`
- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `resident_id uuid not null`
- `meal_date date not null`
- `meal_type text not null`
- `is_unavailable boolean not null`
- `updated_at timestamptz not null`
- Unique `(resident_id, meal_date, meal_type)`.

Business rule: residents who intend to eat do not need to vote; only residents who will not eat select unavailable. The chef's expected count is derived from eligible active residents minus valid unavailable responses. Define response deadlines and late-change behavior.

### 9.3 `inventory_locations`
Represents a separate stock location per building or kitchen.

- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `name text not null`
- `is_active boolean not null default true`
- Unique `(building_id, name)`.

### 9.4 `inventory_items`
- `id uuid primary key`
- `tenant_id uuid not null`
- `name text not null`
- `category text`
- `base_unit text not null`
- `is_active boolean not null default true`
- `created_at`, `updated_at`

An item definition may be shared within a tenant, but stock quantities and transactions are always scoped to an inventory location/building.

### 9.5 `inventory_transactions`
Immutable stock movement ledger.

- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `inventory_location_id uuid not null`
- `item_id uuid not null`
- `transaction_type text` (`purchase`, `issue_to_kitchen`, `consumption`, `return`, `wastage`, `adjustment`)
- `quantity numeric(12,3) not null check (quantity > 0)`
- `unit text not null`
- `unit_cost numeric(12,2) nullable`
- `reference_type text`
- `reference_id uuid nullable`
- `notes text`
- `recorded_by uuid not null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null`

Use signed movement semantics consistently in the ledger or define direction by `transaction_type`; do not mix both conventions. Stock on hand is calculated from movements or maintained by a transactionally updated balance table.

### 9.6 `kitchen_daily_reports`
- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `report_date date not null`
- `chef_membership_id uuid not null`
- `meal_type text`
- `expected_meal_count integer`
- `actual_meal_count integer`
- `summary text`
- `submitted_at timestamptz nullable`
- `created_at`, `updated_at`

Ingredient usage should link to inventory transactions, not be recorded in a separate conflicting quantity ledger.

---

## 10. Staff Attendance and End-of-Day Reports

### 10.1 `staff_attendance`
- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `staff_membership_id uuid not null`
- `attendance_date date not null`
- `status text` (`present`, `absent`, `late`, `half_day`, `leave`, `off_day`)
- `check_in_at timestamptz nullable`
- `check_out_at timestamptz nullable`
- `marked_by uuid not null`
- `marked_at timestamptz not null`
- `notes text`
- Unique `(building_id, staff_membership_id, attendance_date)` unless multiple shifts are supported.

Only authorized managers can mark attendance. Record who marked it and when.

### 10.2 `staff_daily_reports`
- `id uuid primary key`
- `tenant_id uuid not null`
- `building_id uuid not null`
- `staff_membership_id uuid not null`
- `report_date date not null`
- `work_summary text not null`
- `recorded_by uuid not null`
- `attachments jsonb`
- `status text` (`draft`, `submitted`, `reviewed`)
- `reviewed_by uuid nullable`
- `reviewed_at timestamptz nullable`
- `created_at`, `updated_at`

A manager records/confirm the staff member's end-of-day work summary. Keep the author and timestamps in the history.

---

## 11. Subscriptions and Platform Controls

### 11.1 `subscription_plans`
- `id uuid primary key`
- `name text not null`
- `monthly_price numeric(12,2) not null`
- `included_residents integer not null`
- `max_managers integer not null`
- `max_chefs integer not null`
- `trial_days integer not null default 90`
- `is_active boolean not null default true`
- `created_at`, `updated_at`

### 11.2 `subscriptions`
- `id uuid primary key`
- `tenant_id uuid not null`
- `plan_id uuid not null`
- `status text` (`trialing`, `active`, `past_due`, `grace_period`, `read_only`, `suspended`, `cancelled`, `expired`)
- `trial_start timestamptz`
- `trial_end timestamptz`
- `current_period_start timestamptz`
- `current_period_end timestamptz`
- `resident_limit integer not null`
- `manager_limit integer not null`
- `chef_limit integer not null`
- `price_override numeric(12,2) nullable`
- `created_at`, `updated_at`

### 11.3 `subscription_invoices`
- `id uuid primary key`
- `tenant_id uuid not null`
- `subscription_id uuid not null`
- `invoice_number text not null`
- `amount numeric(12,2) not null`
- `currency text not null default 'INR'`
- `status text` (`draft`, `issued`, `paid`, `overdue`, `void`)
- `due_at timestamptz nullable`
- `paid_at timestamptz nullable`
- `created_at`, `updated_at`

### 11.4 `audit_logs`
- `id uuid primary key`
- `tenant_id uuid nullable`
- `actor_user_id uuid nullable`
- `actor_type text not null` (`platform_admin`, `tenant_user`, `system`)
- `action text not null`
- `entity_type text not null`
- `entity_id uuid nullable`
- `before_data jsonb nullable`
- `after_data jsonb nullable`
- `request_id text nullable`
- `created_at timestamptz not null`

Do not log passwords, auth tokens, private activation tokens, or unnecessary sensitive document contents. Restrict audit log mutation to trusted server/database logic.

---

## 12. Row-Level Security Strategy

RLS is mandatory for tenant-owned tables.

### Read/write policy concept
For each tenant-owned record:
- The authenticated user must have an active `tenant_memberships` row for the record's `tenant_id`.
- The membership role must allow the requested action.
- If the table is building-scoped, the user must have access to that `building_id` or hold an owner role permitted across the tenant.
- Residents may only access their own resident records, assigned room/bed history, charges, payment history, notices applicable to them, and their own complaints.
- Chefs may access assigned building menus, meal counts, inventory, and kitchen records, but not general resident KYC or owner financial records.
- Managers receive permissions based on their assigned buildings and owner-configured capabilities.
- Platform Super Admin access must use a separate trusted platform-admin grant and must be audited.

Avoid a single broad `USING (true)` policy on tenant data. Avoid trusting JWT user metadata that the user can modify. Use protected database tables or server-managed claims for authorization.

### Important implementation note
RLS policy SQL must be written and tested per table. A generic policy template is not sufficient without checking related-table joins, update checks, and privilege escalation paths.

---

## 13. Indexes and Constraints

Recommended indexes:
- Tenant-owned tables: `(tenant_id, created_at desc)` where relevant.
- Buildings: `(tenant_id, status)`.
- Floors: `(building_id, floor_number)`.
- Rooms: `(building_id, floor_id, room_number)`.
- Beds: `(room_id, bed_label)`.
- Residents: `(tenant_id, full_name)`, `(tenant_id, phone)`.
- Admissions: `(tenant_id, status, created_at desc)`.
- Active assignments: partial indexes for active bed/resident assignments.
- Rent charges: `(tenant_id, resident_id, due_date, status)`.
- Payments: `(tenant_id, paid_at desc)`, `(resident_id, paid_at desc)`.
- Expenses: `(tenant_id, building_id, expense_date desc)`.
- Maintenance requests: `(tenant_id, building_id, status, priority)`.
- Complaints: `(tenant_id, building_id, status, submitted_at desc)`.
- Inventory transactions: `(tenant_id, building_id, inventory_location_id, item_id, occurred_at desc)`.
- Staff attendance: `(building_id, attendance_date)`.
- Notices: `(tenant_id, building_id, status, published_at desc)`.

Use unique constraints for idempotency and duplicate prevention, including meal responses, receipts, attendance records, and active bed assignments.

---

## 14. Database Functions and Transactions

Use trusted SQL functions or server-side transactions for:
- Approving a tenant/building request.
- Enforcing manager/chef/resident limits.
- Approving admissions and allocating beds.
- Checking a bed is still available at allocation time.
- Creating rent charges.
- Recording payments and allocating them to charges.
- Reversing payments.
- Creating expense payment transactions.
- Posting inventory movements and preventing invalid stock changes.
- Completing checkouts and releasing beds.
- Suspending a tenant and revoking access as required.

Any operation that changes multiple related rows must be atomic. Use idempotency keys for retried requests that could otherwise create duplicate financial or operational records.

---

## 15. Storage Buckets

Recommended private buckets:
- `resident-documents`
- `payment-receipts`
- `expense-invoices`
- `maintenance-attachments`
- `building-photos`
- `profile-photos` (privacy policy dependent)

File metadata should reference the owning tenant and record. Validate file types and sizes, and authorize each download. Private documents should use short-lived signed URLs when needed.

---

## 16. Migration and Delivery Plan

### Migration 1 — Identity and tenant security
- Profiles
- Platform admins
- Tenants
- Memberships
- Building memberships
- Onboarding requests
- Initial RLS helpers and tests

### Migration 2 — Property structure
- Buildings
- Floors
- Rooms
- Beds
- Tenant/building approval state

### Migration 3 — Admissions and resident accounts
- Residents
- Admissions
- Resident assignments
- Resident documents
- Checkouts

### Migration 4 — Finance and payments
- Rent charges
- Payment transactions
- Allocations
- Receipts
- Expenses
- Expense payments
- Vendors

### Migration 5 — Maintenance and complaints
- Complaints
- Maintenance categories
- Maintenance requests
- Schedules
- Attachments

### Migration 6 — Kitchen and inventory
- Meal menus
- Meal availability
- Inventory locations/items/transactions
- Kitchen daily reports

### Migration 7 — Staff and communication
- Attendance
- Staff daily reports
- Notices
- Notice reads
- Notifications

### Migration 8 — SaaS billing and audit
- Plans
- Subscriptions
- Subscription invoices
- Audit logs
- Platform settings as needed

Each migration must include constraints, indexes, RLS enablement, policies, and automated tests appropriate to the new tables.

---

## 17. Open Decisions Before Production

Confirm before locking migrations:
1. Whether one user can have multiple roles in a tenant.
2. Whether each building needs separate approval or only the tenant does.
3. Whether resident admission requires manager approval, owner approval, or configurable approval.
4. Exact rent billing model: monthly only or custom cycles.
5. Whether deposits, advances, refunds, and adjustments require separate ledger entries.
6. Whether a payment gateway is in scope or payments are manually recorded initially.
7. Whether residents can raise maintenance requests directly or only complaints.
8. Whether staff attendance supports multiple shifts.
9. How meal availability deadlines and late changes work.
10. Exact trial expiry and subscription restriction rules.
11. Whether owner/managers can share a single resident login across multiple admissions (recommended: one auth user, linked to a resident record within each tenant).
12. Whether multi-currency or multiple countries are in scope.

---

## 18. Final Rule

This file is a **proposed database design**, not an executable migration. Before applying it, inspect the current project and existing Supabase schema, reconcile naming and relationships, then create reviewed SQL migrations. Never run these table definitions blindly against production data.
