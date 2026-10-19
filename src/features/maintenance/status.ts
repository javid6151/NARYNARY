/** Maintenance request status rules shared by the list and the detail drawer. */

export const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Statuses that still need work. */
export const ACTIVE_STATUSES = ['open', 'assigned', 'in_progress', 'on_hold'];

/** Active and past its due time. `now` is an ISO timestamp so a whole list uses the same instant. */
export const isOverdue = (r: { status: string; due_at: string | null }, now: string) =>
  ACTIVE_STATUSES.includes(r.status) && !!r.due_at && r.due_at < now;

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

/** Allowed next statuses per current status (the server enforces the same transitions). */
export const NEXT_STATUS: Record<string, { to: string; label: string; variant?: ButtonVariant }[]> = {
  open: [
    { to: 'assigned', label: 'Assign request' },
    { to: 'in_progress', label: 'Start work', variant: 'secondary' },
    { to: 'cancelled', label: 'Cancel', variant: 'danger' },
  ],
  assigned: [
    { to: 'in_progress', label: 'Start work' },
    { to: 'on_hold', label: 'Put on hold', variant: 'secondary' },
    { to: 'cancelled', label: 'Cancel', variant: 'danger' },
  ],
  in_progress: [
    { to: 'completed', label: 'Mark completed', variant: 'success' },
    { to: 'on_hold', label: 'Put on hold', variant: 'secondary' },
    { to: 'cancelled', label: 'Cancel', variant: 'danger' },
  ],
  on_hold: [
    { to: 'in_progress', label: 'Resume work' },
    { to: 'cancelled', label: 'Cancel', variant: 'danger' },
  ],
};
