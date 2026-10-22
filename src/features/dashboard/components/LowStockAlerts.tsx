/** Items at or below their reorder level (from the dashboard summary). */
import { useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { Button, Card, Empty } from '../../../components/ui';
import type { DashboardSummary } from '../types';

export function LowStockAlerts({ items }: { items: DashboardSummary['low_stock'] }) {
  const nav = useNavigate();
  return (
    <Card
      title="Low stock alerts"
      action={
        <Button variant="ghost" size="sm" onClick={() => nav('inventory')}>
          View all
        </Button>
      }
    >
      {items.length === 0 ? (
        <Empty title="All items above reorder level" />
      ) : (
        <ul className="divide-y divide-line text-[13px]">
          {items.map((l) => (
            <li key={l.name + l.building} className="flex items-center justify-between py-2.5 gap-2">
              <div className="min-w-0">
                <span className="font-medium text-ink block truncate">{l.name}</span>
                <span className="text-muted text-xs">
                  {l.building} · Threshold: {l.reorder} {l.unit}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-semibold tabular text-xs ${Number(l.qty) <= 0 ? 'text-bad' : 'text-warn'}`}>
                  {Number(l.qty) <= 0 ? 'Out of stock' : `${Number(l.qty)} ${l.unit} left`}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => nav('inventory')}
                  title="Replenish stock"
                  className="text-xs h-7 px-2"
                >
                  <ShoppingCart className="size-3" />
                  Replenish
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
