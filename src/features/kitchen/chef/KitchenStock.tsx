/** Chef stock screen: store vs kitchen levels per item, issue/return, purchases, and the movement ledger. */
import { useState } from 'react';
import { ArrowRightLeft, Plus } from 'lucide-react';
import { num } from '../../../lib/format';
import { useAuth } from '../../access/useAuth';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Button, Empty, Tabs, Toast } from '../../../components/ui';
import { BuildingPicker } from '../../../components/BuildingPicker';
import { stockStatus } from '../stock';
import type { StockRow } from '../types';
import { useStock } from '../useStock';
import { AddItemDrawer } from '../components/AddItemDrawer';
import { MoveDrawer } from '../components/MoveDrawer';
import { MovementHistory } from '../components/MovementHistory';
import { ItemAvatar } from './ui/ItemAvatar';
import { KitchenTopBar } from './ui/KitchenHeaders';

export function KitchenStock() {
  const { buildingId } = useBuilding();
  const { staff } = useAuth();
  const st = useStock(buildingId);
  const [move, setMove] = useState<{ item?: StockRow; action: string } | null>(null);
  const [add, setAdd] = useState(false);
  const [tab, setTab] = useState<'levels' | 'history'>('levels');
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      <KitchenTopBar
        title="Stock"
        action={
          <button onClick={() => setAdd(true)} aria-label="Add item" className="p-2 rounded-lg hover:bg-white cursor-pointer">
            <Plus className="size-6" />
          </button>
        }
      />
      <div className="flex flex-wrap gap-2">
        <BuildingPicker />
        <Button variant="kitchen" className="flex-1" onClick={() => setMove({ action: 'issue' })}>
          <ArrowRightLeft className="size-4" />
          Issue to kitchen
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setMove({ action: 'purchase' })}>Record purchase</Button>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'levels', label: 'Stock levels' },
          { id: 'history', label: 'Movements' },
        ]}
      />
      {tab === 'levels' ? (
        <Async state={st}>
          {(rows) =>
            rows.length === 0 ? (
              <Empty title="No items yet" />
            ) : (
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li key={r.item_id} className="bg-white border border-line rounded-2xl p-3 flex items-center gap-3">
                    <ItemAvatar name={r.name} category={r.category} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{r.name}</p>
                        <Badge status={stockStatus(r)} />
                      </div>
                      <p className="text-[12.5px] text-muted">
                        Store {num(r.store_qty, 3)} · Kitchen {num(r.kitchen_qty, 3)} {r.base_unit}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setMove({ item: r, action: 'issue' })}>Issue</Button>
                      {Number(r.kitchen_qty) > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setMove({ item: r, action: 'return' })}>Return</Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
      ) : (
        <MovementHistory buildingId={buildingId} />
      )}
      {move && (
        <MoveDrawer
          tone="kitchen"
          items={st.data ?? []}
          initial={move}
          // Adjustments and supplier choice are for owners/managers opening the kitchen portal.
          canAdjust={!!staff}
          onClose={() => setMove(null)}
          onDone={(m) => {
            setMove(null);
            setToast(m);
            st.reload();
          }}
        />
      )}
      <AddItemDrawer
        open={add}
        onClose={() => setAdd(false)}
        onDone={() => {
          setAdd(false);
          setToast('Item added');
          st.reload();
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
