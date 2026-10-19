/** Pending dues per resident with a Collect action. */
import { fmtDate, inr } from '../../../lib/format';
import { Badge, Button, Table, Td } from '../../../components/ui';
import type { ResidentDues } from '../dues';

export function DuesTable({ rows, onCollect }: { rows: ResidentDues[]; onCollect: (r: ResidentDues) => void }) {
  return (
    <Table head={['Resident', 'Charges', 'Oldest due', 'Overdue', 'Total due', '']}>
      {rows.map((r) => (
        <tr key={r.id} className="hover:bg-subtle/60">
          <Td>
            <p className="font-medium">{r.name}</p>
            <p className="text-[12px] text-muted">{r.phone}</p>
          </Td>
          <Td>{r.count}</Td>
          <Td>{fmtDate(r.oldest)}</Td>
          <Td className="tabular">
            {r.overdue > 0 ? <Badge status="overdue">{inr(r.overdue)}</Badge> : <span className="text-muted">—</span>}
          </Td>
          <Td className="tabular font-semibold">{inr(r.total)}</Td>
          <Td><Button size="sm" onClick={() => onCollect(r)}>Collect</Button></Td>
        </tr>
      ))}
    </Table>
  );
}
