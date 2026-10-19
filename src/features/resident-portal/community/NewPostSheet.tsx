/**
 * New community post. Lost & Found and Marketplace posts are visible to everyone in the building;
 * Suggestions and Feedback go privately to the PG office.
 */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { Button, Drawer, ErrorBanner, Field, Input, Select, Textarea } from '../../../components/ui';
import { createPost } from '../../community/api';
import { POST_KIND_LABEL, type PostKind } from '../../community/types';

const KINDS: PostKind[] = ['lost_found', 'marketplace', 'suggestion', 'feedback'];

export function NewPostSheet({ kind: initial, onClose, onDone }: {
  kind?: PostKind;
  onClose: () => void;
  onDone: (kind: PostKind) => void;
}) {
  const [kind, setKind] = useState<PostKind>(initial ?? 'lost_found');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState('');
  const m = useMutation(() =>
    createPost({ kind, title, body, price: kind === 'marketplace' && price ? Number(price) : null }),
  );
  const isPrivate = kind === 'suggestion' || kind === 'feedback';

  const footer = (
    <Button
      busy={m.busy}
      disabled={title.trim().length < 3 || !body.trim()}
      onClick={async () => {
        if (await m.run()) onDone(kind);
      }}
    >
      Post
    </Button>
  );

  return (
    <Drawer open onClose={onClose} title="New post" footer={footer}>
      <ErrorBanner error={m.error} />
      {!initial && (
        <Field label="Type">
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as PostKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{POST_KIND_LABEL[k]}</option>)}
            </Select>
          )}
        </Field>
      )}
      <p className="text-[12.5px] rounded-lg bg-subtle px-3 py-2 text-ink-2">
        {isPrivate ? 'Only the PG office will see this.' : 'Everyone in your building can see this post.'}
      </p>
      <Field label="Title" required>
        {(id) => (
          <Input
            id={id}
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'lost_found' ? 'e.g. Found: blue umbrella' : kind === 'marketplace' ? 'e.g. Selling cycle' : 'Short summary'}
          />
        )}
      </Field>
      <Field label="Details" required>
        {(id) => <Textarea id={id} maxLength={2000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      {kind === 'marketplace' && (
        <Field label="Price (₹)" hint="Leave empty if free or negotiable">
          {(id) => <Input id={id} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />}
        </Field>
      )}
    </Drawer>
  );
}
