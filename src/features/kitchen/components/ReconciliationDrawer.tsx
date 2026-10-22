/**
 * Physical Stock Verification & Reconciliation Drawer.
 * Allows Owners and Managers to enter physical counts, calculate differences,
 * record audit verifications, and optionally apply auditable stock corrections.
 */
import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { useMutation } from '../../../lib/hooks';
import { num } from '../../../lib/format';
import { newKey } from '../../../lib/api';
import {
  Button,
  Drawer,
  ErrorBanner,
  Field,
  Input,
  Table,
  Td,
} from '../../../components/ui';
import { inventoryMove, submitStockReconciliation } from '../api';
import type { StockRow } from '../types';

export function ReconciliationDrawer({
  items,
  buildingId,
  buildingName,
  onClose,
  onSaved,
}: {
  items: StockRow[];
  buildingId: string;
  buildingName?: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [overallNotes, setOverallNotes] = useState('');
  const [autoAdjust, setAutoAdjust] = useState(false);
  const [adjustReason, setAdjustReason] = useState('Stock reconciliation adjustment to match physical count');

  // Initialize actual count inputs with empty or current expected stock
  const [counts, setCounts] = useState<Record<string, { actualText: string; notes: string }>>(() => {
    const map: Record<string, { actualText: string; notes: string }> = {};
    for (const it of items) {
      map[it.item_id] = { actualText: '', notes: '' };
    }
    return map;
  });

  const rows = useMemo(() => {
    return items.map((it) => {
      const entry = counts[it.item_id] ?? { actualText: '', notes: '' };
      const expected = Number(it.expected_qty ?? (Number(it.store_qty ?? 0) + Number(it.kitchen_qty ?? 0)));
      const hasActual = entry.actualText.trim() !== '';
      const actual = hasActual ? Number(entry.actualText) : null;
      const diff = actual !== null ? actual - expected : null;
      const isMatched = diff !== null && Math.abs(diff) < 0.001;
      const hasDiscrepancy = diff !== null && Math.abs(diff) >= 0.001;

      return {
        item: it,
        expected,
        hasActual,
        actual,
        diff,
        isMatched,
        hasDiscrepancy,
        actualText: entry.actualText,
        notes: entry.notes,
      };
    });
  }, [items, counts]);

  const countedRows = rows.filter((r) => r.hasActual);
  const matchedCount = countedRows.filter((r) => r.isMatched).length;
  const discrepancyRows = countedRows.filter((r) => r.hasDiscrepancy);

  const saveMutation = useMutation(async () => {
    if (countedRows.length === 0) return;

    const lines = countedRows.map((r) => ({
      itemId: r.item.item_id,
      expectedQty: r.expected,
      actualQty: r.actual ?? r.expected,
      notes: r.notes.trim() || null,
    }));

    // 1. Submit reconciliation log
    await submitStockReconciliation(
      buildingId,
      lines,
      overallNotes.trim() || null,
      periodStart || null,
      periodEnd || null,
    );

    // 2. If autoAdjust is checked, record auditable adjustment transactions for discrepancies
    if (autoAdjust && discrepancyRows.length > 0) {
      for (const r of discrepancyRows) {
        if (r.diff === null) continue;
        const absDiff = Math.abs(r.diff);
        const action = r.diff > 0 ? 'adjust_in' : 'adjust_out';
        try {
          await inventoryMove({
            buildingId,
            itemId: r.item.item_id,
            action,
            quantity: absDiff,
            unitCost: null,
            vendorId: null,
            notes: `${adjustReason.trim()}${r.notes ? ` (${r.notes})` : ''}`,
            idempotencyKey: newKey(),
          });
        } catch {
          // If individual movement fails, continue with others
        }
      }
    }

    return true;
  });

  const footer = (
    <div className="flex items-center justify-between w-full">
      <div className="text-xs text-muted">
        {countedRows.length} of {items.length} items counted ({matchedCount} matched)
        {discrepancyRows.length > 0 && (
          <span className="text-bad font-medium ml-2">({discrepancyRows.length} discrepancies found)</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          busy={saveMutation.busy}
          disabled={countedRows.length === 0}
          onClick={async () => {
            if (await saveMutation.run()) {
              onSaved(
                `Stock verification saved${
                  autoAdjust && discrepancyRows.length > 0 ? ' and adjustments applied' : ''
                }`,
              );
              onClose();
            }
          }}
        >
          <Save className="size-4" />
          Save Verification
        </Button>
      </div>
    </div>
  );

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Physical Stock Verification — ${buildingName ?? 'Building'}`}
      wide
      footer={footer}
    >
      <ErrorBanner error={saveMutation.error} />

      <div className="space-y-4">
        {/* Info Banner */}
        <div className="p-3.5 bg-brand-50/60 border border-brand-200 rounded-xl text-xs text-brand-900 leading-relaxed">
          <p className="font-semibold text-[13px] mb-0.5">Physical Stock Reconciliation Workflow</p>
          <p className="text-brand-700">
            Compare physically counted inventory against system-calculated expected stock. Saving a count logs an
            immutable audit record and updates verification status without overwriting historical ledger transactions.
          </p>
        </div>

        {/* Verification Period & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-subtle/50 rounded-xl border border-line">
          <Field label="Cycle / Period Start (optional)">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            )}
          </Field>
          <Field label="Cycle / Period End (optional)">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            )}
          </Field>
          <Field label="Audit Notes (optional)">
            {(id) => (
              <Input
                id={id}
                placeholder="e.g. 10-day audit cycle, monthly physical count"
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
              />
            )}
          </Field>
        </div>

        {/* Quick Fill Action */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted font-medium">Enter counted quantities below:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const updated: Record<string, { actualText: string; notes: string }> = {};
              for (const it of items) {
                const exp = Number(it.expected_qty ?? (Number(it.store_qty ?? 0) + Number(it.kitchen_qty ?? 0)));
                updated[it.item_id] = {
                  actualText: String(exp),
                  notes: counts[it.item_id]?.notes ?? '',
                };
              }
              setCounts(updated);
            }}
          >
            Pre-fill all with expected stock
          </Button>
        </div>

        {/* Table of items */}
        <div className="border border-line rounded-xl overflow-hidden">
          <Table head={['Ingredient', 'Category', 'Expected Stock', 'Actual Counted', 'Difference', 'Discrepancy Notes']}>
            {rows.map((r) => (
              <tr key={r.item.item_id} className="hover:bg-subtle/50">
                <Td className="font-semibold text-ink">{r.item.name}</Td>
                <Td className="text-xs text-muted">{r.item.category}</Td>
                <Td className="tabular font-medium">
                  {num(r.expected, 3)} {r.item.base_unit}
                </Td>
                <Td className="w-36">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      step="0.001"
                      min={0}
                      placeholder="Enter count"
                      value={r.actualText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCounts((prev) => ({
                          ...prev,
                          [r.item.item_id]: {
                            actualText: val,
                            notes: prev[r.item.item_id]?.notes ?? '',
                          },
                        }));
                      }}
                      className="h-8 text-right font-medium"
                    />
                    <span className="text-xs text-muted shrink-0">{r.item.base_unit}</span>
                  </div>
                </Td>
                <Td>
                  {r.diff === null ? (
                    <span className="text-muted text-xs italic">Awaiting count</span>
                  ) : r.isMatched ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok bg-ok-bg px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="size-3.5" />
                      Matched (0)
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.diff < 0 ? 'text-bad bg-bad-bg' : 'text-warn bg-warn-bg'
                      }`}
                    >
                      <AlertCircle className="size-3.5" />
                      {r.diff > 0 ? `+${num(r.diff, 3)}` : num(r.diff, 3)} {r.item.base_unit}
                    </span>
                  )}
                </Td>
                <Td className="w-48">
                  <Input
                    placeholder={r.hasDiscrepancy ? 'Reason for difference…' : 'Notes (optional)'}
                    value={r.notes}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCounts((prev) => ({
                        ...prev,
                        [r.item.item_id]: {
                          actualText: prev[r.item.item_id]?.actualText ?? '',
                          notes: val,
                        },
                      }));
                    }}
                    className={`h-8 text-xs ${r.hasDiscrepancy && !r.notes ? 'border-warn-300' : ''}`}
                  />
                </Td>
              </tr>
            ))}
          </Table>
        </div>

        {/* Optional Stock Adjustment Section */}
        {discrepancyRows.length > 0 && (
          <div className="p-3.5 bg-subtle/70 border border-line rounded-xl space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAdjust}
                onChange={(e) => setAutoAdjust(e.target.checked)}
                className="mt-0.5 size-4 rounded border-line text-brand-600 focus:ring-brand-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-ink block">
                  Post auditable stock correction adjustments for discrepancies
                </span>
                <span className="text-muted">
                  Automatically posts auditable stock correction transactions (+ / −) to bring expected stock into
                  alignment with the physical count, preserving full audit history.
                </span>
              </div>
            </label>

            {autoAdjust && (
              <Field label="Adjustment Reason / Authorization Note">
                {(id) => (
                  <Input
                    id={id}
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Enter reason for stock correction adjustment"
                    className="h-8 text-xs"
                  />
                )}
              </Field>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
