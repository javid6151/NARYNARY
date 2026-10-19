# ZIPCO Solutions PG SaaS — API Design

**Product:** PG & Hostel Management SaaS  
**Backend:** Supabase Auth + PostgreSQL + Row-Level Security + Edge Functions  
**Document:** `api.md`  
**Version:** 1.0  
**Status:** Proposed API contract; align with the actual application and migrations before implementation

---

## 1. Purpose and Scope

This document defines the API boundaries for the ZIPCO Solutions multi-tenant PG/Hostel Management SaaS. It covers authentication, onboarding and approvals, buildings, rooms and beds, admissions, residents, payments, expenses, maintenance, complaints, notices, meals, inventory, staff, subscriptions, notifications, and platform administration.

The API is a **proposed contract**, not a claim that these endpoints already exist. The implementation should use:
- Supabase Auth for authentication.
- PostgreSQL RLS for tenant-scoped data access.
- Supabase client queries for safe, simple CRUD operations protected by RLS.
- Supabase Edge Functions or another trusted backend for privileged and multi-row transactional workflows.
- Database functions/RPCs for operations that must be atomic.

Do not expose the Supabase `service_role` key in browser or mobile clients.

---

## 2. API Conventions

### 2.1 Base URLs
- Supabase REST API: `https://<project-ref>.supabase.co/rest/v1`
- Supabase Auth API: `https://<project-ref>.supabase.co/auth/v1`
- Supabase Edge Functions: `https://<project-ref>.supabase.co/functions/v1/<function-name>`

Use environment variables for project URLs and keys. Do not hardcode secrets into source control.

### 2.2 Authentication
For authenticated requests, send the user's Supabase access token as a Bearer token. Use the public/anon key only as the project API key; it is not an authorization mechanism by itself.

```http
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <USER_ACCESS_TOKEN>
Content-Type: application/json
```

For Edge Functions, validate the JWT and resolve authorization from trusted database membership records. Never accept a user-supplied `tenant_id`, `role`, `building_id`, or `approved_by` as proof of access.

### 2.3 Resource IDs
Use UUIDs for primary resource IDs. API examples use `{id}` placeholders.

### 2.4 Pagination and sorting
Use cursor pagination for large lists where practical. For Supabase REST, use `limit`, `offset`, and explicit `order` parameters as an initial approach. Enforce server-side maximum page sizes (for example, 100 rows).

### 2.5 Filtering
Support tenant-scoped filters such as:
- `building_id`
- `floor_id`
- `room_id`
- `status`
- `from` / `to` date range
- `search` (validated and safely parameterized)
- `page` / `limit`

Every filter must be applied **after authorization**, not used to establish authorization.

### 2.6 Response shape
For Edge Functions, use a consistent JSON shape:

Success:
```json
{
  "data": {},
  "meta": {
    "request_id": "uuid"
  }
}
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A field is invalid.",
    "details": {}
  },
  "meta": {
    "request_id": "uuid"
  }
}
```

For Supabase REST endpoints, native response formats may differ. Normalize them in a shared frontend API client if the UI requires a uniform contract.

---

## 3. Authorization Model

### Platform roles
- **Platform Super Admin:** ZIPCO internal operator; explicitly provisioned in `platform_admins`.
- **Tenant Owner:** manages all permitted data for their own PG business.
- **Manager:** access according to tenant membership, assigned buildings, and configured permissions.
- **Chef:** assigned building menus, meal counts, inventory, and kitchen records; no unrestricted finance or resident KYC access.
- **Resident:** own profile, own charges/payments, relevant notices/menu, own complaints and meal availability.

### Authorization requirements
1. Validate the user's Supabase Auth identity.
2. Resolve active tenant membership from protected database records.
3. Resolve building scope for managers and chefs.
4. Enforce tenant and row access in PostgreSQL RLS.
5. For privileged operations, re-check permissions inside the trusted function or transaction.
6. Audit sensitive platform actions.
7. Return a generic `404` or appropriate denial response when revealing a resource's existence could leak another tenant's data.

