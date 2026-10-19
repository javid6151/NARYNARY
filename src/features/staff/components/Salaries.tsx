/**
 * Owner-only salary sheet for a month. A staff member counts as paid when a salary expense
 * for them with description "Salary month YYYY-MM" exists in the expense ledger.
 */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { fmtDate, inr, isoDate, label } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Button, Card, Confirm, ErrorBanner, Field, Input, Select, Table, Td } from '../../../components/ui';
import { useExpenses } from '../../expenses/useExpenses';
import { payStaffSalary } from '../api';
import type { StaffMember } from '../types';

export function Salaries({ staff, onPaid }: { staff: StaffMember[]; onPaid: (m: string) => void }) {
  const { buildingId } = useBuilding();
  const exp = useExpenses(buildingId, { source: 'salary' });
  const [month, setMonth] = useState(isoDate().slice(0, 7));
  const [pay, setPay] = useState<StaffMember | null>(null);
  const [method, setMethod] = useState('bank_transfer');
  const [ref, setRef] = useState('');
  const m = useMutation(() =>
    payStaffSalary({
      staffId: pay!.id,
      monthFirstDay: month + '-01',
      amount: Number(pay!.monthly_salary),
      method,
      reference: ref || null,
    }),
  );
  const monthName = new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const paidFor = (s: StaffMember) => (exp.data ?? []).find((e) => e.source_id === s.id && e.description === `Salary month ${month}`);

  return (
    <Card
      title="Salary payments"
      action={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40 h-8" aria-label="Salary month" />}
    >
      <Async state={exp}>
        {() => (
          <Table head={['Staff', 'Role', 'Monthly salary', `Status — ${monthName}`, '']}>
            {staff.map((s) => {
              const p = paidFor(s);
              return (
                <tr key={s.id}>
                  <Td className="font-medium">{s.full_name}</Td>
                  <Td>{label(s.role)}</Td>
                  <Td className="tabular">{inr(s.monthly_salary)}</Td>
                  <Td>{p ? <Badge status="paid">Paid {fmtDate(p.expense_date)}</Badge> : <Badge status="unpaid" />}</Td>
                  <Td>{!p && Number(s.monthly_salary) > 0 && <Button size="sm" onClick={() => setPay(s)}>Pay salary</Button>}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Async>
      <p className="text-[12px] text-muted mt-3">
        Salary payments are recorded in the expense ledger (category “Staff Salary”) and can be paid once per staff per month.
      </p>
      <Confirm
        open={!!pay}
        title={`Pay ${pay?.full_name}`}
        confirmLabel={`Pay ${inr(pay?.monthly_salary)}`}
        busy={m.busy}
        onClose={() => setPay(null)}
        body={`Salary for ${monthName}.`}
        onConfirm={async () => {
          if (await m.run()) {
            setPay(null);
            setRef('');
            exp.reload();
            onPaid('Salary recorded');
          }
        }}
      >
        <ErrorBanner error={m.error} />
        <Field label="Method">
          {(id) => (
            <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </Select>
          )}
        </Field>
        <Field label="Reference">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
      </Confirm>
    </Card>
  );
}
