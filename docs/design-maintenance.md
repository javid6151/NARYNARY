# Maintenance Management Module — Design Specification

**Product:** PG & Hostel Management SaaS  
**Company:** ZIPCO Solutions  
**Module:** Maintenance  
**Version:** 1.0  
**Status:** Design handoff

---

## 1. Design Goals

Build a calm, professional, enterprise-grade maintenance workspace for PG owners and authorized managers. The interface should feel like established business software: precise spacing, restrained color, readable tables, predictable controls, and useful information density.

### Primary goals
- Make open repairs and overdue work immediately visible.
- Let users move from a building to a floor, room, request, expense, or payment without losing context.
- Make maintenance costs auditable and easy to reconcile.
- Keep every record scoped to the correct customer and authorized buildings.
- Support desktop-first administration while remaining usable on tablets and mobile screens.

### Design principles
1. **Clarity over decoration:** no decorative illustrations, gradients, glassmorphism, or excessive animation.
2. **Consistent hierarchy:** page title, context/filter row, key metrics, main work area, supporting details.
3. **Status is explicit:** use text labels and icons, not color alone.
4. **One source of truth:** expense and payment data must be linked rather than duplicated.
5. **Progressive disclosure:** show essential information first; use drawers or detail pages for deeper records.

---

## 2. Visual System

Use the existing ZIPCO Solutions design system where available. The following are module defaults, not a requirement to override established global tokens.

### Color tokens

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#4C2365` | Primary actions, active navigation, selected tabs |
| `--color-primary-hover` | `#3D1C51` | Hover state for primary actions |
| `--color-background` | `#FFFFFF` | Main page background |
| `--color-surface` | `#FFFFFF` | Cards, tables, drawers |
| `--color-subtle` | `#F7F6F8` | Secondary surfaces, table header backgrounds |
| `--color-border` | `#E5E1E8` | Dividers, input borders, card outlines |
| `--color-text` | `#202026` | Main text |
| `--color-text-muted` | `#6D6874` | Helper text, timestamps, secondary labels |
| `--color-success` | `#237A52` | Completed/paid states |
| `--color-warning` | `#9A6700` | Due soon, on hold, partial payment |
| `--color-danger` | `#B42318` | Critical, overdue, failed validation |
| `--color-info` | `#2457A7` | Informational states |

Do not use the primary purple as the background for large page areas. Reserve it for focused actions and active states.

### Typography
- Use the product's existing sans-serif font. If none is defined, use `Inter`, with system sans-serif fallbacks.
- Page title: 24–28 px, semibold.
- Section title: 16–18 px, semibold.
- Table and form labels: 13–14 px.
- Body text: 14 px.
- Helper text and metadata: 12–13 px.
- Financial amounts: use tabular numerals where supported.

### Spacing and shape
- Base spacing unit: 4 px.
- Main page padding: 24 px desktop, 16 px tablet, 12–16 px mobile.
- Card padding: 16–20 px.
- Standard control height: 40 px; compact table controls: 32–36 px.
- Card radius: 10–12 px.
- Input radius: 8 px.
- Use subtle 1 px borders. Avoid heavy shadows; use a light shadow only for floating overlays.

### Icons
Use one consistent outline icon set. Pair icons with text labels for important actions. Icons must not be the only way to understand a status or action.

---

## 3. Application Shell and Navigation

### Desktop layout
- Fixed or collapsible left sidebar.
- Top header with page title/context, global search if available, notifications, and account menu.
- Main content area with consistent max-width and spacing.
- Breadcrumbs on nested pages: `Maintenance / Repairs / Request ID`.

### Sidebar placement
The Maintenance entry should sit near Expenses and Reports in the owner/manager navigation.

Suggested order:
1. Dashboard
2. Buildings
3. Rooms & Beds
4. PG Members / Residents
5. Admissions
6. Payments
7. Finance
8. Expenses
9. Complaints
10. Maintenance
11. Staff Management
12. Inventory
13. Communication
14. Reports
15. Settings

Only show modules allowed by the signed-in user's permissions.

### Maintenance submenu
- Overview
- Repairs & Requests
- Expenses
- Payment History
- Schedule
- Vendors
- Reports
- Settings

On smaller screens, collapse the sidebar into a drawer. Keep page context and the primary action visible.

---

## 4. Page 1 — Maintenance Overview

