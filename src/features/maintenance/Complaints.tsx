/** Complaints page: issues raised by residents, filterable by active / resolved. */
import { useState } from 'react';
import { ListFilter, MessageSquareWarning } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { fmtDateTime, label } from '../../lib/format';
import { useBuilding } from '../access/useBuilding';
import { Async, Badge, Button, Card, Empty, PageHeader, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { listComplaints } from './api';
import { ComplaintDrawer } from './components/ComplaintDrawer';
import type { Complaint } from './types';

type Tab = 'active' | 'resolved' | 'all';
const ACTIVE = ['open', 'in_progress', 'awaiting_resident'];
const DONE = ['resolved', 'closed', 'rejected'];

export default function Complaints() {
  const { buildingId } = useBuilding();
  const [tab, setTab] = useState<Tab>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const st = useAsync(() => (!buildingId ? Promise.resolve([] as Complaint[]) : listComplaints(buildingId)), [buildingId]);
  const rows = (st.data ?? []).filter((c) => tab === 'all' || (tab === 'active' ? ACTIVE : DONE).includes(c.status));
  const open = (st.data ?? []).find((c) => c.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Complaints"
        subtitle="Issues raised by residents. Convert to a maintenance request when work is needed."
        actions={<BuildingPicker />}
      />

      <SectionPromoBanner
        eyebrow="FACILITY CARE"
        title="Prompt Resolution, Maintained Standards."
        subtitle="Track resident tickets, assign technicians, and convert issues to tracked maintenance requests."
        imageSrc="/owner-assets/lounge-promo.jpg"
        statsBadge={`${rows.length} Issues`}
        primaryAction={{
          label: tab === 'active' ? 'Active Issues' : 'Show Active',
          onClick: () => setTab('active'),
          icon: MessageSquareWarning,
        }}
        secondaryAction={{
          label: 'All Tickets',
          onClick: () => setTab('all'),
          icon: ListFilter,
        }}
      />
      <Card>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'active', label: 'Active' },
            { id: 'resolved', label: 'Resolved / closed' },
            { id: 'all', label: 'All' },
          ]}
        />
        <Async state={st}>
          {() =>
            rows.length === 0 ? (
              <Empty title="No complaints here" />
            ) : (
              <Table head={['Complaint', 'Resident', 'Room', 'Category', 'Priority', 'Raised', 'Status', '']}>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-subtle/60">
                    <Td className="font-medium max-w-64 truncate">{c.title}</Td>
                    <Td>{c.residents.full_name}</Td>
                    <Td>{c.rooms ? c.rooms.room_number : '—'}</Td>
                    <Td>{label(c.category)}</Td>
                    <Td><Badge status={c.priority} /></Td>
                    <Td className="text-muted">{fmtDateTime(c.submitted_at)}</Td>
                    <Td><Badge status={c.status} /></Td>
                    <Td><Button variant="ghost" size="sm" onClick={() => setOpenId(c.id)}>Open</Button></Td>
                  </tr>
                ))}
              </Table>
            )
          }
        </Async>
      </Card>
      {open && (
        <ComplaintDrawer
          c={open}
          onClose={() => setOpenId(null)}
          onChanged={(m) => {
            setToast(m);
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
