/**
 * Tenant/building-scoped chat: channel list + the selected thread.
 * RLS decides which channels a user can see (residents only see their building/floor/room).
 */
import { useState } from 'react';
import { BedDouble, Hash, Layers, ShieldCheck, Users } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { useAuth } from '../../access/useAuth';
import { Async, Empty } from '../../../components/ui';
import { listChatChannels } from '../api';
import { ChatThread } from './ChatThread';

const KIND_ICON: Record<string, typeof Hash> = { building: Users, floor: Layers, room: BedDouble, staff: ShieldCheck, custom: Hash };
/** Channel list order: building-wide first, then staff, custom groups, floors, rooms. */
const ORDER: Record<string, number> = { building: 0, staff: 1, custom: 2, floor: 3, room: 4 };

export function Chat({ buildingId, staffView, height = 'h-[560px]' }: {
  buildingId?: string | null;
  staffView?: boolean;
  height?: string;
}) {
  const { session } = useAuth();
  const channels = useAsync(async () => {
    const rows = await listChatChannels(buildingId);
    return rows.sort((a, c) => ORDER[a.kind] - ORDER[c.kind] || a.name.localeCompare(c.name, undefined, { numeric: true }));
  }, [buildingId]);
  const [active, setActive] = useState<string | null>(null);
  const list = channels.data ?? [];
  const ch = list.find((c) => c.id === active) ?? list[0] ?? null;

  return (
    <div className={cx('grid md:grid-cols-[240px_1fr] border border-line rounded-xl overflow-hidden bg-white', height)}>
      <nav aria-label="Chats" className="border-r border-line overflow-y-auto hidden md:block">
        <Async state={channels}>
          {() => (
            <ul className="p-2 space-y-0.5">
              {list.map((c) => {
                const I = KIND_ICON[c.kind] ?? Hash;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setActive(c.id)}
                      className={cx(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-left cursor-pointer',
                        ch?.id === c.id ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-subtle',
                      )}
                    >
                      <I className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{c.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Async>
      </nav>
      <div className="flex flex-col min-h-0">
        {/* On small screens the channel list collapses into a select. */}
        <div className="md:hidden p-2 border-b border-line">
          <select
            aria-label="Chat"
            className="w-full h-9 rounded-lg border border-line px-2 text-[13px]"
            value={ch?.id ?? ''}
            onChange={(e) => setActive(e.target.value)}
          >
            {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {ch ? (
          <ChatThread key={ch.id} channel={ch} me={session?.user.id ?? ''} staffView={!!staffView} />
        ) : (
          <Empty title="No chats available" />
        )}
      </div>
    </div>
  );
}
