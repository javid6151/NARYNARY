/** Subscription plans (pricing and limits are configuration, never hard-coded). */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { inr } from '../../../lib/format';
import { Async, Badge, Button, Card, PageHeader, Table, Td, Toast } from '../../../components/ui';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
import { listPlans } from '../api';
import type { Plan } from '../types';
import { PlanDrawer } from '../components/PlanDrawer';

export function Plans() {
  const st = useAsync(() => listPlans(), []);
  /** `{}` = new plan. */
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const rows = st.data ?? [];

  return (
    <>
      <PageHeader
        title="Subscription plans"
        subtitle="Pricing and limits are configuration — changes apply to new subscriptions."
      />

      <SectionPromoBanner
        eyebrow="SAAS MONETIZATION"
        title="Subscription Plans & Tier Configuration."
        subtitle="Configure resident quotas, manager and chef limits, trial days, and recurring monthly pricing."
        imageSrc="/owner-assets/payments-hero.jpg"
        statsBadge={rows.length > 0 ? `${rows.length} Configured Plans` : undefined}
        primaryAction={{
          label: 'New Subscription Plan',
          onClick: () => setEdit({}),
          icon: Plus,
        }}
      />

      <Card className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl shadow-2xs">
        <Async state={st}>
          {(planRows) => (
            <Table head={['Plan', 'Monthly price', 'Residents', 'Managers', 'Chefs', 'Trial days', 'Status', '']}>
              {planRows.map((p) => (
                <tr key={p.id}>
                  <Td className="font-semibold text-[#30271F]">
                    {p.name} {p.is_default && <Badge tone="brand">Default</Badge>}
                  </Td>
                  <Td className="tabular font-medium text-[#343B2B]">{inr(p.monthly_price)}</Td>
                  <Td>{p.included_residents}</Td>
                  <Td>{p.max_managers}</Td>
                  <Td>{p.max_chefs}</Td>
                  <Td>{p.trial_days}</Td>
                  <Td><Badge status={p.is_active ? 'active' : 'inactive'} /></Td>
                  <Td>
                    <Button variant="ghost" size="sm" onClick={() => setEdit(p)}>
                      Edit →
                    </Button>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
      {edit && (
        <PlanDrawer
          p={edit}
          onClose={() => setEdit(null)}
          onDone={() => {
            setEdit(null);
            setToast('Plan saved');
            st.reload();
          }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
