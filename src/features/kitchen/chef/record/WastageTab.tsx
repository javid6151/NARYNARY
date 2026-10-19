/** Wastage/Return tab: unused quantities returned to the store, and wasted/spoiled quantities with a reason. */
import type { Dispatch, SetStateAction } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../../components/ui';
import type { IngredientLine, StockRow } from '../../types';
import { QtyRow } from './QtyRow';

function Section({ title, hint, lines, setLines, items, withReason, addLabel }: {
  title: string;
  hint: string;
  lines: IngredientLine[];
  setLines: Dispatch<SetStateAction<IngredientLine[]>>;
  items: StockRow[];
  withReason?: boolean;
  addLabel: string;
}) {
  const taken = lines.map((l) => l.item_id);
  return (
    <section className="bg-white border border-line rounded-2xl p-4">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <p className="text-[12.5px] text-muted">{hint}</p>
      <div className="divide-y divide-line">
        {lines.map((l, i) => (
          <QtyRow
            key={i}
            line={l}
            items={items}
            taken={taken}
            pickItem
            withReason={withReason}
            onChange={(patch) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
            onRemove={() => setLines(lines.filter((_, j) => j !== i))}
          />
        ))}
      </div>
      <div className="flex justify-center mt-3">
        <Button variant="secondary" onClick={() => setLines([...lines, { item_id: '', quantity: '' }])}>
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </div>
    </section>
  );
}

export function WastageTab({ items, returns, setReturns, waste, setWaste, onNext }: {
  items: StockRow[];
  returns: IngredientLine[];
  setReturns: Dispatch<SetStateAction<IngredientLine[]>>;
  waste: IngredientLine[];
  setWaste: Dispatch<SetStateAction<IngredientLine[]>>;
  onNext: () => void;
}) {
  return (
    <>
      <Section
        title="Unused / Returned to Store"
        hint="If any ingredient is unused, add the quantity returned."
        lines={returns}
        setLines={setReturns}
        items={items}
        addLabel="Add Returned Item"
      />
      <Section
        title="Wastage / Spoilage"
        hint="If any ingredient was wasted or spoiled, add the quantity and reason."
        lines={waste}
        setLines={setWaste}
        items={items}
        withReason
        addLabel="Add Wastage Item"
      />
      <Button variant="kitchen" className="w-full h-12 text-[16px]" onClick={onNext}>Next: View Summary</Button>
    </>
  );
}
