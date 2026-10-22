/**
 * Permanent Purchase and Usage History for a building (or specific item).
 * Enables Owners and Managers to cross-verify purchases against Chef reported usage,
 * filter by type, item, and date ranges (e.g. 10-day cycle).
 */
import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { fmtDateTime, inr, label, num } from '../../../lib/format';
import { Async, Card, Empty, Input, Select, Table, Td } from '../../../components/ui';
import { listStockMovements } from '../api';
import { INBOUND_TYPES, TX_LABEL } from '../stock';
import type { StockMovement } from '../types';

export function MovementHistory({
  buildingId,
  itemId,
  itemName,
}: {
  buildingId: string | null;
  itemId?: string;
  itemName?: string;
}) {
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const st = useAsync(
    () =>
      !buildingId
        ? Promise.resolve([] as StockMovement[])
        : listStockMovements({
            buildingId,
            itemId,
            type: typeFilter || undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
          }),
    [buildingId, itemId, typeFilter, fromDate, toDate],
  );

  const rawRows = st.data ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return rawRows;
    const q = search.trim().toLowerCase();
    return rawRows.filter(
      (r) =>
        r.inventory_items?.name?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        r.vendors?.name?.toLowerCase().includes(q),
    );
  }, [rawRows, search]);

  // Calculate period summary
  const summary = useMemo(() => {
    let purchased = 0;
    let used = 0;
    let adjustments = 0;

    for (const r of filtered) {
      const q = Number(r.quantity);
      if (r.transaction_type === 'purchase') {
        purchased += q;
      } else if (r.transaction_type === 'consumption' || r.transaction_type === 'usage') {
        used += q;
      } else if (r.transaction_type === 'adjustment_in' || r.transaction_type === 'correction_in') {
        adjustments += q;
      } else if (r.transaction_type === 'adjustment_out' || r.transaction_type === 'correction_out') {
        adjustments -= q;
      }
    }
    return { purchased, used, adjustments, net: purchased - used + adjustments };
  }, [filtered]);

  return (
    <Card
      title={itemName ? `Transaction History — ${itemName}` : 'Permanent Purchase & Usage History'}
      action={
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{filtered.length} transactions recorded</span>
        </div>
      }
    >
      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-2.5 bg-subtle/50 rounded-xl border border-line">
        {!itemId && (
          <label className="relative">
            <span className="sr-only">Search item</span>
            <Search className="size-3.5 text-muted absolute left-2.5 top-2.5" />
            <Input
              placeholder="Search ingredient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-44"
            />
          </label>
        )}

        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 text-xs w-44"
          aria-label="Filter movement type"
        >
          <option value="">All Movement Types</option>
          <option value="purchase">Purchases only</option>
          <option value="consumption">Chef usage only</option>
          <option value="adjustment_in">Corrections (+) only</option>
          <option value="adjustment_out">Corrections (−) only</option>
        </Select>

        <div className="flex items-center gap-1 text-xs text-muted">
          <span>From:</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 text-xs w-32"
          />
          <span>To:</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 text-xs w-32"
          />
        </div>

        {(typeFilter || fromDate || toDate || search) && (
          <button
            onClick={() => {
              setTypeFilter('');
              setSearch('');
              setFromDate('');
              setToDate('');
            }}
            className="text-xs text-brand-600 hover:underline font-medium ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Period Audit Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 p-3 bg-subtle/70 rounded-xl border border-line text-xs">
        <div>
          <span className="text-muted block text-[11px]">Period Purchases</span>
          <span className="font-bold text-ok text-[14px]">+{num(summary.purchased, 3)}</span>
        </div>
        <div>
          <span className="text-muted block text-[11px]">Chef Reported Usage</span>
          <span className="font-bold text-bad text-[14px]">−{num(summary.used, 3)}</span>
        </div>
        <div>
          <span className="text-muted block text-[11px]">Audit Corrections</span>
          <span className="font-bold text-ink text-[14px]">
            {summary.adjustments >= 0 ? `+${num(summary.adjustments, 3)}` : num(summary.adjustments, 3)}
          </span>
        </div>
        <div>
          <span className="text-muted block text-[11px]">Period Net Flow</span>
          <span
            className={`font-bold text-[14px] ${
              summary.net >= 0 ? 'text-ok' : 'text-bad'
            }`}
          >
            {summary.net >= 0 ? `+${num(summary.net, 3)}` : num(summary.net, 3)}
          </span>
        </div>
      </div>

      <Async state={st}>
        {() =>
          filtered.length === 0 ? (
            <Empty title="No stock movements match the criteria" />
          ) : (
            <Table head={['Date / Time', 'Ingredient', 'Movement Type', 'Quantity', 'Cost / Supplier', 'Notes / Ref']}>
              {filtered.map((t) => {
                const inbound = INBOUND_TYPES.includes(t.transaction_type);
                return (
                  <tr key={t.id} className="hover:bg-subtle/50">
                    <Td className="text-muted whitespace-nowrap text-xs">{fmtDateTime(t.occurred_at)}</Td>
                    <Td className="font-semibold text-ink">{t.inventory_items?.name ?? '—'}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1 text-xs">
                        {inbound ? (
                          <ArrowUpRight className="size-3.5 text-ok shrink-0" />
                        ) : (
                          <ArrowDownRight className="size-3.5 text-bad shrink-0" />
                        )}
                        {TX_LABEL[t.transaction_type] ?? label(t.transaction_type)}
                      </span>
                    </Td>
                    <Td className={`tabular font-bold ${inbound ? 'text-ok' : 'text-bad'}`}>
                      {inbound ? '+' : '−'}
                      {num(t.quantity, 3)} {t.inventory_items?.base_unit ?? ''}
                    </Td>
                    <Td className="tabular text-xs">
                      {t.unit_cost ? (
                        <span>
                          {inr(Number(t.unit_cost) * Number(t.quantity))}
                          {t.vendors ? ` · ${t.vendors.name}` : ''}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-muted text-xs max-w-48 truncate">{t.notes || '—'}</Td>
                  </tr>
                );
              })}
            </Table>
          )
        }
      </Async>
    </Card>
  );
}
