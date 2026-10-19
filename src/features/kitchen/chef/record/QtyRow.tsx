/**
 * One ingredient line: item (fixed name, or a picker for new lines), unit, quantity, remove button
 * and, for wastage, a reason. Pickers only offer items with kitchen stock (plus the current one).
 */
import { MinusCircle } from 'lucide-react';
import { num } from '../../../../lib/format';
import { Input, Select } from '../../../../components/ui';
import type { IngredientLine, StockRow } from '../../types';
import { unitOptions } from '../../units';
import { ItemAvatar } from '../ui/ItemAvatar';

const WASTE_REASONS = ['Overripe / Spoiled', 'Burnt / Overcooked', 'Cleaning waste', 'Leftover discarded', 'Other'];

export function QtyRow({ line, items, taken, onChange, onRemove, withReason, pickItem }: {
  line: IngredientLine;
  items: StockRow[];
  /** Item ids already used in this list (hidden from the picker). */
  taken: string[];
  onChange: (patch: Partial<IngredientLine>) => void;
  onRemove: () => void;
  withReason?: boolean;
  /** Show an item picker instead of a fixed name. */
  pickItem?: boolean;
}) {
  const item = items.find((i) => i.item_id === line.item_id);
  const units = item ? unitOptions(item.base_unit) : [];
  const choices = items.filter((x) => (Number(x.kitchen_qty) > 0 && !taken.includes(x.item_id)) || x.item_id === line.item_id);

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-2">
        <ItemAvatar name={item?.name ?? '?'} category={item?.category} size={40} />
        {pickItem ? (
          <div className="flex-1 min-w-0">
          <Select aria-label="Ingredient" value={line.item_id} onChange={(e) => onChange({ item_id: e.target.value, unit: undefined })}>
            <option value="">Select item</option>
            {choices.map((x) => (
              <option key={x.item_id} value={x.item_id}>
                {x.name} ({num(x.kitchen_qty, 3)} {x.base_unit})
              </option>
            ))}
          </Select>
          </div>
        ) : (
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] truncate">{item?.name}</span>
            {item && <span className="block text-[11.5px] text-muted truncate">Kitchen: {num(item.kitchen_qty, 3)} {item.base_unit}</span>}
          </span>
        )}
        {/* Fixed-width wrappers: the shared Input/Select are full width by default. */}
        <div className="w-[74px] shrink-0">
          <Select
            aria-label="Unit"
            value={line.unit ?? item?.base_unit ?? ''}
            disabled={units.length < 2}
            onChange={(e) => onChange({ unit: e.target.value })}
            style={{ paddingLeft: 10, paddingRight: 20 }}
          >
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </div>
        <div className="w-[72px] shrink-0">
          <Input
            aria-label="Quantity"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.001"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            className="px-2"
          />
        </div>
        <button onClick={onRemove} aria-label="Remove line" className="p-1.5 rounded-full text-bad hover:bg-bad-bg cursor-pointer shrink-0">
          <MinusCircle className="size-5" />
        </button>
      </div>
      {withReason && (
        <div className="mt-2 ml-12 mr-9">
          <Select aria-label="Reason" value={line.reason ?? ''} onChange={(e) => onChange({ reason: e.target.value })}>
            <option value="">Reason…</option>
            {WASTE_REASONS.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </div>
      )}
    </div>
  );
}
