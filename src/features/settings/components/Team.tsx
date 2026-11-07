/** Team members (owner, managers, chefs) with direct account creation, password management, and deletion. */
import { useState } from 'react';
import { KeyRound, Trash2, User, UserPlus } from 'lucide-react';
import { useAsync, useMutation } from '../../../lib/hooks';
import { label } from '../../../lib/format';
import { Async, Badge, Button, Card, Confirm, ErrorBanner, Field, Input, Table, Td } from '../../../components/ui';
import { changeTeamPassword, deleteTeamMember, getStaffLimits, listTeam, setMembershipStatus } from '../api';
import type { TeamMember } from '../types';
import { InviteDrawer } from './InviteDrawer';

const CONFIRM_BODY: Record<string, string> = {
  revoked: 'They lose access immediately. History they created is kept.',
  suspended: 'They lose access until reactivated.',
  active: 'They regain access to assigned buildings.',
};

export function Team({ onToast, onEditProfile }: { onToast: (m: string) => void; onEditProfile?: () => void }) {
  const st = useAsync(() => listTeam(), []);
  const sub = useAsync(() => getStaffLimits(), []);
  const [invite, setInvite] = useState(false);
  const [change, setChange] = useState<{ m: TeamMember; to: string } | null>(null);
  const [delMember, setDelMember] = useState<TeamMember | null>(null);
  const [passMember, setPassMember] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  const cm = useMutation(() => setMembershipStatus(change!.m.id, change!.to));
  const dm = useMutation(() => deleteTeamMember(delMember!.id, delMember!.user_id));

  const rows = st.data ?? [];
  const count = (r: string) => rows.filter((m) => m.role === r && ['invited', 'active'].includes(m.status)).length;
  const limits = sub.data;
  const verb = change?.to === 'active' ? 'reactivate' : change?.to === 'suspended' ? 'suspend' : 'revoke';

  const handlePasswordSubmit = async () => {
    if (!passMember?.user_id) {
      setPassError('This member does not have an active login user account yet.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPassError('Password must be at least 6 characters.');
      return;
    }

    setPassBusy(true);
    setPassError(null);
    try {
      await changeTeamPassword(passMember.user_id, newPassword);
      onToast(`Password successfully updated for ${passMember.profiles?.full_name || passMember.display_name || passMember.role}!`);
      setPassMember(null);
      setNewPassword('');
    } catch (err: unknown) {
      setPassError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPassBusy(false);
    }
  };

  const inviteButton = (
    <Button size="sm" onClick={() => setInvite(true)}>
      <UserPlus className="size-4" />
      Add team member
    </Button>
  );

  return (
    <Card title="Team members (Managers & Chefs)" action={inviteButton}>
      {limits && (
        <p className="text-[13px] text-muted -mt-2 mb-4">
          Managers: {count('manager')} / {limits.manager_limit} · Chefs: {count('chef')} / {limits.chef_limit}
        </p>
      )}
      <Async state={st}>
        {() => (
          <Table head={['Name', 'Email / Login ID', 'Role', 'Assigned Buildings', 'Status', 'Actions']}>
            {rows.map((m) => (
              <tr key={m.id}>
                <Td className="font-medium">{m.profiles?.full_name ?? m.display_name ?? '—'}</Td>
                <Td className="tabular">{m.profiles?.email ?? m.invite_email ?? '—'}</Td>
                <Td className="capitalize font-medium">{m.role === 'chef' ? 'Chef / Kitchen' : m.role}</Td>
                <Td>{m.role === 'owner' ? 'All Buildings' : m.building_memberships.map((b) => b.buildings.name).join(', ') || 'None'}</Td>
                <Td><Badge status={m.status}>{m.status === 'invited' ? 'Pending' : undefined}</Badge></Td>
                <Td>
                  {m.role === 'owner' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onEditProfile?.()}
                      className="text-xs h-7 px-2.5"
                    >
                      <User className="size-3.5" />
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {m.user_id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setPassMember(m);
                            setNewPassword('');
                            setPassError(null);
                          }}
                          className="text-xs h-7 px-2"
                        >
                          <KeyRound className="size-3.5" />
                          Password
                        </Button>
                      )}
                      {m.status === 'active' && (
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setChange({ m, to: 'suspended' })}>
                          Suspend
                        </Button>
                      )}
                      {m.status === 'suspended' && (
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setChange({ m, to: 'active' })}>
                          Reactivate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2 text-bad hover:bg-bad-bg"
                        onClick={() => setDelMember(m)}
                        title="Delete member"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Async>
      <p className="text-[12px] text-muted mt-3">
        Owner controls all team credentials: You can create Managers and Chefs, set their login passwords, and update passwords live in the database anytime.
      </p>

      {/* Add Team Member Drawer */}
      <InviteDrawer
        open={invite}
        onClose={() => setInvite(false)}
        onDone={() => {
          setInvite(false);
          onToast('Team member account created and saved in database');
          st.reload();
        }}
      />

      {/* Change Password Modal */}
      {passMember && (
        <Confirm
          open={!!passMember}
          title={`Set New Password for ${passMember.profiles?.full_name || passMember.display_name || passMember.role}`}
          body="Enter a new login password. The password will be updated immediately live in the database."
          confirmLabel="Save Password Live"
          busy={passBusy}
          onConfirm={handlePasswordSubmit}
          onClose={() => setPassMember(null)}
        >
          <ErrorBanner error={passError} />
          <Field label="New Password" required hint="At least 6 characters">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                required
              />
            )}
          </Field>
        </Confirm>
      )}

      {/* Suspend / Reactivate Confirm */}
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
            onToast('Access updated in database');
            st.reload();
          }
        }}
      >
        <ErrorBanner error={cm.error} />
      </Confirm>

      {/* Delete Confirm */}
      <Confirm
        open={!!delMember}
        danger
        title={`Delete ${delMember?.profiles?.full_name || delMember?.display_name || 'team member'}?`}
        body="This will permanently remove this account, revoke their memberships, and delete their login access."
        busy={dm.busy}
        onClose={() => setDelMember(null)}
        onConfirm={async () => {
          if ((await dm.run()) !== undefined) {
            setDelMember(null);
            onToast('Team member deleted from database');
            st.reload();
          }
        }}
      >
        <ErrorBanner error={dm.error} />
      </Confirm>
    </Card>
  );
}
