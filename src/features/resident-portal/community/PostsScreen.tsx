/**
 * One community post type (`/resident/community/:kind`): the posts the resident can see,
 * a "New" button, the office's reply, and "Mark resolved" on the resident's own open posts.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { inr, relTime } from '../../../lib/format';
import { Async, Badge, Button, Empty, ErrorBanner, Toast } from '../../../components/ui';
import { listPosts, respondPost } from '../../community/api';
import { POST_KIND_LABEL, type PostKind } from '../../community/types';
import type { ResidentProfile } from '../types';
import { TopBar } from '../ui/Headers';
import { NewPostSheet } from './NewPostSheet';

const SLUG_KIND: Record<string, PostKind> = {
  'lost-found': 'lost_found',
  marketplace: 'marketplace',
  suggestions: 'suggestion',
  feedback: 'feedback',
};

const INTRO: Record<PostKind, string> = {
  lost_found: 'Lost or found something in the building? Post it here.',
  marketplace: 'Buy, sell or give away things within your building.',
  suggestion: 'Ideas to make the PG better. Only the office sees these.',
  feedback: 'Tell the office how things are going. Only the office sees this.',
};

export function PostsScreen({ p }: { p: ResidentProfile }) {
  const { kind: slug = 'lost-found' } = useParams();
  const kind = SLUG_KIND[slug] ?? 'lost_found';
  const st = useAsync(() => listPosts([kind]), [kind]);
  const [create, setCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const close = useMutation((id: string) => respondPost(id, null, true));

  const newButton = (
    <button onClick={() => setCreate(true)} aria-label="New post" className="p-2 rounded-lg hover:bg-white cursor-pointer">
      <Plus className="size-6" />
    </button>
  );

  return (
    <>
      <TopBar title={POST_KIND_LABEL[kind]} back="/resident/community" action={newButton} />
      <p className="text-[13px] text-muted -mt-2">{INTRO[kind]}</p>
      <ErrorBanner error={close.error} />
      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="Nothing here yet" action={<Button onClick={() => setCreate(true)}>Create a post</Button>} />
          ) : (
            <ul className="space-y-3">
              {rows.map((x) => {
                const mine = x.resident_id === p.resident_id;
                return (
                  <li key={x.id} className="bg-white border border-line rounded-2xl p-4 text-[13.5px]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{x.title}</p>
                      <Badge status={x.status === 'open' ? 'active' : 'closed'}>{x.status === 'open' ? 'Open' : 'Resolved'}</Badge>
                    </div>
                    {x.price != null && <p className="text-brand-700 font-semibold tabular mt-0.5">{inr(x.price)}</p>}
                    <p className="text-ink-2 mt-1 whitespace-pre-wrap">{x.body}</p>
                    <p className="text-[12px] text-muted mt-2">
                      {mine ? 'You' : x.author_name} · {relTime(x.created_at)}
                    </p>
                    {x.staff_response && (
                      <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-[13px]">
                        <b className="text-brand-700">PG office:</b> {x.staff_response}
                      </p>
                    )}
                    {mine && x.status === 'open' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        busy={close.busy}
                        onClick={async () => {
                          if ((await close.run(x.id)) !== undefined) {
                            setToast('Marked as resolved');
                            st.reload();
                          }
                        }}
                      >
                        Mark resolved
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        }
      </Async>
      {create && (
        <NewPostSheet
          kind={kind}
          onClose={() => setCreate(false)}
          onDone={() => {
            setCreate(false);
            setToast('Posted');
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
