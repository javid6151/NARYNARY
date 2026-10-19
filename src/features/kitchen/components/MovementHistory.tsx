/** Stock ledger table for a building (optionally one item). Green = into a location, red = out of it. */
import { useAsync } from '../../../lib/hooks';
import { fmtDateTime, inr, label, num } from '../../../lib/format';
import { Async, Card, Empty, Table, Td } from '../../../components/ui';
import { listStockMovements } from '../api';
import { INBOUND_TYPES, TX_LABEL } from '../stock';
import type { StockMovement } from '../types';

export function MovementHistory({ buildingId, itemId }: { buildingId: string | null; itemId?: string }) {
  const st = useAsync(
    () => (!buildingId ? Promise.resolve([] as StockMovement[]) : listStockMovements(buildingId, itemId)),
    [buildingId, itemId],
  );
  return (
    <Card>
      <Async state={st}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No stock movements yet" />
          ) : (
            <Table head={['When', 'Item', 'Movement', 'Location', 'Quantity', 'Cost', 'Notes']}>
              {rows.map((t) => {
                const inbound = INBOUND_TYPES.includes(t.transaction_type);
                return (
                  <tr key={t.id}>
                    <Td className="text-muted whitespace-nowrap">{fmtDateTime(t.occurred_at)}</Td>
                    <Td className="font-medium">{t.inventory_items.name}</Td>
                    <Td>{TX_LABEL[t.transaction_type] ?? label(t.transaction_type)}</Td>
                    <Td>{label(t.inventory_locations.kind)}</Td>
                    <Td className={`tabular ${inbound ? 'text-ok' : 'text-bad'}`}>
                      {inbound ? '+' : '−'}
                      {num(t.quantity, 3)} {t.inventory_items.base_unit}
                    </Td>
                    <Td className="tabular">
                      {t.unit_cost ? `${inr(Number(t.unit_cost) * Number(t.quantity))}${t.vendors ? ` · ${t.vendors.name}` : ''}` : '—'}
                    </Td>
                    <Td className="text-muted max-w-48 truncate">{t.notes ?? ''}</Td>
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
