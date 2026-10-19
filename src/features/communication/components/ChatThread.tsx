/**
 * One chat channel: messages, pinned banner and composer.
 * Refreshes by polling every 8 s while the tab is visible (Supabase Realtime is not used yet).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Pin, Send } from 'lucide-react';
import { useMutation } from '../../../lib/hooks';
import { relTime } from '../../../lib/format';
import { cx } from '../../../lib/cx';
import { Button, Empty, ErrorBanner, Input } from '../../../components/ui';
import { listChatMessages, sendChatMessage, setMessagePinned } from '../api';
import type { ChatChannel, ChatMessage } from '../types';

const POLL_MS = 8000;

export function ChatThread({ channel, me, staffView }: { channel: ChatChannel; me: string; staffView: boolean }) {
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const load = async () => {
    const rows = await listChatMessages(channel.id);
    setMsgs(rows.reverse()); // API returns newest first; show oldest at the top.
  };
  useEffect(() => {
    load().catch(() => setMsgs([]));
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load().catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [msgs?.length]);

  const send = useMutation(() => sendChatMessage(channel.id, text));
  const pin = useMutation((id: string, v: boolean) => setMessagePinned(id, v));
  const canPost = staffView || channel.residents_can_post;
  const pinned = (msgs ?? []).filter((m) => m.is_pinned);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if ((await send.run()) !== undefined) {
      setText('');
      await load();
    }
  };

  return (
    <>
      <header className="px-4 h-12 border-b border-line flex items-center justify-between shrink-0">
        <p className="font-semibold text-[14px] truncate">{channel.name}</p>
        {!channel.residents_can_post && <span className="text-[12px] text-muted">Announcements only</span>}
      </header>
      {pinned.length > 0 && (
        <div className="px-4 py-2 bg-warn-bg/60 border-b border-line text-[12.5px] flex gap-2">
          <Pin className="size-3.5 mt-0.5 text-warn shrink-0" aria-hidden />
          <span className="line-clamp-2">
            <b>Pinned:</b> {pinned[pinned.length - 1].body}
          </span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-subtle/40" aria-live="polite">
        {msgs === null ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : msgs.length === 0 ? (
          <Empty title="No messages yet">Start the conversation.</Empty>
        ) : (
          msgs.map((m) => {
            const mine = m.sender_user_id === me;
            return (
              <div key={m.id} className={cx('flex flex-col max-w-[80%]', mine ? 'ml-auto items-end' : 'items-start')}>
                <span className="text-[11.5px] text-muted mb-0.5">
                  {mine ? 'You' : m.sender_name}
                  {m.sender_is_staff && <span className="ml-1 text-brand-600 font-medium">· Staff</span>}
                </span>
                <div
                  className={cx(
                    'rounded-2xl px-3 py-2 text-[13.5px] whitespace-pre-wrap break-words',
                    mine ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white border border-line rounded-bl-sm',
                  )}
                >
                  {m.body}
                </div>
                <span className="text-[10.5px] text-muted mt-0.5 flex items-center gap-2">
                  {relTime(m.created_at)}
                  {staffView && (
                    <button
                      className="hover:text-ink cursor-pointer"
                      onClick={async () => {
                        await pin.run(m.id, !m.is_pinned);
                        load();
                      }}
                    >
                      {m.is_pinned ? 'Unpin' : 'Pin'}
                    </button>
                  )}
                </span>
              </div>
            );
          })
        )}
        <div ref={end} />
      </div>
      {canPost ? (
        <form onSubmit={submit} className="p-3 border-t border-line flex gap-2 shrink-0">
          <Input
            aria-label="Message"
            placeholder="Type a message…"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" busy={send.busy} disabled={!text.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
      ) : (
        <p className="p-3 border-t border-line text-[12.5px] text-muted text-center">Only staff can post in this channel.</p>
      )}
      {send.error && (
        <div className="px-3 pb-3">
          <ErrorBanner error={send.error} />
        </div>
      )}
    </>
  );
}
