/** Cross-tenant audit log (latest 300 entries). */
import { ScrollText } from 'lucide-react';
import { useAsync } from '../../../lib/hooks';
import { fmtDateTime, label } from '../../../lib/format';
import { Async, Card, Table, Td } from '../../../components/ui';
import { SectionPromoBanner } from '../../../components/SectionPromoBanner';
import { listPlatformAuditLogs } from '../../audit/api';
import { activityLabel } from '../../audit/activityLabel';
import type { PlatformAuditEntry } from '../types';

export function Audit() {
  const st = useAsync(() => listPlatformAuditLogs() as Promise<PlatformAuditEntry[]>, []);
  const rows = st.data ?? [];

  return (
    <>
      <SectionPromoBanner
        fromTop
        eyebrow="SECURITY & GOVERNANCE"
        title="Cross-Tenant Audit Ledger."
        subtitle="Permanent immutable history of privileged actions, approvals, quota modifications, and logins."
        imageSrc="/owner-assets/payments-hero.jpg"
        statsBadge={rows.length > 0 ? `${rows.length} Audited Events` : undefined}
        primaryAction={{
          label: 'Refresh Audit Log',
          onClick: () => st.reload(),
          icon: ScrollText,
        }}
      />

      <Card className="bg-[#FFFEFC] border border-[#DED6CB] rounded-2xl shadow-2xs">
        <Async state={st}>
          {(auditRows) => (
            <Table head={['When', 'Tenant', 'Action', 'Entity', 'Actor']}>
              {auditRows.map((a) => (
                <tr key={a.id}>
                  <Td className="text-[#77736B] whitespace-nowrap tabular">{fmtDateTime(a.created_at)}</Td>
                  <Td className="font-semibold text-[#30271F]">{a.tenants?.business_name ?? 'Platform'}</Td>
                  <Td className="font-medium text-[#343B2B]">{activityLabel(a.action)}</Td>
                  <Td className="text-[#59534B]">{label(a.entity_type)}</Td>
                  <Td className="text-[#77736B]">{label(a.actor_type)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
    </>
  );
}
