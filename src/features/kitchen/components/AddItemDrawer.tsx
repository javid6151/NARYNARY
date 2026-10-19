/** Add an inventory item to the tenant's catalogue (shared by all buildings; stock is per building). */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { useBuilding } from '../../access/useBuilding';
import { Button, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { addInventoryItem } from '../api';
import { CATEGORIES, UNITS } from '../stock';

export function AddItemDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { tenantId } = useBuilding();
  const [f, setF] = useState({ name: '', category: 'Grains & Rice', base_unit: 'kg', reorder_level: '' });
  const m = useMutation(() =>
    addInventoryItem({
      tenantId,
      name: f.name.trim(),
      category: f.category,
      baseUnit: f.base_unit,
      reorderLevel: Number(f.reorder_level || 0),
    }),
  );

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        busy={m.busy}
        disabled={f.name.trim().length < 2}
        onClick={async () => {
          if (await m.run()) {
            setF({ ...f, name: '', reorder_level: '' });
            onDone();
          }
        }}
      >
        Add item
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Add inventory item" footer={footer}>
      <ErrorBanner error={m.error} />
      <p className="text-[13px] text-muted">Items are shared across your buildings; stock is tracked separately per building.</p>
      <Field label="Item name" required>
        {(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Basmati Rice" />}
      </Field>
      <Field label="Category">
        {(id) => (
          <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit">
          {(id) => (
            <Select id={id} value={f.base_unit} onChange={(e) => setF({ ...f, base_unit: e.target.value })}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Reorder level" hint="Alert at or below this">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              step="0.001"
              value={f.reorder_level}
              onChange={(e) => setF({ ...f, reorder_level: e.target.value })}
            />
          )}
        </Field>
      </div>
    </Drawer>
  );
}