### Purpose
Give owners and managers a fast view of maintenance workload, deadlines, and costs.

### Layout
1. Page header: **Maintenance**
2. Context row:
   - Building selector (default: All accessible buildings)
   - Date range (default: This month)
   - Optional floor selector
   - Primary button: `+ New Request`
3. KPI cards:
   - Open Requests
   - In Progress
   - Overdue Tasks
   - Maintenance Expenses
   - Outstanding Payments
4. Main row:
   - Left (larger): Requests requiring attention
   - Right: Upcoming scheduled maintenance
5. Secondary row:
   - Monthly expense trend
   - Expense breakdown by category
6. Bottom row:
   - Recent activity
   - Recent expense records

### KPI behavior
- Every card is clickable and applies the relevant filter to the corresponding list.
- Currency values use the configured currency, defaulting to INR for Indian customers.
- Expense totals must distinguish incurred expense from amount paid.
- Avoid showing a percentage change unless the comparison period is clearly labelled.

### Requests requiring attention table
Columns:
- Request
- Building / Floor / Room
- Priority
- Assigned to
- Due date
- Status
- Action

Default sorting: Critical priority first, then overdue, then oldest open request.

### Empty state
If there are no requests, show a concise message and a `Create first request` action. Do not show fake sample metrics in a production account.

---

## 5. Page 2 — Repairs & Service Requests

### List view
Header:
- Title: `Repairs & Service Requests`
- Search field: request title, ID, room, or resident reference
- Filters: Building, Floor, Room, Category, Priority, Status, Assigned to, Date range
- Primary action: `+ New Request`

Tabs:
- All
- Open
- Assigned
- In Progress
- On Hold
- Completed
- Cancelled

Table columns:
- Request ID
- Title / Category
- Building / Floor / Room
- Priority
- Reported date
- Due date
- Assigned staff/vendor
- Status
- Actions

Requirements:
- Server-side pagination for large datasets.
- Preserve filters when opening a record and returning to the list.
- Support sorting on useful fields.
- Use a compact table with clear row hover and keyboard focus states.

### Create request form
Use a right-side drawer on desktop and a full-screen form on mobile.

Fields:
- Title (required)
- Description (required)
- Category (required)
- Building (required)
- Floor (optional until building selection)
- Room (optional; must belong to selected floor/building)
- Priority (default: Medium)
- Reported date (default: current date/time)
- Due date (optional)
- Assign to (optional)
- Vendor (optional)
- Attachments (optional)

Actions:
- `Cancel`
- `Create Request`

Validation:
- Do not permit floor/room selection before a building is selected.
- Changing building clears incompatible floor and room values.
- Show inline validation next to the field.
- Prevent duplicate submissions while saving.

### Request detail page
Use a two-column layout on wide screens.

**Main column**
- Request title, ID, status, and priority
- Description and attachments
- Activity timeline
- Work notes
- Before/after photos
- Linked complaint
- Linked expense records

**Side panel**
- Building / floor / room
- Assigned staff or vendor
- Reported date and due date
- Created by
- Status actions

Primary action depends on state:
- Open: `Assign Request`
- Assigned: `Start Work`
- In Progress: `Mark On Hold` / `Submit for Review`
- On Hold: `Resume Work`
- Completed: view-only unless reopening is permitted
- Cancelled: view-only unless restoration is permitted

Completion should capture completion notes, actual completion time, optional photos, and final cost. Financial amounts should be entered in the expense workflow, not silently added to the request status.

---

## 6. Page 3 — Maintenance Expenses

### List view
Header:
- Title: `Maintenance Expenses`
- Building selector
- Date range
- Search by expense ID, vendor, or description
- Primary action: `+ Add Expense`

Summary cards:
- Total Incurred
- Amount Paid
- Amount Outstanding

Table columns:
- Expense ID
- Date
- Description / Category
- Building / Floor / Room
- Vendor
- Total amount
- Paid amount
- Outstanding amount
- Payment status
- Actions

Filters:
- Building
- Category
- Vendor
- Payment status
- Date range

### Add expense form
Fields:
- Expense title (required)
- Category (required)
- Related maintenance request (optional)
- Building (required)
- Floor / Room (optional)
- Expense date (required)
- Vendor (optional)
- Description
- Subtotal
- Tax amount (optional)
- Total amount (calculated or validated)
- Initial amount paid (optional)
- Payment method (required if an initial payment is recorded)
- Transaction reference (optional)
- Bill/invoice attachment (optional)
- Notes

