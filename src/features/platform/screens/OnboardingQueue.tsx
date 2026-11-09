/** Owner onboarding requests awaiting review, and those already reviewed. */
import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { fmtDateTime } from '../../../lib/format';
import { Async, Badge, Button, Card, Empty, Table, Tabs, Td, Toast } from '../../../components/ui';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
import { listOnboardingRequests } from '../api';
import { PENDING_ONBOARDING, type PlatformOnboardingRequest } from '../types';
import { ReviewDrawer } from '../components/ReviewDrawer';

export function OnboardingQueue() {
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const st = useAsync(() => listOnboardingRequests(), []);
  const [open, setOpen] = useState<PlatformOnboardingRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const all = st.data ?? [];
  const pendingCount = all.filter((r) => PENDING_ONBOARDING.includes(r.status)).length;
  const rows = all.filter((r) => (tab === 'pending') === PENDING_ONBOARDING.includes(r.status));

  return (
    <>
      <SectionPromoBanner
        fromTop
        eyebrow="PG VERIFICATION & APPROVALS"
        title="Tenant Verification & Onboarding."
        subtitle="Review pending PG businesses, inspect submitted documents, and grant authorized operational access."
        imageSrc="/owner-assets/buildings-hero.jpg"
        statsBadge={pendingCount > 0 ? `${pendingCount} Awaiting Review` : undefined}
        primaryAction={{
          label: tab === 'pending' ? 'Reviewed Tenants' : `Awaiting Review (${pendingCount})`,
          onClick: () => setTab(tab === 'pending' ? 'done' : 'pending'),
          icon: ClipboardCheck,
        }}
      />

      <Card className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl shadow-2xs">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'pending', label: `Awaiting review (${pendingCount})` },
            { id: 'done', label: 'Reviewed' },
          ]}
        />
        <Async state={st}>
          {() =>
            rows.length === 0 ? (
              <Empty title="Nothing here" />
            ) : (
              <Table head={['Business', 'Contact', 'Buildings', 'Submitted', 'Status', '']}>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-semibold text-[#30271F]">{r.business_details?.business_name ?? 'Untitled'}</Td>
                    <Td>
                      <span className="text-[#30271F] font-medium">{r.contact_details?.email ?? 'No email'}</span>
                      <p className="text-[12px] text-[#77736B]">{r.contact_details?.phone ?? 'No phone'}</p>
                    </Td>
                    <Td>{r.business_details?.buildings?.map((b) => b?.name)?.filter(Boolean)?.join(', ') || 'None'}</Td>
                    <Td>{fmtDateTime(r.created_at)}</Td>
                    <Td><Badge status={r.status} /></Td>
                    <Td>
                      <Button variant="ghost" size="sm" onClick={() => setOpen(r)}>
                        Review →
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )
          }
        </Async>
      </Card>
      {open && (
        <ReviewDrawer
          r={open}
          onClose={() => setOpen(null)}
          onDone={(m) => {
            setOpen(null);
            setToast(m);
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
