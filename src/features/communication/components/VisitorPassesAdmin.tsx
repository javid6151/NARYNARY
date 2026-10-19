/**
 * Staff visitor passes for the selected building: approve (issues a gate code) or reject requests,
 * and record check-in / check-out at the gate. Every change is audited and the resident is notified.
 */
import { useState } from 'react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate, fmtDateTime, label } from '../../../lib/format';
import { useBuilding } from '../../access/useBuilding';
import { Async, Badge, Button, Card, Empty, ErrorBanner, Select, Table, Td } from '../../../components/ui';
import { listVisitorPasses, updateVisitorPass } from '../../community/api';

export function VisitorPassesAdmin({ onToast }: { onToast: (m: string) => void }) {
  const { buildingId } = useBuilding();
  const [status, setStatus] = useState('');
  const st = useAsync(() => listVisitorPasses(buildingId), [buildingId]);
  const m = useMutation((id: string, action: 'approve' | 'reject' | 'check_in' | 'check_out') => updateVisitorPass(id, action, null));
  const rows = (st.data ?? []).filter((v) => !status || v.status === status);
  const act = async (id: string, action: 'approve' | 'reject' | 'check_in' | 'check_out') => {
    const r = await m.run(id, action);
    if (r) {
      onToast(r.pass_code ? `Approved · pass code ${r.pass_code}` : `Pass ${label(r.status).toLowerCase()}`);
      st.reload();
    }
  };

  const filter = (
    <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40 h-9" aria-label="Status">
      <option value="">All statuses</option>
      {['pending', 'approved', 'checked_in', 'checked_out', 'rejected', 'cancelled'].map((s) => (
        <option key={s} value={s}>{label(s)}</option>
      ))}
    </Select>
  );

  return (
    <Card title="Visitor passes" action={filter}>
      <ErrorBanner error={m.error} />
      <Async state={st}>
        {() =>
          rows.length === 0 ? (
            <Empty title="No visitor passes" />
          ) : (
            <Table head={['Visit date', 'Visitor', 'Resident', 'Purpose', 'Status', 'Code', '']}>
              {rows.map((v) => (
                <tr key={v.id}>
                  <Td>{fmtDate(v.visit_date)}</Td>
                  <Td>
                    <p className="font-medium">{v.visitor_name}</p>
                    <p className="text-[12px] text-muted">{v.visitor_phone ?? '—'}</p>
                  </Td>
                  <Td>{v.residents?.full_name}</Td>
                  <Td className="text-muted max-w-48 truncate">{v.purpose ?? '—'}</Td>
                  <Td>
                    <Badge status={v.status} />
                    {v.checked_in_at && <p className="text-[11.5px] text-muted mt-0.5">In {fmtDateTime(v.checked_in_at)}</p>}
                  </Td>
                  <Td className="tabular tracking-wider">{v.pass_code ?? '—'}</Td>
                  <Td>
                    <div className="flex gap-1">
                      {v.status === 'pending' && (
                        <>
                          <Button size="sm" variant="success" busy={m.busy} onClick={() => act(v.id, 'approve')}>Approve</Button>
                          <Button size="sm" variant="danger" busy={m.busy} onClick={() => act(v.id, 'reject')}>Reject</Button>
                        </>
                      )}
                      {v.status === 'approved' && (
                        <Button size="sm" variant="secondary" busy={m.busy} onClick={() => act(v.id, 'check_in')}>Check in</Button>
                      )}
                      {v.status === 'checked_in' && (
                        <Button size="sm" variant="secondary" busy={m.busy} onClick={() => act(v.id, 'check_out')}>Check out</Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )
        }
      </Async>
    </Card>
  );
}