**Never** trust a client-supplied role, tenant, or building as authorization. RLS and backend checks must agree.

---

## 4. Authentication and Account Activation

Prefer Supabase Auth email/OTP or supported phone OTP flows. Never store plaintext passwords in application tables.

| Operation | Method | Route / Supabase flow | Access |
|---|---|---|---|
| Register owner | `POST` | `/auth/v1/signup` or approved Auth flow | Public |
| Sign in | `POST` | `/auth/v1/token?grant_type=password` or supported OTP flow | Public |
| Send OTP | `POST` | `/auth/v1/otp` | Public, rate-limited |
| Refresh session | `POST` | `/auth/v1/token?grant_type=refresh_token` | Auth session |
| Sign out | `POST` | `/auth/v1/logout` | Auth session |
| Read own profile | `GET` | `/rest/v1/profiles?id=eq.<user-id>` | Authenticated, RLS |
| Update own profile | `PATCH` | `/rest/v1/profiles?id=eq.<user-id>` | Authenticated, RLS |
| Accept resident activation | `POST` | `/functions/v1/activate-resident` | Valid activation flow |

Do not create a resident account merely because a browser submits a form. Resident activation must follow an approved admission and use a trusted, expiring, single-use activation process. A WhatsApp button may open a prefilled message containing the portal URL and activation instructions; do not send a plaintext password.

---

## 5. Onboarding and Platform Approval

| Operation | Method | Route | Access |
|---|---|---|---|
| Create onboarding request | `POST` | `/functions/v1/onboarding-submit` | Authenticated owner |
| Read own onboarding request | `GET` | `/rest/v1/tenant_onboarding_requests` | Owner, RLS |
| Update draft request | `PATCH` | `/rest/v1/tenant_onboarding_requests?id=eq.{id}` | Owner, draft only |
| List pending tenant requests | `GET` | `/functions/v1/platform-onboarding-list` | Platform Super Admin |
| Review/approve/reject request | `POST` | `/functions/v1/platform-review-onboarding` | Platform Super Admin |
| Request building approval | `POST` | `/functions/v1/building-request-submit` | Active tenant owner |
| Review building request | `POST` | `/functions/v1/platform-review-building` | Platform Super Admin |
| Read tenant approval status | `GET` | `/rest/v1/tenants?id=eq.{tenant_id}` | Owner, RLS |

Approval endpoints must verify the actor is an active platform admin. The platform admin identity must be derived from protected records, not request JSON.

Example request:
```json
{
  "request_id": "uuid",
  "decision": "approve",
  "review_notes": "Approved after verification."
}
```

The backend must record reviewer, decision, timestamp, and audit event. Approving a tenant/building should be transactional and idempotent.

---

## 6. Buildings, Floors, Rooms, and Beds

Simple reads and permitted updates can use Supabase REST protected by RLS. Use trusted functions for multi-record creation and changes that affect occupancy.

| Operation | Method | Route |
|---|---|---|
| List accessible buildings | `GET` | `/rest/v1/buildings` |
| Create building draft/request | `POST` | `/functions/v1/building-request-submit` |
| Read building | `GET` | `/rest/v1/buildings?id=eq.{id}` |
| Update building details | `PATCH` | `/rest/v1/buildings?id=eq.{id}` |
| List floors | `GET` | `/rest/v1/floors?building_id=eq.{id}` |
| Create/update floor | `POST/PATCH` | `/rest/v1/floors` |
| List rooms | `GET` | `/rest/v1/rooms?building_id=eq.{id}` |
| Create room and beds | `POST` | `/functions/v1/room-create-with-beds` |
| Update room configuration | `POST` | `/functions/v1/room-update-capacity` |
| List beds/vacancy | `GET` | `/rest/v1/beds?room_id=eq.{id}` |
| Read occupancy summary | `GET` | `/functions/v1/occupancy-summary` |

