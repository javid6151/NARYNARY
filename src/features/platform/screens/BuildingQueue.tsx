/** Additional buildings requested by existing tenants; approve or reject with optional notes. */
import { useState } from 'react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate } from '../../../lib/format';
import { Async, Badge, Button, Card, Empty, ErrorBanner, Input, PageHeader, Table, Td, Toast } from '../../../components/ui';
import { listBuildingRequests, reviewBuilding } from '../api';

export function BuildingQueue() {
  const st = useAsync(() => listBuildingRequests(), []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const m = useMutation((id: string, d: string) => reviewBuilding(id, d, notes[id] || null));
  const [toast, setToast] = useState<string | null>(null);
  const decide = async (id: string, d: string, msg: string) => {
    if ((await m.run(id, d)) !== undefined) {
      setToast(msg);
      st.reload();
    }
  };
  return (
    <>
      <PageHeader title="Additional building requests" subtitle="Existing tenants requesting more buildings." />
      <Card>
        <ErrorBanner error={m.error} />
        <Async state={st}>
          {(rows) =>
            rows.length === 0 ? (
              <Empty title="No building requests" />
            ) : (
              <Table head={['Tenant', 'Building', 'Location', 'Requested', 'Status', 'Notes', '']}>
                {rows.map((b) => {
                  const pending = b.status === 'pending_approval';
                  return (
                    <tr key={b.id}>
                      <Td>{b.tenants.business_name}</Td>
                      <Td className="font-medium">{b.name}</Td>
                      <Td>{[b.address, b.city].filter(Boolean).join(', ') || '—'}</Td>
                      <Td>{fmtDate(b.created_at)}</Td>
                      <Td><Badge status={b.status} /></Td>
                      <Td>
                        {pending && (
                          <Input
                            className="h-8"
                            aria-label="Notes"
                            value={notes[b.id] ?? ''}
                            onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })}
                          />
                        )}
                      </Td>
                      <Td>
                        {pending && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="success" busy={m.busy} onClick={() => decide(b.id, 'approve', 'Building approved')}>
                              Approve
                            </Button>
                            <Button size="sm" variant="danger" busy={m.busy} onClick={() => decide(b.id, 'reject', 'Building rejected')}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            )
          }
        </Async>
      </Card>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
