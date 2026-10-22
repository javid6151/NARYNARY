import { Bell } from 'lucide-react';
import { fmtDate, inr } from '../../../lib/format';
import { Badge, Button, Table, Td } from '../../../components/ui';
import type { ResidentDues } from '../dues';

export function DuesTable({
  rows,
  onCollect,
  onRemind,
}: {
  rows: ResidentDues[];
  onCollect: (r: ResidentDues) => void;
  onRemind?: (r: ResidentDues) => void;
}) {
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
            {r.overdue > 0 ? (
              onRemind ? (
                <button
                  type="button"
                  onClick={() => onRemind(r)}
                  title="Click to remind overdue resident"
                  className="cursor-pointer hover:opacity-85 transition-opacity inline-flex"
                >
                  <Badge status="overdue">{inr(r.overdue)}</Badge>
                </button>
              ) : (
                <Badge status="overdue">{inr(r.overdue)}</Badge>
              )
            ) : (
              <span className="text-muted">—</span>
            )}
          </Td>
          <Td className="tabular font-semibold">{inr(r.total)}</Td>
          <Td>
            <div className="flex items-center gap-2 justify-end">
              {onRemind && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onRemind(r)}
                  className={
                    r.overdue > 0
                      ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200 font-medium'
                      : 'text-muted hover:text-ink font-medium'
                  }
                  title={
                    r.overdue > 0
                      ? 'Send overdue payment reminder via WhatsApp'
                      : 'Send payment reminder via WhatsApp'
                  }
                >
                  <Bell className={`size-3.5 ${r.overdue > 0 ? 'text-amber-600' : 'text-muted'}`} />
                  Remind
                </Button>
              )}
              <Button size="sm" onClick={() => onCollect(r)}>
                Collect
              </Button>
            </div>
          </Td>
        </tr>
      ))}
    </Table>
  );
}
