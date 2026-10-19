/**
 * Record one stock movement: purchase, issue to kitchen, return to store, wastage, or (owner/manager)
 * an adjustment. The idempotency key changes only after a successful save, so a retry posts once.
 */
import { useState } from 'react';
import { newKey } from '../../../lib/api';
import { useAsync, useMutation } from '../../../lib/hooks';
import { inr, num } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Button, Drawer, ErrorBanner, Field, Input, Select } from '../../../components/ui';
import { listActiveVendors } from '../../expenses/api';
import type { VendorOption } from '../../expenses/types';
import { inventoryMove } from '../api';
import { ADJUST_ACTIONS, MOVE_ACTIONS } from '../stock';
import type { StockRow } from '../types';

export function MoveDrawer({ items, initial, canAdjust, onClose, onDone, tone }: {
  items: StockRow[];
  /** Pre-selected item and movement. */
  initial: { item?: StockRow; action: string };
  /** Owners/managers may adjust stock and pick a supplier. */
  canAdjust: boolean;
  onClose: () => void;
  onDone: (m: string) => void;
  /** 'kitchen' styles the save button for the chef portal. */
  tone?: 'kitchen';
}) {
  const { buildingId } = useBuilding();
  const [action, setAction] = useState(initial.action);
  const [itemId, setItemId] = useState(initial.item?.item_id ?? '');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [key, setKey] = useState(newKey);
  const vendors = useAsync(
    () => (action === 'purchase' && canAdjust ? listActiveVendors() : Promise.resolve([] as VendorOption[])),
    [action],
  );
  const item = items.find((i) => i.item_id === itemId);
  const m = useMutation(() =>
    inventoryMove({
      buildingId,
      itemId,
      action,
      quantity: Number(qty),
      unitCost: action === 'purchase' && cost ? Number(cost) : null,
      vendorId: vendor || null,
      notes: notes || null,
      idempotencyKey: key,
    }),
  );
  const actions = [...MOVE_ACTIONS, ...(canAdjust ? ADJUST_ACTIONS : [])];

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button
        variant={tone ?? 'primary'}
        busy={m.busy}
        disabled={!itemId || !(Number(qty) > 0)}
        onClick={async () => {
          if (await m.run()) {
            setKey(newKey());
            onDone(`${actions.find((a) => a[0] === action)![1]} recorded`);
          }
        }}
      >
        Save
      </Button>
    </>
  );

  return (
    <Drawer open onClose={onClose} title="Stock movement" footer={footer}>
      <ErrorBanner error={m.error} />
      <Field label="Movement">
        {(id) => (
          <Select id={id} value={action} onChange={(e) => setAction(e.target.value)}>
            {actions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Item" required>
        {(id) => (
          <Select id={id} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Select item</option>
            {items.map((i) => (
              <option key={i.item_id} value={i.item_id}>
                {i.name} (store {num(i.store_qty, 3)} · kitchen {num(i.kitchen_qty, 3)} {i.base_unit})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={`Quantity${item ? ` (${item.base_unit})` : ''}`} required>
        {(id) => <Input id={id} type="number" min={0} step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} />}
      </Field>
      {action === 'purchase' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit price (₹)">
            {(id) => <Input id={id} type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />}
          </Field>
          {canAdjust && (
            <Field label="Supplier">
              {(id) => (
                <Select id={id} value={vendor} onChange={(e) => setVendor(e.target.value)}>
                  <option value="">—</option>
                  {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              )}
            </Field>
          )}
        </div>
      )}
      {action === 'purchase' && Number(qty) > 0 && Number(cost) > 0 && (
        <p className="text-[13px]">
          Purchase value: <b>{inr(Number(qty) * Number(cost), true)}</b>. Record the bill under Expenses to track payment.
        </p>
      )}
      <Field label={action === 'wastage' ? 'Reason' : 'Notes'}>
        {(id) => (
          <Input
            id={id}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={action === 'wastage' ? 'e.g. Overripe / spoiled' : ''}
          />
        )}
      </Field>
    </Drawer>
  );
}
