/**
 * Unified Inventory management page (Owner/Manager):
 * Single stock per building, Expected vs. Actual stock tracking,
 * Physical Stock Verification & Reconciliation, and Permanent Transaction History.
 */
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  History,
  IndianRupee,
  Package,
  Plus,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { downloadCsv, fmtDate, inr, num } from '../../lib/format';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import {
  Async,
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Select,
  StatCard,
  Table,
  Tabs,
  Td,
  Toast,
} from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { CATEGORIES, reconciliationStatus, stockStatus } from './stock';
import type { StockRow } from './types';
import { useStock } from './useStock';
import { AddItemDrawer } from './components/AddItemDrawer';
import { MoveDrawer } from './components/MoveDrawer';
import { MovementHistory } from './components/MovementHistory';
import { ReconciliationDrawer } from './components/ReconciliationDrawer';
import { ReconciliationHistory } from './components/ReconciliationHistory';

export default function Inventory() {
  const { buildingId, building } = useBuilding();
  const { staff } = useAuth();
  const [tab, setTab] = useState<'items' | 'reconcile_history' | 'history'>('items');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [move, setMove] = useState<{ item?: StockRow; action: string } | null>(null);
  const [addItem, setAddItem] = useState(false);
  const [reconcile, setReconcile] = useState(false);
  const [hist, setHist] = useState<StockRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const st = useStock(buildingId);
  const rows = useMemo(() => st.data ?? [], [st.data]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
        const matchesCat = !cat || r.category === cat;
        if (!matchesSearch || !matchesCat) return false;

        if (!status) return true;
        if (status === 'low_stock') return stockStatus(r) === 'low_stock';
        if (status === 'out_of_stock') return stockStatus(r) === 'out_of_stock';
        if (status === 'in_stock') return stockStatus(r) === 'in_stock';
        if (status === 'discrepancy') return reconciliationStatus(r) === 'discrepancy';
        if (status === 'matched') return reconciliationStatus(r) === 'matched';
        if (status === 'awaiting_verification') return reconciliationStatus(r) === 'awaiting_verification';
        return true;
      }),
    [rows, search, cat, status],
  );

  // Total stock value (Expected stock * Last purchase unit cost)
  const value = rows.reduce(
    (s, r) => s + Math.max(0, Number(r.expected_qty ?? 0)) * Number(r.last_unit_cost ?? 0),
    0,
  );

  const lowStockCount = rows.filter((r) => stockStatus(r) === 'low_stock').length;
  const discrepancyCount = rows.filter((r) => reconciliationStatus(r) === 'discrepancy').length;

  const exportCsv = () =>
    downloadCsv(
      `inventory-${building?.name ?? 'building'}.csv`,
      rows.map((r) => {
        const exp = Number(r.expected_qty ?? 0);
        const act = r.last_actual_qty != null ? Number(r.last_actual_qty) : '';
        const diff = r.last_actual_qty != null ? Number(r.last_actual_qty) - exp : '';
        return {
          item: r.name,
          category: r.category,
          unit: r.base_unit,
          expected_stock: exp,
          last_actual_stock: act,
          discrepancy: diff,
          last_verified: r.last_verified_at ? fmtDate(r.last_verified_at) : 'Never',
          reorder_level: r.reorder_level,
          status: stockStatus(r),
          last_unit_cost: r.last_unit_cost ?? '',
        };
      }),
    );

  return (
    <>
      <SectionPromoBanner
        fromTop
        eyebrow="STOCK INTELLIGENCE"
        title="Accurate Inventory, Zero Waste Kitchens."
        subtitle={
          building
            ? `${building.name} · Track purchases, chef consumption, expected vs. actual stock, and audits.`
            : 'Track purchases, chef daily consumption, expected vs. actual stock, and physical audit logs.'
        }
        imageSrc="/owner-assets/inventory-hero.jpg"
        controls={<BuildingPicker />}
        statsBadge={`${rows.length} Items Monitored`}
        primaryAction={{
          label: 'Record Purchase',
          onClick: () => setMove({ action: 'purchase' }),
          icon: ShoppingCart,
        }}
        secondaryAction={{
          label: 'Reconcile Stock',
          onClick: () => setReconcile(true),
          icon: ClipboardCheck,
        }}
        extraActions={
          <button
            onClick={() => setAddItem(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-[#FFFEFC] hover:bg-[#ECE5DA] text-[#30271F] text-xs sm:text-[13.5px] font-semibold border border-[#DED6CB] transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            <Plus className="size-4 text-[#343B2B]" />
            <span>Add Item</span>
          </button>
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Package className="size-5" />} label="Items tracked" value={rows.length} />
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          tone="warn"
          label="Low stock alerts"
          value={lowStockCount}
          onClick={() => {
            setTab('items');
            setStatus('low_stock');
          }}
        />
        <StatCard
          icon={<AlertCircle className="size-5" />}
          tone={discrepancyCount > 0 ? 'bad' : undefined}
          label="Stock discrepancies"
          value={discrepancyCount}
          onClick={() => {
            setTab('items');
            setStatus('discrepancy');
          }}
        />
        <StatCard
          icon={<IndianRupee className="size-5" />}
          tone="ok"
          label="Total stock valuation"
          value={inr(value)}
        />
      </div>

      {/* Navigation Tabs */}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'items', label: 'Current Stock (Actual vs Expected)' },
          { id: 'reconcile_history', label: 'Verification Logs' },
          { id: 'history', label: 'Permanent Movement History' },
        ]}
      />

      {/* TAB 1: CURRENT STOCK TABLE */}
      {tab === 'items' && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <label className="relative">
              <span className="sr-only">Search items</span>
              <Search className="size-4 text-muted absolute left-3 top-3" aria-hidden />
              <Input
                placeholder="Search item…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-56"
              />
            </label>
            <Select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="w-48"
              aria-label="Category"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-48"
              aria-label="Filter status"
            >
              <option value="">All statuses</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock (below threshold)</option>
              <option value="out_of_stock">Out of stock</option>
              <option value="discrepancy">Discrepancy found</option>
              <option value="matched">Count matched</option>
              <option value="awaiting_verification">Awaiting verification</option>
            </Select>
            <div className="flex-1" />
            <Button variant="secondary" disabled={!rows.length} onClick={exportCsv}>
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>

          <Async state={st}>
            {() =>
              filtered.length === 0 ? (
                <Empty
                  title="No items found"
                  action={<Button onClick={() => setAddItem(true)}>Add item</Button>}
                />
              ) : (
                <Table
                  head={[
                    'Ingredient',
                    'Category',
                    'Expected Stock',
                    'Last Verified Actual',
                    'Verification Status',
                    'Reorder At',
                    'Unit Cost',
                    'Status',
                    '',
                  ]}
                >
                  {filtered.map((r) => {
                    const expected = Number(r.expected_qty ?? 0);
                    const hasActual = r.last_actual_qty != null;
                    const actual = hasActual ? Number(r.last_actual_qty) : null;
                    const diff = actual !== null ? actual - expected : null;
                    const recSt = reconciliationStatus(r);
                    const stStatus = stockStatus(r);

                    return (
                      <tr key={r.item_id} className="hover:bg-subtle/60">
                        <Td className="font-semibold text-ink">{r.name}</Td>
                        <Td className="text-xs text-muted">{r.category}</Td>

                        {/* Expected Stock */}
                        <Td className="tabular font-bold text-ink">
                          {num(expected, 3)} {r.base_unit}
                        </Td>

                        {/* Last Verified Actual */}
                        <Td className="tabular text-xs">
                          {hasActual ? (
                            <div>
                              <span className="font-semibold text-ink">
                                {num(actual, 3)} {r.base_unit}
                              </span>
                              {r.last_verified_at && (
                                <span className="block text-muted text-[11px]">
                                  {fmtDate(r.last_verified_at)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted italic">Not counted</span>
                          )}
                        </Td>

                        {/* Verification Status / Difference */}
                        <Td>
                          {recSt === 'matched' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok bg-ok-bg px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="size-3" />
                              Matched
                            </span>
                          ) : recSt === 'discrepancy' && diff !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                diff < 0 ? 'text-bad bg-bad-bg' : 'text-warn bg-warn-bg'
                              }`}
                            >
                              <AlertCircle className="size-3" />
                              {diff > 0 ? `+${num(diff, 3)}` : num(diff, 3)} {r.base_unit}
                            </span>
                          ) : (
                            <span className="text-muted text-xs">Awaiting check</span>
                          )}
                        </Td>

                        {/* Reorder Level */}
                        <Td className="tabular text-xs">
                          {num(r.reorder_level, 3)} {r.base_unit}
                        </Td>

                        {/* Last Unit Cost */}
                        <Td className="tabular text-xs">
                          {r.last_unit_cost ? inr(r.last_unit_cost, true) : '—'}
                        </Td>

                        {/* Overall Stock Status */}
                        <Td>
                          <Badge status={stStatus} />
                        </Td>

                        {/* Row Actions */}
                        <Td>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMove({ item: r, action: 'purchase' })}
                              title="Record purchase for this item"
                            >
                              Buy
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setHist(r)}
                              aria-label={`History for ${r.name}`}
                              title="View permanent purchase & usage history"
                            >
                              <History className="size-4" />
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </Table>
              )
            }
          </Async>
        </Card>
      )}

      {/* TAB 2: VERIFICATION & RECONCILIATION LOGS */}
      {tab === 'reconcile_history' && <ReconciliationHistory buildingId={buildingId} />}

      {/* TAB 3: FULL PERMANENT MOVEMENT HISTORY */}
      {tab === 'history' && <MovementHistory buildingId={buildingId} />}

      {/* Physical Stock Verification Drawer */}
      {reconcile && buildingId && (
        <ReconciliationDrawer
          items={rows}
          buildingId={buildingId}
          buildingName={building?.name}
          onClose={() => setReconcile(false)}
          onSaved={(m) => {
            setToast(m);
            st.reload();
          }}
        />
      )}

      {/* Record Purchase or Adjustment Drawer */}
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

      {/* Add New Item to Tenant Catalogue Drawer */}
      <AddItemDrawer
        open={addItem}
        onClose={() => setAddItem(false)}
        onDone={() => {
          setAddItem(false);
          setToast('Item added to catalogue');
          st.reload();
        }}
      />

      {/* Single Item History Drawer */}
      {hist && (
        <Drawer open onClose={() => setHist(null)} title={`Stock History — ${hist.name}`} wide>
          <MovementHistory buildingId={buildingId} itemId={hist.item_id} itemName={hist.name} />
        </Drawer>
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
