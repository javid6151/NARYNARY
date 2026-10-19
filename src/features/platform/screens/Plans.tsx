/** Subscription plans (pricing and limits are configuration, never hard-coded). */
import { useState } from 'react';
import { useAsync } from '../../../lib/hooks';
import { inr } from '../../../lib/format';
import { Async, Badge, Button, Card, PageHeader, Table, Td, Toast } from '../../../components/ui';
import { listPlans } from '../api';
import type { Plan } from '../types';
import { PlanDrawer } from '../components/PlanDrawer';

export function Plans() {
  const st = useAsync(() => listPlans(), []);
  /** `{}` = new plan. */
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Subscription plans"
        subtitle="Pricing and limits are configuration — changes apply to new subscriptions."
        actions={<Button onClick={() => setEdit({})}>New plan</Button>}
      />
      <Card>
        <Async state={st}>
          {(rows) => (
            <Table head={['Plan', 'Monthly price', 'Residents', 'Managers', 'Chefs', 'Trial days', 'Status', '']}>
              {rows.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">
                    {p.name} {p.is_default && <Badge tone="brand">Default</Badge>}
                  </Td>
                  <Td className="tabular">{inr(p.monthly_price)}</Td>
                  <Td>{p.included_residents}</Td>
                  <Td>{p.max_managers}</Td>
                  <Td>{p.max_chefs}</Td>
                  <Td>{p.trial_days}</Td>
                  <Td><Badge status={p.is_active ? 'active' : 'inactive'} /></Td>
                  <Td><Button variant="ghost" size="sm" onClick={() => setEdit(p)}>Edit</Button></Td>
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
