/** Team members (owner, managers, chefs) with plan limits, invite, and suspend/reactivate/revoke. */
import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { label } from '../../../lib/format';
import { Async, Badge, Button, Card, Confirm, ErrorBanner, Table, Td } from '../../../components/ui';
import { getStaffLimits, listTeam, setMembershipStatus } from '../api';
import type { TeamMember } from '../types';
import { InviteDrawer } from './InviteDrawer';

const CONFIRM_BODY: Record<string, string> = {
  revoked: 'They lose access immediately. History they created is kept.',
  suspended: 'They lose access until reactivated.',
  active: 'They regain access to assigned buildings.',
};

export function Team({ onToast }: { onToast: (m: string) => void }) {
  const st = useAsync(() => listTeam(), []);
  const sub = useAsync(() => getStaffLimits(), []);
  const [invite, setInvite] = useState(false);
  const [change, setChange] = useState<{ m: TeamMember; to: string } | null>(null);
  const cm = useMutation(() => setMembershipStatus(change!.m.id, change!.to));
  const rows = st.data ?? [];
  // Invitations count against the limit too.
  const count = (r: string) => rows.filter((m) => m.role === r && ['invited', 'active'].includes(m.status)).length;
  const limits = sub.data;
  const verb = change?.to === 'active' ? 'reactivate' : change?.to === 'suspended' ? 'suspend' : 'revoke';

  const inviteButton = (
    <Button size="sm" onClick={() => setInvite(true)}>
      <UserPlus className="size-4" />
      Invite manager / chef
    </Button>
  );

  return (
    <Card title="Team members" action={inviteButton}>
      {limits && (
        <p className="text-[13px] text-muted -mt-2 mb-4">
          Managers: {count('manager')} / {limits.manager_limit} · Chefs: {count('chef')} / {limits.chef_limit}
        </p>
      )}
      <Async state={st}>
        {() => (
          <Table head={['Name', 'Email', 'Role', 'Buildings', 'Status', '']}>
            {rows.map((m) => (
              <tr key={m.id}>
                <Td className="font-medium">{m.profiles?.full_name ?? m.display_name ?? '—'}</Td>
                <Td>{m.profiles?.email ?? m.invite_email}</Td>
                <Td className="capitalize">{m.role}</Td>
                <Td>{m.role === 'owner' ? 'All' : m.building_memberships.map((b) => b.buildings.name).join(', ')}</Td>
                <Td><Badge status={m.status}>{m.status === 'invited' ? 'Invitation pending' : undefined}</Badge></Td>
                <Td>
                  {m.role !== 'owner' && (
                    <div className="flex gap-1">
                      {m.status === 'active' && (
                        <Button variant="ghost" size="sm" onClick={() => setChange({ m, to: 'suspended' })}>Suspend</Button>
                      )}
                      {m.status === 'suspended' && (
                        <Button variant="ghost" size="sm" onClick={() => setChange({ m, to: 'active' })}>Reactivate</Button>
                      )}
                      {m.status !== 'revoked' && (
                        <Button variant="ghost" size="sm" className="text-bad" onClick={() => setChange({ m, to: 'revoked' })}>Revoke</Button>
                      )}
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Async>
      <p className="text-[12px] text-muted mt-3">
        Invited people sign up with the invited email; access is granted automatically after they verify it. No passwords are shared.
      </p>
      <InviteDrawer
        open={invite}
        onClose={() => setInvite(false)}
        onDone={() => {
          setInvite(false);
          onToast('Invitation created');
          st.reload();
        }}
      />
      <Confirm
        open={!!change}
        danger={change?.to !== 'active'}
        title={`${label(verb)} access?`}
        body={CONFIRM_BODY[change?.to ?? 'active']}
        busy={cm.busy}
        onClose={() => setChange(null)}
        onConfirm={async () => {
          if ((await cm.run()) !== undefined) {
            setChange(null);
            onToast('Access updated');
            st.reload();
          }
        }}
      >
        <ErrorBanner error={cm.error} />
      </Confirm>
    </Card>
  );
}
