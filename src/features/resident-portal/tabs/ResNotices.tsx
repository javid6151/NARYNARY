/**
 * Resident notices, filterable by category (`?category=event` is used by the Community "Events" chip).
 * Opening this screen marks every listed notice as read.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { fmtDateTime, label } from '../../../lib/format';
import { Async, Badge, Empty } from '../../../components/ui';
import { listPublishedNotices, markNoticeRead } from '../api';
import { TopBar } from '../ui/Headers';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'important', label: 'Important' },
  { id: 'event', label: 'Events' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'food_menu', label: 'Food' },
  { id: 'maintenance', label: 'Maintenance' },
];

export function ResNotices() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const st = useAsync(() => listPublishedNotices(), []);
  useEffect(() => {
    for (const n of st.data ?? []) markNoticeRead(n.id).catch(() => undefined);
  }, [st.data]);
  const rows = (st.data ?? []).filter((n) => !category || n.category === category);

  return (
    <>
      <TopBar title={category === 'event' ? 'Events' : 'Notices'} />
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setParams(f.id ? { category: f.id } : {}, { replace: true })}
            className={cx(
              'shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] cursor-pointer',
              category === f.id ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-line bg-white text-ink-2',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Async state={st}>
        {() =>
          rows.length === 0 ? (
            <Empty title={category ? `No ${label(category).toLowerCase()} notices` : 'No notices'} />
          ) : (
            <ul className="space-y-3">
              {rows.map((n) => (
                <li key={n.id} className="bg-white border border-line rounded-2xl p-4 text-[13.5px] flex gap-3">
                  <span
                    className={cx(
                      'size-10 rounded-xl grid place-items-center shrink-0',
                      n.category === 'important' ? 'bg-info-bg text-info' : 'bg-brand-50 text-brand-600',
                    )}
                  >
                    <Megaphone className="size-5" aria-hidden />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{n.title}</p>
                      {n.category === 'important' ? <Badge status="high">Important</Badge> : <Badge tone="neutral">{label(n.category)}</Badge>}
                    </div>
                    <p className="text-ink-2 mt-1 whitespace-pre-wrap">{n.body}</p>
                    <p className="text-[12px] text-muted mt-1">{fmtDateTime(n.published_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </>
  );
}
