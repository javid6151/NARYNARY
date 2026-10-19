/** Items at or below their reorder level (from the dashboard summary). */
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty } from '../../../components/ui';
import type { DashboardSummary } from '../types';

export function LowStockAlerts({ items }: { items: DashboardSummary['low_stock'] }) {
  const nav = useNavigate();
  return (
    <Card title="Low stock alerts" action={<Button variant="ghost" size="sm" onClick={() => nav('/app/inventory')}>Go to inventory</Button>}>
      {items.length === 0 ? (
        <Empty title="All items above reorder level" />
      ) : (
        <ul className="divide-y divide-line text-[13px]">
          {items.map((l) => (
            <li key={l.name + l.building} className="flex items-center justify-between py-2.5">
              <span>
                {l.name} <span className="text-muted">· {l.building}</span>
              </span>
              <span className="text-bad font-medium tabular">
                {Number(l.qty)} {l.unit} left
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
