/** All tenant accounts with status, plan and trial end; "Manage" opens status and subscription controls. */
import { useState } from 'react';
import { useAsync } from '../../../lib/hooks';
import { fmtDate } from '../../../lib/format';
import { Async, Badge, Button, Card, Empty, PageHeader, Table, Td, Toast } from '../../../components/ui';
import { listTenants } from '../api';
import type { TenantAccount } from '../types';
import { TenantDrawer } from '../components/TenantDrawer';

export function Tenants() {
  const st = useAsync(() => listTenants(), []);
  const [open, setOpen] = useState<TenantAccount | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Tenant accounts" subtitle="PG businesses on the platform." />
      <Card>
        <Async state={st}>
          {(rows) =>
            rows.length === 0 ? (
              <Empty title="No tenants" />
            ) : (
              <Table head={['Business', 'Contact', 'Status', 'Plan', 'Trial ends', 'Approved', '']}>
                {rows.map((t) => {
                  const s = t.subscriptions[0];
                  return (
                    <tr key={t.id}>
                      <Td className="font-medium">
                        {t.business_name}
                        <p className="text-[12px] text-muted">
                          <span className="tabular">{t.tenant_code}</span> · {t.city}
                        </p>
                      </Td>
                      <Td>
                        {t.email}
                        <p className="text-[12px] text-muted">{t.phone}</p>
                      </Td>
                      <Td><Badge status={t.status} /></Td>
                      <Td>
                        {s ? (
                          <>
                            {s.subscription_plans.name} <Badge status={s.status} />
                          </>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>{s?.trial_end ? fmtDate(s.trial_end) : '—'}</Td>
                      <Td>{fmtDate(t.approved_at)}</Td>
                      <Td><Button variant="ghost" size="sm" onClick={() => setOpen(t)}>Manage</Button></Td>
                    </tr>
                  );
                })}
              </Table>
            )
          }
        </Async>
      </Card>
      {open && (
        <TenantDrawer
          t={open}
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
