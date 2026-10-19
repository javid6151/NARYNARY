/** Expense categories (add, activate/deactivate) and maintenance categories (add). */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { useBuilding } from '../../access/useBuilding';
import { Badge, Button, Card, ErrorBanner, Input } from '../../../components/ui';
import { addCategory, listAllExpenseCategories, listAllMaintenanceCategories, setExpenseCategoryActive } from '../api';

export function Categories({ onToast }: { onToast: (m: string) => void }) {
  const { tenantId } = useBuilding();
  const exp = useAsync(() => listAllExpenseCategories(), []);
  const mc = useAsync(() => listAllMaintenanceCategories(), []);
  const [name, setName] = useState('');
  const [mname, setMname] = useState('');
  const add = useMutation((table: 'expense_categories' | 'maintenance_categories', n: string) => addCategory(table, tenantId, n));
  const toggle = useMutation((id: string, active: boolean) => setExpenseCategoryActive(id, active));

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Expense categories">
        <ErrorBanner error={add.error ?? toggle.error} />
        <ul className="divide-y divide-line text-[13px] mb-3">
          {(exp.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>
                {c.name} {c.is_maintenance && <Badge tone="info">Maintenance</Badge>}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (await toggle.run(c.id, !c.is_active)) exp.reload();
                }}
              >
                {c.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input aria-label="New expense category" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
          <Button
            disabled={name.trim().length < 2}
            busy={add.busy}
            onClick={async () => {
              if (await add.run('expense_categories', name)) {
                setName('');
                exp.reload();
                onToast('Category added');
              }
            }}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </Card>
      <Card title="Maintenance categories">
        <ul className="divide-y divide-line text-[13px] mb-3">
          {(mc.data ?? []).map((c) => <li key={c.id} className="py-2">{c.name}</li>)}
        </ul>
        <div className="flex gap-2">
          <Input aria-label="New maintenance category" value={mname} onChange={(e) => setMname(e.target.value)} placeholder="New category" />
          <Button
            disabled={mname.trim().length < 2}
            busy={add.busy}
            onClick={async () => {
              if (await add.run('maintenance_categories', mname)) {
                setMname('');
                mc.reload();
                onToast('Category added');
              }
            }}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </Card>
    </div>
  );
}
