/**
 * Verification & Reconciliation History: lists historical physical stock audit sessions.
 */
import { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { fmtDate, fmtDateTime, num } from '../../../lib/format';
import { Async, Button, Card, Empty, Table, Td } from '../../../components/ui';
import { listReconciliations } from '../api';
import type { ReconciliationRecord } from '../types';

export function ReconciliationHistory({ buildingId }: { buildingId: string | null }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const recs = useAsync(
    () => (!buildingId ? Promise.resolve([] as ReconciliationRecord[]) : listReconciliations(buildingId)),
    [buildingId],
  );

  return (
    <Card title="Physical Stock Verification Log">
      <Async state={recs}>
        {(list) =>
          list.length === 0 ? (
            <Empty title="No physical stock audits recorded yet">
              Click "Reconcile Stock" to record your first physical count verification.
            </Empty>
          ) : (
            <div className="space-y-3">
              {list.map((r: ReconciliationRecord) => {
                const isExpanded = expandedId === r.id;
                const lines = r.lines ?? [];
                const matched = lines.filter((l) => Math.abs(l.discrepancy) < 0.001).length;
                const discrepancies = lines.filter((l) => Math.abs(l.discrepancy) >= 0.001);

                return (
                  <div key={r.id} className="border border-line rounded-xl overflow-hidden bg-white">
                    <div
                      className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-subtle/50 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-brand-50 rounded-lg text-brand-700">
                          <ClipboardCheck className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-sm text-ink">
                            Verified on {fmtDateTime(r.verified_at)}
                          </p>
                          <p className="text-xs text-muted">
                            Verified by <span className="font-medium text-ink">{r.verifier_name}</span>
                            {r.period_start && r.period_end ? (
                              <span> · Period: {fmtDate(r.period_start)} – {fmtDate(r.period_end)}</span>
                            ) : null}
                            {r.notes ? ` · Note: "${r.notes}"` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs">
                          <span className="text-ok font-semibold inline-flex items-center gap-1 mr-2">
                            <CheckCircle2 className="size-3.5" />
                            {matched} matched
                          </span>
                          {discrepancies.length > 0 ? (
                            <span className="text-bad font-semibold inline-flex items-center gap-1">
                              <AlertCircle className="size-3.5" />
                              {discrepancies.length} discrepancies
                            </span>
                          ) : (
                            <span className="text-muted">No discrepancies</span>
                          )}
                        </div>
                        <Button variant="ghost" size="sm">
                          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && lines.length > 0 && (
                      <div className="border-t border-line bg-subtle/30 p-3">
                        <Table head={['Ingredient', 'Expected Stock', 'Actual Counted', 'Difference', 'Notes']}>
                          {lines.map((l, idx) => {
                            const isMatch = Math.abs(l.discrepancy) < 0.001;
                            return (
                              <tr key={l.id ?? idx}>
                                <Td className="font-medium text-ink">{l.item_name ?? 'Item'}</Td>
                                <Td className="tabular">
                                  {num(l.expected_qty, 3)} {l.base_unit ?? ''}
                                </Td>
                                <Td className="tabular font-medium">
                                  {num(l.actual_qty, 3)} {l.base_unit ?? ''}
                                </Td>
                                <Td>
                                  {isMatch ? (
                                    <span className="text-ok text-xs font-semibold">Matched (0)</span>
                                  ) : (
                                    <span
                                      className={`text-xs font-semibold ${
                                        l.discrepancy < 0 ? 'text-bad' : 'text-warn'
                                      }`}
                                    >
                                      {l.discrepancy > 0 ? `+${num(l.discrepancy, 3)}` : num(l.discrepancy, 3)}{' '}
                                      {l.base_unit ?? ''}
                                    </span>
                                  )}
                                </Td>
                                <Td className="text-xs text-muted">{l.notes || '—'}</Td>
                              </tr>
                            );
                          })}
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </Async>
    </Card>
  );
}
