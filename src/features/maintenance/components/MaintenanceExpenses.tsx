/** "Maintenance expenses" tab: the maintenance slice of the shared expense ledger. */
import { Plus } from 'lucide-react';
import type { AsyncState } from '../../../lib/hooks';
import { fmtDate, inr } from '../../../lib/format';
import { Async, Badge, Button, Card, Empty, Table, Td } from '../../../components/ui';
import { payStatus } from '../../expenses/payStatus';
import type { ExpenseRow } from '../../expenses/types';

export function MaintenanceExpenses({ state, rows, onAdd, onView }: {
  /** Load state of the full expense list (drives loading/error). */
  state: AsyncState<ExpenseRow[]>;
  /** Already filtered to maintenance expenses. */
  rows: ExpenseRow[];
  onAdd: () => void;
  onView: (expenseId: string) => void;
}) {
  const addButton = (
    <Button size="sm" onClick={onAdd}>
      <Plus className="size-4" />
      Add expense
    </Button>
  );
  return (
    <Card title="Maintenance expenses" action={addButton}>
      <p className="text-[13px] text-muted -mt-2 mb-4">These are the same records as in Expenses — nothing is duplicated.</p>
      <Async state={state}>
        {() =>
          rows.length === 0 ? (
            <Empty title="No maintenance expenses" />
          ) : (
            <Table head={['Date', 'Expense', 'Category', 'Vendor', 'Total', 'Paid', 'Outstanding', 'Status', '']}>
              {rows.map((e) => (
                <tr key={e.id}>
                  <Td>{fmtDate(e.expense_date)}</Td>
                  <Td className="font-medium">{e.title}</Td>
                  <Td>{e.expense_categories.name}</Td>
                  <Td>{e.vendors?.name ?? '—'}</Td>
                  <Td className="tabular">{inr(e.total_amount)}</Td>
                  <Td className="tabular">{inr(e.paid_amount)}</Td>
                  <Td className="tabular">{inr(e.outstanding_amount)}</Td>
                  <Td><Badge status={payStatus(e)} /></Td>
                  <Td><Button variant="ghost" size="sm" onClick={() => onView(e.id)}>View</Button></Td>
                </tr>
              ))}
            </Table>
          )
        }
      </Async>
    </Card>
  );
}