Room capacity changes must not remove or deactivate occupied beds. The function must verify existing assignments and reject unsafe capacity reductions. Vacancy should be derived from active assignments, not a manually editable boolean.

Example room creation:
```json
{
  "building_id": "uuid",
  "floor_id": "uuid",
  "room_number": "503",
  "sharing_capacity": 3,
  "monthly_rent": 6500
}
```

The backend creates the room and appropriate bed rows in one transaction after verifying tenant and building scope.

---

## 7. Admissions and Resident Lifecycle

| Operation | Method | Route |
|---|---|---|
| Create admission draft | `POST` | `/functions/v1/admission-create` |
| Update admission draft | `PATCH` | `/rest/v1/admissions?id=eq.{id}` |
| Submit for review | `POST` | `/functions/v1/admission-submit` |
| Approve/reject admission | `POST` | `/functions/v1/admission-review` |
| List admissions | `GET` | `/rest/v1/admissions` |
| List residents | `GET` | `/rest/v1/residents` |
| Read resident profile | `GET` | `/rest/v1/residents?id=eq.{id}` |
| Update resident details | `PATCH` | `/rest/v1/residents?id=eq.{id}` |
| Start checkout | `POST` | `/functions/v1/checkout-start` |
| Complete checkout and release bed | `POST` | `/functions/v1/checkout-complete` |
| Move resident to another bed | `POST` | `/functions/v1/resident-transfer` |
| Create/send activation invitation | `POST` | `/functions/v1/resident-activation-invite` |

### Admission approval transaction
The backend should:
1. Validate active tenant and building.
2. Confirm the room/bed hierarchy belongs to the same tenant and building.
3. Lock/check the selected bed and ensure it is still vacant.
4. Create or update the resident record.
5. Approve the admission and create the active bed assignment.
6. Create initial rent/deposit charges when required by configured rules.
7. Provision or invite the resident Auth account through a trusted process.
8. Record audit history and notifications.
9. Commit all database changes atomically where possible.

External Auth invitation delivery may not participate in the database transaction. Use an outbox/retry pattern so a temporary email/SMS failure does not leave a duplicate resident or corrupt occupancy.

---

## 8. Payments, Charges, Receipts, and Finance

| Operation | Method | Route |
|---|---|---|
| List charges/due amounts | `GET` | `/rest/v1/rent_charges` |
| Create a charge | `POST` | `/functions/v1/rent-charge-create` |
| List payment history | `GET` | `/rest/v1/payment_transactions` |
| Record offline payment | `POST` | `/functions/v1/payment-record` |
| Allocate payment to charges | `POST` | `/functions/v1/payment-allocate` |
| Reverse/correct payment | `POST` | `/functions/v1/payment-reverse` |
| Generate receipt | `POST` | `/functions/v1/receipt-generate` |
| Read/download receipt | `GET` | `/functions/v1/receipt-download` |
| List expenses | `GET` | `/rest/v1/expenses` |
| Create expense | `POST` | `/functions/v1/expense-create` |
| Approve/reject expense | `POST` | `/functions/v1/expense-review` |
| Record expense payment | `POST` | `/functions/v1/expense-payment-record` |
| Read financial summary | `GET` | `/functions/v1/finance-summary` |
| Read monthly report | `GET` | `/functions/v1/finance-report` |

### Payment contract
Example request:
```json
{
  "resident_id": "uuid",
  "building_id": "uuid",
  "amount": 5000,
  "currency": "INR",
  "payment_method": "upi",
  "transaction_reference": "UPI-REFERENCE",
  "paid_at": "2026-10-18T10:30:00+05:30",
  "allocations": [
    {
      "rent_charge_id": "uuid",
      "amount": 5000
    }
  ],
  "idempotency_key": "client-generated-unique-key"
}
```

The backend must derive `tenant_id` from authenticated membership and validate every charge/resident/building relationship. Never accept a client-supplied tenant ID as proof of scope.

