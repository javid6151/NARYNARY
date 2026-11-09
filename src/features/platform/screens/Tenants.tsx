/** All tenant accounts with status, plan and trial end; "Manage" opens status and subscription controls. */
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { fmtDate } from '../../../lib/format';
import { Async, Badge, Button, Card, Empty, Table, Td, Toast } from '../../../components/ui';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
import { listTenants } from '../api';
import type { TenantAccount } from '../types';
import { TenantDrawer } from '../components/TenantDrawer';

export function Tenants() {
  const st = useAsync(() => listTenants(), []);
  const [open, setOpen] = useState<TenantAccount | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const rows = st.data ?? [];

  return (
    <>
      <SectionPromoBanner
        fromTop
        eyebrow="TENANT DIRECTORY & LICENSING"
        title="Active PG Businesses & Subscriptions."
        subtitle="Manage customer accounts, trial periods, subscription quotas, and tenant lifecycle statuses."
        imageSrc="/owner-assets/hero-interior.jpg"
        statsBadge={rows.length > 0 ? `${rows.length} Active Accounts` : undefined}
        primaryAction={{
          label: 'Refresh Tenants',
          onClick: () => st.reload(),
          icon: Building2,
        }}
      />

      <Card className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl shadow-2xs">
        <Async state={st}>
          {(tenantRows) =>
            tenantRows.length === 0 ? (
              <Empty title="No tenants" />
            ) : (
              <Table head={['Business', 'Contact', 'Status', 'Plan', 'Trial ends', 'Approved', '']}>
                {tenantRows.map((t) => {
                  const s = t.subscriptions[0];
                  return (
                    <tr key={t.id}>
                      <Td className="font-semibold text-[#30271F]">
                        {t.business_name}
                        <p className="text-[12px] text-[#77736B]">
                          <span className="tabular">{t.tenant_code}</span> · {t.city}
                        </p>
                      </Td>
                      <Td>
                        <span className="text-[#30271F] font-medium">{t.email}</span>
                        <p className="text-[12px] text-[#77736B]">{t.phone}</p>
                      </Td>
                      <Td><Badge status={t.status} /></Td>
                      <Td>
                        {s ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-[#30271F]">{s.subscription_plans.name}</span>
                            <Badge status={s.status} />
                          </div>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>{s?.trial_end ? fmtDate(s.trial_end) : '—'}</Td>
                      <Td>{fmtDate(t.approved_at)}</Td>
                      <Td>
                        <Button variant="ghost" size="sm" onClick={() => setOpen(t)}>
                          Manage →
                        </Button>
                      </Td>
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
