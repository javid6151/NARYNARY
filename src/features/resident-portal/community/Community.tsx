/**
 * Resident Community hub: search, quick chips for each chat the resident belongs to (plus Events),
 * recent chats with unread counts, and the community features grid. "+" starts a new post.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BedDouble, Cake, CalendarDays, Globe, Layers, LifeBuoy, Lightbulb, Newspaper, PackageSearch, Plus, Search,
  ShoppingCart, Smile, Users, Vote, type LucideIcon,
} from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { cx } from '../../../lib/cx';
import { relTime } from '../../../lib/format';
import { Async, Input } from '../../../components/ui';
import { getChatOverview } from '../../community/api';
import type { ChatOverview } from '../../community/types';
import { TopBar } from '../ui/Headers';
import { NewPostSheet } from './NewPostSheet';

const CHANNEL_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  building: { icon: Globe, tone: 'bg-info-bg text-info' },
  floor: { icon: Layers, tone: 'bg-ok-bg text-ok' },
  room: { icon: BedDouble, tone: 'bg-[#fff1e6] text-[#d4600f]' },
  custom: { icon: Users, tone: 'bg-brand-50 text-brand-600' },
  staff: { icon: Users, tone: 'bg-subtle text-ink-2' },
};

/** Short chip label: the building-wide chat is "Everyone". */
const chipLabel = (c: ChatOverview) => (c.kind === 'building' ? 'Everyone' : c.name);

const FEATURES: { icon: LucideIcon; label: string; to: string; tone: string }[] = [
  { icon: Newspaper, label: 'Notices', to: '/resident/notices', tone: 'bg-info-bg text-info' },
  { icon: PackageSearch, label: 'Lost & Found', to: '/resident/community/lost-found', tone: 'bg-ok-bg text-ok' },
  { icon: ShoppingCart, label: 'Marketplace', to: '/resident/community/marketplace', tone: 'bg-bad-bg text-bad' },
  { icon: Vote, label: 'Polls', to: '/resident/community/polls', tone: 'bg-brand-50 text-brand-600' },
  { icon: Cake, label: 'Birthdays', to: '/resident/community/birthdays', tone: 'bg-bad-bg text-bad' },
  { icon: Lightbulb, label: 'Suggestions', to: '/resident/community/suggestions', tone: 'bg-info-bg text-info' },
  { icon: Smile, label: 'Feedback', to: '/resident/community/feedback', tone: 'bg-warn-bg text-warn' },
  { icon: LifeBuoy, label: 'Help Desk', to: '/resident/complaints', tone: 'bg-info-bg text-info' },
];

export function Community() {
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [newPost, setNewPost] = useState(false);
  const st = useAsync(() => getChatOverview(), []);
  const chats = useMemo(() => (st.data ?? []).filter((c) => c.kind !== 'staff'), [st.data]);
  const s = search.trim().toLowerCase();
  const recent = chats.filter((c) => !s || `${c.name} ${c.last_sender ?? ''} ${c.last_body ?? ''}`.toLowerCase().includes(s));
  const chipOrder = ['building', 'floor', 'room', 'custom'];
  const chips = [...chats].sort((a, b) => chipOrder.indexOf(a.kind) - chipOrder.indexOf(b.kind));

  const plus = (
    <button onClick={() => setNewPost(true)} aria-label="New post" className="p-2 rounded-lg hover:bg-white cursor-pointer">
      <Plus className="size-6" />
    </button>
  );

  return (
    <>
      <TopBar title="Community" back={null} action={plus} />
      <label className="relative block">
        <span className="sr-only">Search chats</span>
        <Search className="size-4 text-muted absolute left-3.5 top-3.5" aria-hidden />
        <Input
          placeholder="Search chats, people, messages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl"
        />
      </label>

      <Async state={st} rows={3}>
        {() => (
          <>
            <div className="flex gap-4 overflow-x-auto -mx-4 px-4 pb-1">
              {chips.map((c) => {
                const { icon: Icon, tone } = CHANNEL_ICON[c.kind] ?? CHANNEL_ICON.custom;
                return (
                  <button
                    key={c.id}
                    onClick={() => nav(`/resident/community/chat/${c.id}`)}
                    className="flex flex-col items-center gap-1.5 w-[68px] shrink-0 cursor-pointer"
                  >
                    <span className={cx('size-14 rounded-full grid place-items-center relative', tone)}>
                      <Icon className="size-6" aria-hidden />
                      {c.unread > 0 && <span className="absolute top-0 right-0 size-3 rounded-full bg-brand-600 ring-2 ring-canvas" />}
                    </span>
                    <span className="text-[12px] text-ink-2 truncate w-full text-center">{chipLabel(c)}</span>
                  </button>
                );
              })}
              <button
                onClick={() => nav('/resident/notices?category=event')}
                className="flex flex-col items-center gap-1.5 w-[68px] shrink-0 cursor-pointer"
              >
                <span className="size-14 rounded-full grid place-items-center bg-bad-bg text-bad">
                  <CalendarDays className="size-6" aria-hidden />
                </span>
                <span className="text-[12px] text-ink-2">Events</span>
              </button>
            </div>

            <section>
              <h2 className="text-[16px] font-semibold mb-2">Recent Chats</h2>
              {recent.length === 0 ? (
                <p className="text-[13px] text-muted py-2">{s ? 'No chats match your search.' : 'No chats yet.'}</p>
              ) : (
                <ul className="space-y-1">
                  {recent.map((c) => {
                    const { icon: Icon, tone } = CHANNEL_ICON[c.kind] ?? CHANNEL_ICON.custom;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => nav(`/resident/community/chat/${c.id}`)}
                          className="w-full flex items-center gap-3 py-2.5 text-left cursor-pointer"
                        >
                          <span className={cx('size-12 rounded-full grid place-items-center shrink-0', tone)}>
                            <Icon className="size-5" aria-hidden />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[15px] font-semibold truncate">{c.name}</span>
                            <span className="block text-[13px] text-ink-2 truncate">
                              {c.last_body ? `${c.last_sender}: ${c.last_body}` : 'No messages yet'}
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[11.5px] text-muted">{c.last_at ? relTime(c.last_at) : ''}</span>
                            {c.unread > 0 && (
                              <span className="min-w-5 h-5 px-1.5 rounded-md bg-brand-600 text-white text-[11px] font-semibold grid place-items-center">
                                {c.unread}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </Async>

      <section>
        <h2 className="text-[16px] font-semibold mb-3">Community Features</h2>
        <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
          {FEATURES.map(({ icon: Icon, label, to, tone }) => (
            <button key={label} onClick={() => nav(to)} className="flex flex-col items-center gap-1.5 cursor-pointer">
              <span className={cx('size-14 rounded-2xl grid place-items-center', tone)}>
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="text-[12px] text-ink-2">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {newPost && <NewPostSheet onClose={() => setNewPost(false)} onDone={(kind) => nav(`/resident/community/${kindSlug(kind)}`)} />}
    </>
  );
}

/** URL slug for a post kind. */
const kindSlug = (k: string) =>
  ({ lost_found: 'lost-found', marketplace: 'marketplace', suggestion: 'suggestions', feedback: 'feedback' })[k] ?? 'lost-found';
