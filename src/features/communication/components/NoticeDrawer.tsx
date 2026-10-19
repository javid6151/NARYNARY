/** Form to publish a notice to the selected building (or, for owners, to all buildings). */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { label } from '../../../lib/format';
import { useAuth } from '../../access/useAuth';
import { useBuilding } from '../../access/useBuilding';
import { Button, Drawer, ErrorBanner, Field, Input, Select, Textarea } from '../../../components/ui';
import { publishNotice } from '../api';

const CATEGORIES = ['announcement', 'important', 'event', 'food_menu', 'maintenance'];

export function NoticeDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { staff } = useAuth();
  const { buildingId, building } = useBuilding();
  const [f, setF] = useState({ title: '', body: '', category: 'announcement', scope: 'building', expires: '' });
  const m = useMutation(() =>
    publishNotice({
      buildingId: f.scope === 'all' ? null : buildingId,
      title: f.title,
      body: f.body,
      category: f.category,
      // Expires at the end of the chosen day (local time).
      expiresAt: f.expires ? new Date(f.expires + 'T23:59:59').toISOString() : null,
    }),
  );

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={f.title.length < 3 || !f.body.trim()}
        onClick={async () => {
          if (await m.run()) {
            setF({ ...f, title: '', body: '' });
            onDone();
          }
        }}
      >
        Publish
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="New announcement" footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Title" required>
        {(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}
      </Field>
      <Field label="Message" required>
        {(id) => <Textarea id={id} rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          {(id) => (
            <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Send to">
          {(id) => (
            <Select id={id} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>
              <option value="building">{building?.name}</option>
              {staff?.role === 'owner' && <option value="all">All buildings</option>}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Expires on" hint="Optional — hidden from residents after this date">
        {(id) => <Input id={id} type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} />}
      </Field>
    </Drawer>
  );
}
