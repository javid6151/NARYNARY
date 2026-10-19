/** Cross-tenant audit log (latest 300 entries). */
import { useAsync } from '../../../lib/hooks';
import { fmtDateTime, label } from '../../../lib/format';
import { Async, Card, PageHeader, Table, Td } from '../../../components/ui';
import { listPlatformAuditLogs } from '../../audit/api';
import { activityLabel } from '../../audit/activityLabel';
import type { PlatformAuditEntry } from '../types';

export function Audit() {
  const st = useAsync(() => listPlatformAuditLogs() as Promise<PlatformAuditEntry[]>, []);
  return (
    <>
      <PageHeader title="Platform audit log" subtitle="Most recent 300 privileged and business actions." />
      <Card>
        <Async state={st}>
          {(rows) => (
            <Table head={['When', 'Tenant', 'Action', 'Entity', 'Actor']}>
              {rows.map((a) => (
                <tr key={a.id}>
                  <Td className="text-muted whitespace-nowrap">{fmtDateTime(a.created_at)}</Td>
                  <Td>{a.tenants?.business_name ?? 'Platform'}</Td>
                  <Td>{activityLabel(a.action)}</Td>
                  <Td>{label(a.entity_type)}</Td>
                  <Td>{label(a.actor_type)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </Card>
    </>
  );
}
