/** Shared UI primitives: buttons, cards, form fields, badges, tables, drawers, dialogs and loading/error states. */
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Inbox, Loader2, Lock, X, XCircle, CircleDot, PauseCircle } from 'lucide-react';
import type { ApiError } from '../lib/api';
import { cx } from '../lib/cx';
import { label } from '../lib/format';

// ------------------------------------------------------------------ Button
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'kitchen';
export function Button({ variant = 'primary', size = 'md', busy, className, children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; busy?: boolean }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-200',
    secondary: 'bg-white text-ink border border-line hover:bg-subtle disabled:text-muted',
    ghost: 'text-brand-600 hover:bg-brand-50 disabled:text-muted',
    danger: 'bg-white text-bad border border-bad/30 hover:bg-bad-bg disabled:opacity-50',
    success: 'bg-ok text-white hover:brightness-110 disabled:opacity-50',
    kitchen: 'bg-kitchen text-white hover:bg-kitchen-600 disabled:opacity-50',
  }[variant];
  return (
    <button
      {...p}
      disabled={p.disabled || busy}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer',
        'disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        v,
        className,
      )}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Card
export function Card({ title, action, children, className, pad = true }:
  { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('bg-white border border-line rounded-xl', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className={cx(pad && 'px-5 pb-5', !title && !action && pad && 'pt-5')}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs }:
  { title: string; subtitle?: ReactNode; actions?: ReactNode; crumbs?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        {crumbs && <div className="text-[13px] text-muted mb-1">{crumbs}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon, label: l, value, hint, tone = 'brand', onClick }: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'brand' | 'ok' | 'warn' | 'bad' | 'info';
  onClick?: () => void;
}) {
  const t = {
    brand: 'bg-brand-50 text-brand-600',
    ok: 'bg-ok-bg text-ok',
    warn: 'bg-warn-bg text-warn',
    bad: 'bg-bad-bg text-bad',
    info: 'bg-info-bg text-info',
  }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cx('text-left bg-white border border-line rounded-xl p-4 flex gap-3 items-start min-w-0',
      onClick && 'hover:border-brand-200 cursor-pointer')}>
      {icon && <span className={cx('size-10 shrink-0 rounded-lg grid place-items-center', t)}>{icon}</span>}
      <div className="min-w-0">
        <div className="text-[13px] text-muted truncate">{l}</div>
        <div className="text-xl font-semibold tabular mt-0.5 text-ink">{value}</div>
        {hint && <div className="text-[12px] text-muted mt-0.5">{hint}</div>}
      </div>
    </Comp>
  );
}

// ------------------------------------------------------------------ Status badges (text + icon, never color alone)
const TONE: Record<string, string> = {
  ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn', bad: 'bg-bad-bg text-bad', info: 'bg-info-bg text-info',
  neutral: 'bg-subtle text-ink-2', brand: 'bg-brand-50 text-brand-700',
};
/** Maps every status value used in the database to a badge tone. Unknown statuses render neutral. */
const STATUS_TONE: Record<string, string> = {
  active: 'ok', approved: 'ok', paid: 'ok', completed: 'ok', resolved: 'ok', confirmed: 'ok', present: 'ok',
  published: 'ok', verified: 'ok', in_stock: 'ok',
  pending: 'warn', pending_review: 'warn', pending_approval: 'warn', submitted: 'warn', partially_paid: 'warn',
  on_hold: 'warn', late: 'warn', half_day: 'warn', invited: 'warn', awaiting_resident: 'warn', medium: 'warn',
  changes_requested: 'warn', low_stock: 'warn', on_leave: 'warn',
  in_progress: 'info', assigned: 'info', trialing: 'info',
  open: 'bad', unpaid: 'bad', overdue: 'bad', rejected: 'bad', absent: 'bad', critical: 'bad', suspended: 'bad',
  high: 'bad', blocked: 'bad', out_of_stock: 'bad',
  reversed: 'neutral', cancelled: 'neutral', checked_out: 'neutral', closed: 'neutral', revoked: 'neutral',
  waived: 'neutral', leave: 'neutral', off_day: 'neutral', low: 'neutral', archived: 'neutral', inactive: 'neutral',
};
const ICON: Record<string, ReactNode> = {
  ok: <CheckCircle2 className="size-3" aria-hidden />, warn: <Clock className="size-3" aria-hidden />,
  bad: <AlertTriangle className="size-3" aria-hidden />, info: <CircleDot className="size-3" aria-hidden />,
  neutral: <PauseCircle className="size-3" aria-hidden />, brand: null,
};
export function Badge({ status, children, tone }: { status?: string; children?: ReactNode; tone?: keyof typeof TONE }) {
  const t = tone ?? STATUS_TONE[status ?? ''] ?? 'neutral';
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium whitespace-nowrap', TONE[t])}>
      {ICON[t]}{children ?? label(status)}
    </span>
  );
}

