/** Header bell with the user's latest notifications. Opening it marks unread ones as read. */
import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { relTime } from '../../../lib/format';
import { cx } from '../../../lib/cx';
import { listNotifications, markNotificationsRead } from '../api';

export function NotificationBell({ dark }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const st = useAsync(() => listNotifications(), []);
  const unread = (st.data ?? []).filter((n) => !n.read_at).length;

  // Close when clicking outside the panel.
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = async () => {
    setOpen(!open);
    if (!open && unread) await markNotificationsRead().catch(() => undefined);
    // Refresh on close so the unread badge reflects what was just read.
    if (open) st.reload();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className={cx('relative p-2 rounded-lg cursor-pointer', dark ? 'text-white hover:bg-white/10' : 'text-ink-2 hover:bg-subtle')}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span
            className={cx(
              'absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-bad text-white',
              'text-[10px] font-semibold grid place-items-center',
            )}
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className={cx(
            'absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white text-ink',
            'border border-line rounded-xl shadow-lg z-40 overflow-hidden',
          )}
        >
          <div className="px-4 py-3 border-b border-line font-semibold text-[14px]">Notifications</div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-line">
            {(st.data ?? []).length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted">You’re all caught up.</li>}
            {(st.data ?? []).map((n) => (
              <li key={n.id} className={cx('px-4 py-3', !n.read_at && 'bg-brand-50/60')}>
                <p className="text-[13px] font-medium">{n.title}</p>
                {n.body && <p className="text-[12px] text-ink-2 mt-0.5">{n.body}</p>}
                <p className="text-[11px] text-muted mt-1">{relTime(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
