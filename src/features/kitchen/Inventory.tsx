/**
 * Inventory page (owner/manager): stock per building in the main store and the kitchen,
 * purchases, issues, adjustments and the movement ledger.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Download, History, IndianRupee, Package, Plus, Search, ShoppingCart, XCircle } from 'lucide-react';
import { downloadCsv, inr, num } from '../../lib/format';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Badge, Button, Card, Drawer, Empty, Input, PageHeader, Select, StatCard, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { CATEGORIES, stockStatus } from './stock';
import type { StockRow } from './types';
import { useStock } from './useStock';
import { AddItemDrawer } from './components/AddItemDrawer';
import { MoveDrawer } from './components/MoveDrawer';
import { MovementHistory } from './components/MovementHistory';

export default function Inventory() {
  const { buildingId, building } = useBuilding();
  const { staff } = useAuth();
  const [tab, setTab] = useState<'items' | 'history'>('items');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [move, setMove] = useState<{ item?: StockRow; action: string } | null>(null);
  const [addItem, setAddItem] = useState(false);
  const [hist, setHist] = useState<StockRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const st = useStock(buildingId);
  const rows = useMemo(() => st.data ?? [], [st.data]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!search || r.name.toLowerCase().includes(search.toLowerCase())) &&
          (!cat || r.category === cat) &&
          (!status || stockStatus(r) === status),
      ),
    [rows, search, cat, status],
  );
  // Valued at each item's last purchase price.
  const value = rows.reduce((s, r) => s + (Number(r.store_qty) + Number(r.kitchen_qty)) * Number(r.last_unit_cost ?? 0), 0);

  const exportCsv = () =>
    downloadCsv(`stock-${building?.name}.csv`, rows.map((r) => ({
      item: r.name,
      category: r.category,
      unit: r.base_unit,
      store: r.store_qty,
      kitchen: r.kitchen_qty,
      reorder_level: r.reorder_level,
      status: stockStatus(r),
      last_unit_cost: r.last_unit_cost ?? '',
    })));

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Stock per building: main store and kitchen. Every movement is an auditable ledger entry."
        actions={
          <>
            <BuildingPicker />
            <Button variant="secondary" onClick={() => setAddItem(true)}>
              <Plus className="size-4" />
              Add item
            </Button>
            <Button variant="secondary" onClick={() => setMove({ action: 'issue' })}>
              <ArrowRightLeft className="size-4" />
              Issue to kitchen
            </Button>
            <Button onClick={() => setMove({ action: 'purchase' })}>
              <ShoppingCart className="size-4" />
              Record purchase
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Package className="size-5" />} label="Items tracked" value={rows.length} />
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          tone="warn"
          label="Low stock"
          value={rows.filter((r) => stockStatus(r) === 'low_stock').length}
          onClick={() => setStatus('low_stock')}
        />
        <StatCard
          icon={<XCircle className="size-5" />}
          tone="bad"
          label="Out of stock"
          value={rows.filter((r) => stockStatus(r) === 'out_of_stock').length}
          onClick={() => setStatus('out_of_stock')}
        />
        <StatCard icon={<IndianRupee className="size-5" />} tone="ok" label="Stock value (last cost)" value={inr(value)} />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'items', label: 'Stock levels' },
          { id: 'history', label: 'Movement history' },
        ]}
      />
      {tab === 'items' ? (
        <Card>
          <div className="flex flex-wrap gap-2 mb-4">
            <label className="relative">
              <span className="sr-only">Search items</span>
              <Search className="size-4 text-muted absolute left-3 top-3" aria-hidden />
              <Input placeholder="Search item…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
            </label>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-48" aria-label="Category">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label="Status">
              <option value="">All statuses</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </Select>
            <div className="flex-1" />
            <Button variant="secondary" disabled={!rows.length} onClick={exportCsv}>
              <Download className="size-4" />
              CSV
            </Button>
          </div>
          <Async state={st}>
            {() =>
              filtered.length === 0 ? (
                <Empty title="No items" action={<Button onClick={() => setAddItem(true)}>Add item</Button>} />
              ) : (
                <Table head={['Item', 'Category', 'Store', 'Kitchen', 'Reorder at', 'Last unit cost', 'Status', '']}>
                  {filtered.map((r) => (
                    <tr key={r.item_id} className="hover:bg-subtle/60">
                      <Td className="font-medium">{r.name}</Td>
                      <Td>{r.category}</Td>
                      <Td className="tabular">{num(r.store_qty, 3)} {r.base_unit}</Td>
                      <Td className="tabular">{num(r.kitchen_qty, 3)} {r.base_unit}</Td>
                      <Td className="tabular">{num(r.reorder_level, 3)}</Td>
                      <Td className="tabular">{r.last_unit_cost ? inr(r.last_unit_cost, true) : '—'}</Td>
                      <Td><Badge status={stockStatus(r)} /></Td>
                      <Td>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setMove({ item: r, action: 'purchase' })}>Buy</Button>
                          <Button variant="ghost" size="sm" onClick={() => setMove({ item: r, action: 'issue' })}>Issue</Button>
                          <Button variant="ghost" size="sm" onClick={() => setHist(r)} aria-label={`History for ${r.name}`}>
                            <History className="size-4" />
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </Table>
              )
            }
          </Async>
        </Card>
      ) : (
        <MovementHistory buildingId={buildingId} />
      )}
      {move && (
        <MoveDrawer
          items={rows}
          initial={move}
          canAdjust={staff?.role === 'owner' || staff?.role === 'manager'}
          onClose={() => setMove(null)}
          onDone={(m) => {
            setMove(null);
            setToast(m);
            st.reload();
          }}
        />
      )}
      <AddItemDrawer
        open={addItem}
        onClose={() => setAddItem(false)}
        onDone={() => {
          setAddItem(false);
          setToast('Item added');
          st.reload();
        }}
      />
      {hist && (
        <Drawer open onClose={() => setHist(null)} title={`Stock history — ${hist.name}`} wide>
          <MovementHistory buildingId={buildingId} itemId={hist.item_id} />
        </Drawer>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