A payment operation must:
- Validate amount and method.
- Check allocation totals and charge balances.
- Prevent duplicate submissions using an idempotency key.
- Insert payment and allocations atomically.
- Update charge state through controlled logic or derive it from allocations.
- Generate a receipt only after successful commit.
- Preserve correction/reversal history rather than editing the original transaction.

Online payment gateway support, webhook signatures, and gateway-specific states must be designed separately if included in the first release.

---

## 9. Expenses and Maintenance

| Operation | Method | Route |
|---|---|---|
| List maintenance requests | `GET` | `/rest/v1/maintenance_requests` |
| Create resident complaint | `POST` | `/functions/v1/complaint-create` |
| Create maintenance request | `POST` | `/functions/v1/maintenance-create` |
| Assign maintenance request | `POST` | `/functions/v1/maintenance-assign` |
| Update maintenance status | `POST` | `/functions/v1/maintenance-status-update` |
| Add maintenance attachment | `POST` | `/functions/v1/maintenance-attachment-create` |
| Create maintenance schedule | `POST` | `/functions/v1/maintenance-schedule-create` |
| Complete schedule occurrence | `POST` | `/functions/v1/maintenance-schedule-complete` |
| List vendors | `GET` | `/rest/v1/vendors` |
| Create/update vendor | `POST/PATCH` | `/rest/v1/vendors` |
| Link maintenance cost to expense | `POST` | `/functions/v1/maintenance-expense-create` |

Maintenance costs should be stored in the shared `expenses` ledger. Use `source_type = "maintenance"` and a source reference when appropriate. Maintenance payment history should use `expense_payments`, not a duplicate maintenance-specific ledger.

---

## 10. Notices, Notifications, and Resident Communication

| Operation | Method | Route |
|---|---|---|
| List notices visible to resident | `GET` | `/rest/v1/notices` |
| Create/update notice | `POST/PATCH` | `/rest/v1/notices` |
| Publish/archive notice | `POST` | `/functions/v1/notice-publish` |
| Mark notice read | `POST` | `/functions/v1/notice-mark-read` |
| List own notifications | `GET` | `/rest/v1/notifications` |
| Mark notification read | `POST` | `/functions/v1/notification-mark-read` |
| Send supported notification | `POST` | `/functions/v1/notification-dispatch` |

Publication should validate the author's building scope and the target audience. Resident reads must be filtered to their tenant and applicable building or tenant-wide notices.

Email/WhatsApp delivery should use a configured provider, consent-aware messaging, retryable jobs, and delivery status records. Do not expose provider secrets in the frontend.

---

## 11. Meals, Meal Availability, Chef, and Inventory

| Operation | Method | Route |
|---|---|---|
| List menus | `GET` | `/rest/v1/meal_menus` |
| Create/update draft menu | `POST/PATCH` | `/rest/v1/meal_menus` |
| Publish menu | `POST` | `/functions/v1/meal-menu-publish` |
| Mark resident unavailable for meal | `POST` | `/functions/v1/meal-availability-set` |
| Read expected meal count | `GET` | `/functions/v1/meal-count-summary` |
| List inventory items | `GET` | `/rest/v1/inventory_items` |
| Read building stock | `GET` | `/functions/v1/inventory-balance` |
| Record stock purchase/receipt | `POST` | `/functions/v1/inventory-receive` |
| Issue stock to kitchen | `POST` | `/functions/v1/inventory-issue` |
| Record consumption | `POST` | `/functions/v1/inventory-consumption` |
| Record return/wastage | `POST` | `/functions/v1/inventory-adjustment` |
| Read inventory history | `GET` | `/rest/v1/inventory_transactions` |
| Submit kitchen daily report | `POST` | `/functions/v1/kitchen-report-submit` |

### Inventory contract
Example request:
```json
{
  "building_id": "uuid",
  "inventory_location_id": "uuid",
  "item_id": "uuid",
  "transaction_type": "consumption",
  "quantity": 2.5,
  "unit": "kg",
  "occurred_at": "2026-10-18T18:00:00+05:30",
  "reference_type": "kitchen_report",
  "reference_id": "uuid",
  "idempotency_key": "client-generated-unique-key"
}
```

