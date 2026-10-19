/** Staff view of resident posts in the selected building: reply (resident is notified) and close. */
import { useState } from 'react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { inr, relTime } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Button, Card, Drawer, Empty, ErrorBanner, Field, Select, Textarea } from '../../../components/ui';
import { listPosts, respondPost } from '../../community/api';
import { POST_KIND_LABEL, type CommunityPost, type PostKind } from '../../community/types';

const ALL_KINDS: PostKind[] = ['suggestion', 'feedback', 'lost_found', 'marketplace'];

export function ResidentPosts({ onToast }: { onToast: (m: string) => void }) {
  const { buildingId } = useBuilding();
  const [kind, setKind] = useState<PostKind | ''>('');
  const st = useAsync(() => listPosts(kind ? [kind] : ALL_KINDS, buildingId), [kind, buildingId]);
  const [open, setOpen] = useState<CommunityPost | null>(null);

  const filter = (
    <Select value={kind} onChange={(e) => setKind(e.target.value as PostKind | '')} className="w-44 h-9" aria-label="Post type">
      <option value="">All types</option>
      {ALL_KINDS.map((k) => <option key={k} value={k}>{POST_KIND_LABEL[k]}</option>)}
    </Select>
  );

  return (
    <Card title="Resident posts" action={filter}>
      <p className="text-[13px] text-muted -mt-2 mb-3">
        Suggestions and feedback are private to the office. Lost & Found and Marketplace posts are visible to the building.
      </p>
      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No posts" />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((x) => (
                <li key={x.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {x.title} {x.price != null && <span className="text-brand-700 tabular">· {inr(x.price)}</span>}
                    </p>
                    <p className="text-[12px] text-muted">
                      {POST_KIND_LABEL[x.kind]} · {x.author_name} · {relTime(x.created_at)}
                    </p>
                    <p className="text-[13px] text-ink-2 mt-1 line-clamp-2">{x.body}</p>
                    {x.staff_response && <p className="text-[12.5px] text-brand-700 mt-1">Replied: {x.staff_response}</p>}
                  </div>
                  <Badge status={x.status === 'open' ? 'active' : 'closed'}>{x.status === 'open' ? 'Open' : 'Closed'}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setOpen(x)}>Respond</Button>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
      {open && (
        <RespondDrawer
          post={open}
          onClose={() => setOpen(null)}
          onDone={(m) => {
            setOpen(null);
            onToast(m);
            st.reload();
          }}
        />
      )}
    </Card>
  );
}

function RespondDrawer({ post, onClose, onDone }: { post: CommunityPost; onClose: () => void; onDone: (m: string) => void }) {
  const [reply, setReply] = useState(post.staff_response ?? '');
  const [close, setClose] = useState(false);
  const m = useMutation(() => respondPost(post.id, reply.trim() || null, close));
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={!reply.trim() && !close}
        onClick={async () => {
          if ((await m.run()) !== undefined) onDone(reply.trim() ? 'Reply sent — resident notified' : 'Post closed');
        }}
      >
        Save
      </Button>
    </>
  );
  return (
    <Drawer open onClose={onClose} title={POST_KIND_LABEL[post.kind]} footer={footer}>
      <ErrorBanner error={m.error} />
      <div>
        <p className="font-semibold">{post.title}</p>
        <p className="text-[12px] text-muted">{post.author_name} · {relTime(post.created_at)}</p>
        <p className="text-[13px] text-ink-2 mt-2 whitespace-pre-wrap">{post.body}</p>
      </div>
      <Field label="Reply to resident">
        {(id) => <Textarea id={id} rows={4} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} />}
      </Field>
      {post.status === 'open' && (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} />
          Close this post
        </label>
      )}
    </Drawer>
  );
}
