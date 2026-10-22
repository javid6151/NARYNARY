/** Additional buildings requested by existing tenants; approve or reject with optional notes. */
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { fmtDate } from '../../../lib/format';
import { Async, Badge, Button, Card, Empty, ErrorBanner, Input, PageHeader, Table, Td, Toast } from '../../../components/ui';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
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

  const rows = st.data ?? [];
  const pendingCount = rows.filter((b) => b.status === 'pending_approval').length;

  return (
    <>
      <PageHeader
        title="Additional building requests"
        subtitle="Existing tenants requesting more buildings."
      />

      <SectionPromoBanner
        eyebrow="PROPERTY EXPANSION"
        title="Building Expansion Requests."
        subtitle="Review and approve additional hostel facilities requested by active PG tenant businesses."
        imageSrc="/owner-assets/buildings-hero.jpg"
        statsBadge={pendingCount > 0 ? `${pendingCount} Pending Requests` : undefined}
        primaryAction={{
          label: 'Refresh Requests',
          onClick: () => st.reload(),
          icon: Building2,
        }}
      />

      <Card className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl shadow-2xs">
        <ErrorBanner error={m.error} />
        <Async state={st}>
          {() =>
            rows.length === 0 ? (
              <Empty title="No building requests" />
            ) : (
              <Table head={['Tenant', 'Building', 'Location', 'Requested', 'Status', 'Notes', '']}>
                {rows.map((b) => {
                  const pending = b.status === 'pending_approval';
                  return (
                    <tr key={b.id}>
                      <Td className="font-semibold text-[#30271F]">{b.tenants.business_name}</Td>
                      <Td className="font-bold text-[#343B2B]">{b.name}</Td>
                      <Td>{[b.address, b.city].filter(Boolean).join(', ') || '—'}</Td>
                      <Td>{fmtDate(b.created_at)}</Td>
                      <Td><Badge status={b.status} /></Td>
                      <Td>
                        {pending && (
                          <Input
                            className="h-8 rounded-lg bg-[#FFFEFC] border-[#DED6CB]"
                            aria-label="Notes"
                            placeholder="Optional notes…"
                            value={notes[b.id] ?? ''}
                            onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })}
                          />
                        )}
                      </Td>
                      <Td>
                        {pending && (
                          <div className="flex gap-1.5">
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