The backend must verify that the chef has access to the requested building and stock location. Quantity must be positive; movement direction is determined consistently by transaction type. Reject movements that would create invalid stock unless authorized adjustment rules permit it. Store an immutable movement record and calculate/update balance atomically.

---

## 12. Staff, Attendance, and Reports

| Operation | Method | Route |
|---|---|---|
| List staff memberships | `GET` | `/rest/v1/tenant_memberships` |
| Mark staff attendance | `POST` | `/functions/v1/staff-attendance-mark` |
| Read attendance records | `GET` | `/rest/v1/staff_attendance` |
| Submit staff daily report | `POST` | `/functions/v1/staff-daily-report-submit` |
| Review daily report | `POST` | `/functions/v1/staff-daily-report-review` |
| Read operational dashboard | `GET` | `/functions/v1/owner-dashboard-summary` |
| Read occupancy report | `GET` | `/functions/v1/occupancy-report` |
| Export permitted report | `POST` | `/functions/v1/report-export` |

Only authorized managers should mark attendance for assigned buildings. Preserve who marked it, when it was marked, and any correction history. Report exports must use the same authorization checks as on-screen data.

---

## 13. Subscription and Platform Administration

| Operation | Method | Route |
|---|---|---|
| Read tenant's subscription | `GET` | `/rest/v1/subscriptions` |
| Read tenant invoices | `GET` | `/rest/v1/subscription_invoices` |
| List plans | `GET` | `/rest/v1/subscription_plans` |
| Create/update plan | `POST/PATCH` | `/functions/v1/platform-plan-manage` |
| List tenant accounts | `GET` | `/functions/v1/platform-tenants-list` |
| Read tenant account detail | `GET` | `/functions/v1/platform-tenant-detail` |
| Change tenant status | `POST` | `/functions/v1/platform-tenant-status` |
| Update subscription/trial | `POST` | `/functions/v1/platform-subscription-update` |
| Read platform audit log | `GET` | `/functions/v1/platform-audit-list` |
| Read tenant audit log | `GET` | `/functions/v1/tenant-audit-list` |

All platform endpoints must verify platform-admin status from the protected `platform_admins` table and write audit records. A tenant owner cannot change their own platform role or grant platform-admin access.

Pricing and capacity limits are configuration decisions and should not be hardcoded into frontend code or database triggers. The discussed pricing/trial values remain provisional until confirmed.

---

## 14. Error Codes

Use stable application error codes for Edge Functions.

| HTTP status | Code | Meaning |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid input or invalid state transition |
| `401` | `UNAUTHENTICATED` | Missing/invalid session |
| `403` | `FORBIDDEN` | Authenticated but not permitted |
| `404` | `NOT_FOUND` | Resource absent or intentionally hidden |
| `409` | `CONFLICT` | Bed taken, duplicate operation, or stale state |
| `422` | `BUSINESS_RULE_VIOLATION` | Input is syntactically valid but violates business rules |
| `429` | `RATE_LIMITED` | Too many requests |
| `500` | `INTERNAL_ERROR` | Unexpected server error |

Do not return SQL errors, secrets, stack traces, internal service-role details, or private tenant information to clients.

---

## 15. Idempotency, Retries, and Concurrency

For endpoints that create financial, admission, inventory, or subscription records:
- Accept an idempotency key or stable operation ID.
- Store the key in a table with a unique constraint scoped to tenant and operation.
- Return the prior result when the same request is safely retried.
- Use transactions and row locks for bed assignment, charge allocation, and stock movement.
- Use an outbox table or equivalent retryable mechanism for notifications and external Auth invitations.
- Make background jobs safe to execute more than once.

A client-side disabled button is helpful UX but is not a substitute for backend duplicate prevention.

---

## 16. Rate Limiting and Abuse Protection