Actions:
- `Cancel`
- `Save Expense`

Rules:
- An expense can exist without a repair request.
- If linked to a request, show the request ID and location.
- A saved expense must be represented once in the canonical expense ledger.
- Do not create a second expense when the record is surfaced in the general Expenses module.
- Amount paid and outstanding values must be calculated from payment transactions, not maintained as unrelated manual totals.

### Expense detail
Show:
- Expense summary and location
- Invoice preview/download
- Linked request
- Payment transactions
- Audit history
- `Record Payment` action, subject to permissions

---

## 7. Page 4 — Payment History

### Purpose
Provide a transaction-level view of payments made against maintenance expenses.

### Layout
- Page title: `Maintenance Payment History`
- Filters: Building, Date range, Vendor, Payment method
- Search: transaction ID, expense ID, vendor
- Table of payment transactions
- Optional summary: total paid for the selected period

Table columns:
- Payment date
- Transaction ID
- Expense ID / description
- Vendor
- Building
- Amount
- Payment method
- Recorded by
- Receipt
- Actions

### Record payment drawer
Fields:
- Expense (preselected when opened from an expense)
- Outstanding balance (read-only)
- Payment amount
- Payment date
- Payment method
- Transaction reference
- Receipt attachment
- Notes

Rules:
- Payment amount must be greater than zero.
- Payment amount cannot exceed the outstanding balance unless a supported advance/credit workflow exists.
- Use an atomic server-side operation to record the payment and update derived balances.
- Protect against duplicate submissions with an idempotency mechanism.
- Never overwrite earlier transactions to represent a new payment.

---

## 8. Page 5 — Maintenance Schedule

### Views
- Calendar
- List

### Header controls
- Building selector
- Date navigation
- Category filter
- Assigned-to filter
- Status filter
- `+ Schedule Maintenance`

### Schedule form
Fields:
- Task title
- Description/instructions
- Category
- Building
- Floor / Room, if applicable
- Assigned staff/vendor
- Scheduled date and time
- Recurrence: none, daily, weekly, monthly, custom
- Reminder settings
- Notes

### Schedule list columns
- Task
- Building / location
- Scheduled date
- Assigned to
- Recurrence
- Status
- Actions

### Behavior
- Highlight overdue tasks with a text status and icon.
- Recurring tasks must have stable occurrence IDs and must not be duplicated by retries.
- Completing an occurrence must not erase the recurring schedule.
- Allow users to edit a single occurrence or the future series, with clear confirmation.
- Reminder delivery must be permission-aware and avoid duplicate notifications.

---

## 9. Page 6 — Vendors & Service Providers

### Vendor list
Columns:
- Vendor
- Service categories
- Contact person
- Phone
- Active status
- Linked maintenance jobs
- Outstanding amount, where permitted
- Actions

### Vendor form
Fields:
- Vendor/company name (required)
- Contact person
- Phone (required where business rules demand it)
- Email
- Address
- Service categories
- Notes
- Active/inactive status

### Vendor detail
- Contact information
- Linked repair requests
- Expense history
- Payment history
- Total billed and total paid for the selected period, subject to permissions

Do not hard-delete vendors referenced by historical financial records. Allow deactivation instead.

---

## 10. Page 7 — Reports & Analytics

### Report categories
- Maintenance Expense Report
- Building-wise Maintenance Report
- Category-wise Expense Report
- Vendor Payment Report
- Outstanding Payments Report
- Repairs Status Report
- Scheduled Maintenance Report

### Report builder
Controls:
- Report type
- Date range
- Building
- Floor / Room
- Category
- Vendor
- Request status
- Payment status
- Group by

Actions:
- `Preview Report`
- `Export PDF`
- `Export Excel`
- `Export CSV`

### Report design
- Show applied filters at the top.
- Include generation timestamp and account/property context.
- Show totals and the definitions used for those totals.
- Use a repeatable table layout for exported files.
- Do not export records outside the user's authorization scope.

---

## 11. Page 8 — Maintenance Settings

Settings should include:
- Manage maintenance categories
- Default task priority
- Default request due-date rules, if configured
- Reminder preferences
- Allowed attachment types and size limits
- Status transition permissions
- Expense approval requirements, if enabled