// ------------------------------------------------------------------ Form fields
export function Field({ label: l, error, hint, children, required, className }:
  { label: string; error?: string | null; hint?: string; children: (id: string) => ReactNode; required?: boolean; className?: string }) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1.5 min-w-0', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">{l}{required && <span className="text-bad"> *</span>}</label>
      {children(id)}
      {error ? <p className="text-[12px] text-bad" role="alert">{error}</p> : hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}
const inputCls = [
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-muted',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-subtle',
].join(' ');
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, 'pr-8', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...p} className={cx(inputCls, 'h-auto min-h-20 py-2', p.className)} />;

export function ErrorBanner({ error }: { error: ApiError | string | null | undefined }) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : error.message;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-bad/20 bg-bad-bg px-3 py-2 text-[13px] text-bad">
      <XCircle className="size-4 mt-0.5 shrink-0" aria-hidden /><span>{msg}</span>
    </div>
  );
}

// ------------------------------------------------------------------ States
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-subtle animate-pulse" />)}
    </div>
  );
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <Inbox className="size-8 text-muted mb-2" aria-hidden />
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="text-[13px] text-muted mt-1 max-w-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function LoadError({ error, retry }: { error: ApiError; retry?: () => void }) {
  if (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND') {
    return (
      <div className="flex flex-col items-center text-center py-10">
        <Lock className="size-8 text-muted mb-2" aria-hidden />
        <p className="font-medium">Not available</p>
        <p className="text-[13px] text-muted mt-1">{error.message}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center text-center py-10">
      <AlertTriangle className="size-8 text-bad mb-2" aria-hidden />
      <p className="font-medium">Couldn’t load this</p>
      <p className="text-[13px] text-muted mt-1">{error.message}</p>
      {retry && <Button variant="secondary" size="sm" className="mt-3" onClick={retry}>Try again</Button>}
    </div>
  );
}
/** Renders loading / error / content for a useAsync result. */
export function Async<T>({ state, children, rows }:
  { state: { data: T | null; error: ApiError | null; loading: boolean; reload: () => void }; children: (d: T) => ReactNode; rows?: number }) {
  if (state.error) return <LoadError error={state.error} retry={state.reload} />;
  if (state.data === null) return <Loading rows={rows} />;
  return <>{children(state.data)}</>;
}

// ------------------------------------------------------------------ Table
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-subtle text-left text-muted">
            {head.map((h, i) => <th key={i} className="px-5 py-2.5 font-medium whitespace-nowrap first:pl-5">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) =>
  <td className={cx('px-5 py-3 align-middle', className)}>{children}</td>;

// ------------------------------------------------------------------ Tabs
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line overflow-x-auto overflow-y-hidden mb-4">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap cursor-pointer',
            value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-ink')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Drawer (right side; full screen on mobile)
export function Drawer({ open, onClose, title, children, footer, wide }:
  { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;

    // Focus the first interactive element in the drawer body, fallback to close button
    const contentInput = ref.current?.querySelector<HTMLElement>(
      '.overflow-y-auto input:not([type="hidden"]):not([disabled]), .overflow-y-auto select:not([disabled]), .overflow-y-auto textarea:not([disabled])'
    );
    if (contentInput) {
      contentInput.focus();
    } else {
      ref.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        className={cx('relative h-full w-full bg-white shadow-xl flex flex-col', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <header className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-subtle cursor-pointer"><X className="size-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-line flex justify-end gap-2 shrink-0">{footer}</footer>}
      </div>
    </div>
  );
}

export function Confirm({ open, title, body, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose, children }:
  { open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean;
    onConfirm: () => void; onClose: () => void; children?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <h2 className="font-semibold text-base">{title}</h2>
        <div className="text-[13px] text-ink-2 mt-2">{body}</div>
        {children && <div className="mt-3 space-y-3">{children}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} busy={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="inline-grid place-items-center rounded-full bg-brand-100 text-brand-700 font-semibold shrink-0">{ini}</span>
  );
}

/** Simple toast via a fixed region. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => { if (message) { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); } }, [message, onDone]);
  if (!message) return null;
  return (
    <div
      role="status"
      className={cx(
        'fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2',
        'rounded-lg bg-ink text-white px-4 py-2.5 text-[13px] shadow-lg',
      )}
    >
      <CheckCircle2 className="size-4 text-green-300" aria-hidden />{message}
    </div>
  );
}
