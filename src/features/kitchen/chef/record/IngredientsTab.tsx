/** Ingredients tab: search kitchen stock to add an item, edit quantities used, then "Save Usage". */
import { useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowRightLeft, Plus, Search } from 'lucide-react';
import { num } from '../../../../lib/format';
import { Button, Empty, Input } from '../../../../components/ui';
import type { IngredientLine, StockRow } from '../../types';
import { ItemAvatar } from '../ui/ItemAvatar';
import { QtyRow } from './QtyRow';

export function IngredientsTab({ items, used, setUsed, onSave, onIssue }: {
  items: StockRow[];
  used: IngredientLine[];
  setUsed: Dispatch<SetStateAction<IngredientLine[]>>;
  onSave: () => void;
  onIssue: () => void;
}) {
  const [search, setSearch] = useState('');
  const taken = used.map((l) => l.item_id);
  const s = search.trim().toLowerCase();
  const matches = s
    ? items.filter((x) => Number(x.kitchen_qty) > 0 && !taken.includes(x.item_id) && x.name.toLowerCase().includes(s)).slice(0, 6)
    : [];
  const issuedCount = items.filter((x) => Number(x.kitchen_qty) > 0).length;

  if (issuedCount === 0 && used.length === 0) {
    return (
      <Empty
        title="Nothing in kitchen stock"
        action={
          <Button variant="kitchen" onClick={onIssue}>
            <ArrowRightLeft className="size-4" />
            Issue from store
          </Button>
        }
      >
        Issue ingredients first, then record usage.
      </Empty>
    );
  }

  return (
    <>
      <div className="relative">
        <label className="relative block">
          <span className="sr-only">Search ingredient</span>
          <Search className="size-4 text-muted absolute left-3.5 top-3.5" aria-hidden />
          <Input placeholder="Search ingredient…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl" />
        </label>
        {s && (
          <ul className="absolute z-20 mt-1 w-full bg-white border border-line rounded-xl shadow-lg p-1">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-muted">No other kitchen-stock item matches. Issue it from the store first.</li>
            ) : (
              matches.map((x) => (
                <li key={x.item_id}>
                  <button
                    onClick={() => {
                      setUsed([...used, { item_id: x.item_id, quantity: '' }]);
                      setSearch('');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-subtle text-left cursor-pointer"
                  >
                    <ItemAvatar name={x.name} category={x.category} size={32} />
                    <span className="flex-1 text-[14px]">{x.name}</span>
                    <span className="text-[12px] text-muted">{num(x.kitchen_qty, 3)} {x.base_unit}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <section className="bg-white border border-line rounded-2xl px-3 divide-y divide-line">
        {used.map((l, i) => (
          <QtyRow
            key={i}
            line={l}
            items={items}
            taken={taken}
            pickItem={!l.item_id}
            onChange={(patch) => setUsed(used.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
            onRemove={() => setUsed(used.filter((_, j) => j !== i))}
          />
        ))}
      </section>

      <div className="flex justify-center">
        <Button variant="secondary" onClick={() => setUsed([...used, { item_id: '', quantity: '' }])}>
          <Plus className="size-4" />
          Add Another Ingredient
        </Button>
      </div>
      <Button variant="kitchen" className="w-full h-12 text-[16px]" onClick={onSave}>Save Usage</Button>
    </>
  );
}