Settings changes must be permission-controlled and recorded in the audit log.

---

## 12. Shared Components

Build reusable components for:
- Building/floor/room selector
- Date-range picker
- Search and filter bar
- KPI card
- Status badge
- Priority indicator
- Data table with pagination
- Attachment uploader and preview
- Expense amount summary
- Payment transaction list
- Activity timeline
- Confirmation dialog
- Side drawer
- Empty, loading, error, and permission-denied states

Use shared components from the wider SaaS design system instead of creating a separate visual language for Maintenance.

---

## 13. Status and Priority Presentation

### Request statuses
- Open
- Assigned
- In Progress
- On Hold
- Completed
- Cancelled

### Payment statuses
- Unpaid
- Partially Paid
- Paid
- Overdue

### Priority levels
- Low
- Medium
- High
- Critical

Every status must be represented by readable text. Color and icons are supplementary. Ensure contrast and do not use color as the only indicator.

---

## 14. Responsive Behavior

### Desktop (≥ 1200 px)
- Full sidebar.
- Multi-column overview cards.
- Full data tables.
- Two-column detail pages.
- Right-side drawers for create/edit forms.

### Tablet (768–1199 px)
- Collapsible sidebar.
- Two-column cards where space allows.
- Filter controls may wrap to a second row.
- Detail pages may collapse to one column.

### Mobile (< 768 px)
- Sidebar becomes a navigation drawer.
- KPI cards become a two-column grid or horizontal scroll row.
- Tables become compact cards or controlled horizontal scrolling.
- Forms use full-screen sheets.
- Primary action remains easy to reach.
- No critical action may be available only on hover.

---

## 15. Interaction and Feedback

Every action must provide clear feedback.

- Loading: skeleton rows or a restrained progress indicator.
- Success: concise confirmation and updated data.
- Validation error: inline message explaining the correction.
- Network/server error: preserve user-entered values and offer retry.
- Permission error: explain that the action is not permitted.
- Destructive action: confirmation dialog with the impact stated.
- Empty state: explain what is missing and provide a relevant next action.

Avoid blocking the entire application for a small local update. Use optimistic updates only when rollback and consistency behavior are defined.

---

## 16. Data, Permissions, and Integrity Rules

- Scope every record by customer/tenant ID.
- Validate building, floor, room, staff, vendor, and request relationships on the server.
- Never rely on frontend filters to enforce access.
- Use transactions for payment creation and financial balance updates.
- Keep payment transactions immutable; corrections should use authorized reversals or adjustments.
- Maintain an audit trail for changes to requests, expenses, payments, assignments, and settings.
- Restrict invoices and attachment URLs to authorized users.
- Make all exports obey the same access checks as the UI.
- Keep maintenance expenses connected to the canonical Expenses/Finance ledger without duplication.

---

## 17. Accessibility

- Support keyboard navigation for all forms, tables, menus, dialogs, and drawers.
- Provide visible focus indicators.
- Associate labels and validation messages with form fields.
- Use adequate text contrast.
- Provide accessible names for icon-only controls.
- Ensure status is communicated through text, not color alone.
- Respect reduced-motion preferences.

---

## 18. Definition of Done

The module is ready for release when:
- All specified pages and key states are implemented.
- Create, view, edit, assign, complete, and cancel workflows work as authorized.
- Expenses and payments reconcile with Finance and Expenses.
- Complaint linking does not create duplicate requests or lose complaint history.
- Building and tenant isolation passes automated authorization tests.
- Attachment access is protected.
- Filters, pagination, and exports return consistent results.
- Payment operations are transactional and protected against duplicate submission.
- Desktop, tablet, and mobile layouts pass usability checks.
- Loading, empty, error, validation, and permission-denied states are implemented.
- Critical workflows pass end-to-end tests.

---

## 19. Design Handoff Notes

Before implementation:
1. Reuse the existing ZIPCO Solutions navigation, typography, form controls, tables, and color tokens.
2. Confirm whether global Finance/Expenses owns the canonical expense ledger.
3. Confirm role permissions for managers and maintenance staff.
4. Confirm whether maintenance requests can be created directly by residents or only through Complaints.
5. Confirm notification channels and attachment storage rules.
6. Treat all monetary values as INR by default for the Indian deployment, while keeping currency configurable if multi-country support is planned.

**End of design specification.**