Apply rate limits to:
- OTP requests and login attempts.
- Onboarding submissions.
- Resident activation invitations.
- Public file upload/signing requests.
- Notification dispatch.
- Report exports.
- Public endpoints and any route that can trigger paid provider calls.

Validate payload size, file type, file size, date ranges, pagination size, and allowed filter fields. Keep CORS restricted to expected application origins where appropriate.

---

## 17. File Upload and Download

Use private Supabase Storage buckets for:
- Resident documents/KYC
- Payment receipts
- Expense invoices
- Maintenance attachments
- Building photos where customer privacy requires it

Upload workflow:
1. Authenticate the user.
2. Verify access to the target tenant and entity.
3. Validate file type and size.
4. Upload to a path scoped to the record using a server-generated name.
5. Save metadata in the corresponding table.
6. Authorize every download and issue short-lived signed URLs where appropriate.

A storage path alone is not proof of authorization. Avoid placing sensitive documents in public buckets.

---

## 18. Realtime and Background Work

Use Supabase Realtime only where it improves the workflow:
- New complaints and maintenance status changes.
- Payment updates and dashboard refreshes.
- Meal availability count changes.
- Menu publication.
- Inventory updates.
- Notices and notifications.

Realtime subscriptions do not replace RLS. Verify channel/table authorization and unsubscribe when a user changes tenant or building context.

Background jobs may handle:
- Rent reminders and overdue notifications.
- Trial/subscription expiry notifications.
- Recurring maintenance schedule creation.
- Notification retries.
- Report exports.

Jobs should be idempotent, observable, and use server-side credentials securely.

---

## 19. API Test Checklist

### Tenant isolation
- Tenant A cannot read, update, or delete Tenant B records.
- Changing a request's `tenant_id` or `building_id` cannot grant access.
- Platform endpoints reject tenant users.
- Platform-admin access is audited.

### Role and building scope
- A manager cannot access an unassigned building.
- A chef can access only assigned building kitchen/inventory data.
- A chef cannot read owner-only financial records or resident KYC files.
- A resident cannot access another resident's profile, payments, complaints, or documents.

### Admissions and occupancy
- Two concurrent admission requests cannot allocate the same bed.
- Room capacity cannot be reduced below occupied capacity.
- Checkout releases the active assignment without deleting history.
- Retrying admission approval does not create duplicate assignments or charges.

### Finance and inventory
- Payment allocation cannot exceed payment amount or charge balance.
- Duplicate payment submissions are idempotent.
- Reversed payments retain audit history.
- Inventory cannot be accidentally double-consumed by retrying the same request.
- Building A stock never affects Building B stock.

### Operational and security
- Invalid status transitions are rejected.
- Private storage files cannot be accessed by unauthorized users.
- Rate limits protect OTP and notification endpoints.
- Logs contain no passwords, tokens, or unnecessary sensitive data.
- Exports enforce the same permissions as normal API reads.

---

## 20. Implementation Order

1. Confirm the existing schema and auth flow.
2. Implement shared API client and typed request/response contracts.
3. Implement RLS and authorization helpers before feature endpoints.
4. Implement onboarding and approval.
5. Implement building/floor/room/bed setup.
6. Implement admissions, bed assignment, and resident activation.
7. Implement charges, payments, allocations, receipts, and expenses.
8. Implement complaints and maintenance.
9. Implement meals, inventory, staff, and notices.
10. Implement subscriptions and platform admin.
11. Add idempotency, audit logging, rate limits, background jobs, and automated security tests.
12. Generate OpenAPI documentation from the implemented API where possible.

---

## 21. Final Notes

- Route names in this document are proposed names, not existing deployed endpoints.
- Supabase REST routes require the corresponding tables, grants, and RLS policies to be implemented.
- Edge Function names are illustrative and should be aligned with the codebase's naming convention.
- Do not implement every operation as an Edge Function by default; use direct RLS-protected reads for simple queries and trusted transactional functions for privileged workflows.
- Do not apply schema changes blindly. Reconcile this API contract with `database.md`, `architecture.md`, the current repository, and the approved product requirements before implementation.
