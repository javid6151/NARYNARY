/** Most recent maintenance requests that still need work. */
import { useNavigate } from 'react-router-dom';
import type { AsyncState } from '../../../lib/hooks';
import { Async, Badge, Button, Card, Empty, Table, Td } from '../../../components/ui';
import type { OpenMaintenanceItem } from '../types';

export function OpenMaintenance({ state }: { state: AsyncState<OpenMaintenanceItem[]> }) {
  const nav = useNavigate();
  return (
    <Card
      title="Maintenance requiring attention"
      action={<Button variant="ghost" size="sm" onClick={() => nav('/app/maintenance')}>View all</Button>}
    >
      <Async state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty title="No open requests" />
          ) : (
            <Table head={['Request', 'Priority', 'Status']}>
              {rows.map((m) => (
                <tr key={m.id}>
                  <Td className="max-w-48 truncate">{m.title}</Td>
                  <Td><Badge status={m.priority} /></Td>
                  <Td><Badge status={m.status} /></Td>
                </tr>
              ))}
            </Table>
          )
        }
      </Async>
    </Card>
  );
}
