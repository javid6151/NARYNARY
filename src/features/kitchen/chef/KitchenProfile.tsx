/** Chef profile: name, email, role, assigned buildings, owner console (staff only) and sign out. */
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../../access/useAuth';
import { useBuilding } from '../../access/useBuilding';
import { Avatar, Button, Card } from '../../../components/ui';
import { KitchenTopBar } from './ui/KitchenHeaders';

export function KitchenProfile({ name }: { name: string }) {
  const { session, chef, staff, signOut } = useAuth();
  const { buildings } = useBuilding();
  const nav = useNavigate();
  const m = chef ?? staff;
  return (
    <>
      <KitchenTopBar title="Profile" />
      <div className="flex items-center gap-4">
        <Avatar name={name || '?'} size={64} />
        <div className="min-w-0">
          <p className="text-lg font-semibold truncate">{name}</p>
          <p className="text-[13px] text-muted truncate">{session?.user.email}</p>
        </div>
      </div>
      <Card title="Kitchen access">
        <dl className="grid grid-cols-2 gap-y-2 text-[13.5px]">
          <dt className="text-muted">Business</dt>
          <dd className="text-right">{m?.tenant_name}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="text-right capitalize">{m?.role}</dd>
          <dt className="text-muted">Buildings</dt>
          <dd className="text-right">{buildings.map((b) => b.name).join(', ') || '—'}</dd>
        </dl>
        <p className="text-[12px] text-muted mt-3">The kitchen portal shows menus, meal counts and stock only — no resident or payment details.</p>
      </Card>
      {staff && (
        <Button variant="secondary" className="w-full" onClick={() => nav('/app')}>
          <LayoutDashboard className="size-4" />
          Open owner console
        </Button>
      )}
      <Button
        variant="secondary"
        className="w-full"
        onClick={async () => {
          await signOut();
          nav('/login');
        }}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </>
  );
}
