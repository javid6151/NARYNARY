/**
 * Resident Portal Server & Access Management (`/owner/resident-portal-server`).
 * Allows the PG owner to approve and grant resident portal access, generate/change passwords,
 * suspend, ban, reactivate, or remove resident portal authentication for Port 5000.
 */
import { useEffect, useState } from 'react';
import {
  AlertCircle, Ban, Check, CheckCircle2, Copy, ExternalLink, KeyRound,
  RefreshCw, Search, ShieldCheck, UserCheck, Users, X
} from 'lucide-react';
import { useAsync, useMutation } from '../../lib/hooks';
import { useBuilding } from '../access/useBuilding';
import { BuildingPicker } from '../../components/BuildingPicker';
import {
  Button, Card, Empty, ErrorBanner, Field,
  Input, Loading, PageHeader, Table, Td
} from '../../components/ui';
import {
  listResidentPortalAccounts, manageResidentPortalAccess,
  setResidentPortalPassword, type ResidentPortalAccount
} from './api';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';

function ModalDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-xs" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-line p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
          <h3 className="font-semibold text-base text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-subtle text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ResidentPortalServer() {
  const { selected } = useBuilding();
  const bid = selected === 'all' ? null : selected;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'no_account' | 'active' | 'suspended'>('all');
  const [toast, setToast] = useState<string | null>(null);

  // Modal States
  const [passItem, setPassItem] = useState<ResidentPortalAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [confirmStatusAction, setConfirmStatusAction] = useState<{
    item: ResidentPortalAccount;
    action: 'suspend' | 'reactivate' | 'remove_access';
  } | null>(null);

  const [createdCreds, setCreatedCreds] = useState<{
    fullName: string;
    phone: string;
    email: string;
    password: string;
    title: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  // Data fetching
  const accounts = useAsync(() => listResidentPortalAccounts(bid), [bid]);

  const reloadAll = () => {
    accounts.reload();
  };

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Filter accounts
  const accountList = (accounts.data ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.full_name?.toLowerCase().includes(q) ||
      r.phone?.includes(q) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.room_number && r.room_number.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && r.portal_status === 'active') ||
      (statusFilter === 'suspended' && (r.portal_status === 'suspended' || r.resident_status === 'blocked')) ||
      (statusFilter === 'no_account' && r.portal_status === 'no_account');

    return matchesSearch && matchesStatus;
  });

  const totalCount = (accounts.data ?? []).length;
  const noAccountCount = (accounts.data ?? []).filter((r) => r.portal_status === 'no_account').length;
  const activeCount = (accounts.data ?? []).filter((r) => r.portal_status === 'active').length;
  const suspendedCount = (accounts.data ?? []).filter((r) => r.portal_status === 'suspended' || r.resident_status === 'blocked').length;

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Zip@${code}`;
  };

  // Mutation: Set/Change Password or Approve Portal Access
  const passwordMutation = useMutation(async () => {
    if (!passItem) return;
    const pw = newPassword.trim() || generateRandomPassword();
    const isNewApproval = passItem.portal_status === 'no_account';

    const res = await setResidentPortalPassword({
      residentId: passItem.id,
      phone: passItem.phone,
      email: passItem.email || undefined,
      fullName: passItem.full_name,
      password: pw,
      tenantId: passItem.tenant_id,
    });

    setPassItem(null);
    reloadAll();
    setCreatedCreds({
      fullName: passItem.full_name,
      phone: passItem.phone,
      email: res.email,
      password: pw,
      title: isNewApproval ? 'Resident Portal Access Approved & Granted!' : 'Resident Portal Password Successfully Updated!',
    });
  });

  // Mutation: Manage Status (Suspend / Reactivate / Remove)
  const statusMutation = useMutation(async () => {
    if (!confirmStatusAction) return;
    const { item, action } = confirmStatusAction;
    await manageResidentPortalAccess({
      residentId: item.id,
      action,
      tenantId: item.tenant_id,
    });
    setConfirmStatusAction(null);
    reloadAll();
    setToast(
      action === 'suspend'
        ? `${item.full_name}'s portal access suspended`
        : action === 'reactivate'
        ? `${item.full_name}'s portal access reactivated`
        : `${item.full_name}'s portal access removed`
    );
  });

  const copyCredsToClipboard = (c: { fullName: string; phone: string; email: string; password: string }) => {
    const text =
`*Zipnary Resident Portal Access*
Hi ${c.fullName}! Your resident account has been granted access.

🌐 *Login Portal:* http://localhost:5000
📱 *Mobile Number:* ${c.phone}
🔑 *Portal Password:* ${c.password}

Please sign in to view your room allotment, rent payment receipts, mess meals, notices and complaints.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resident Portal Server & Access"
        subtitle="Approve resident portal access, generate passwords, ban/suspend accounts, and control login permissions for Port 5000."
        actions={
          <div className="flex items-center gap-2">
            <BuildingPicker allowAll />
            <a
              href="http://localhost:5000/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Open Port 5000
            </a>
          </div>
        }
      />

      <SectionPromoBanner
        eyebrow="PORTAL SECURITY & AUTH"
        title="Resident Portal Server & Access."
        subtitle="Approve resident logins, issue encrypted passwords, monitor access permissions, and launch Port 5000."
        imageSrc="/owner-assets/residents-hero.jpg"
        statsBadge={`${activeCount} Active Accounts`}
        primaryAction={{
          label: 'Launch Portal (Port 5000)',
          onClick: () => window.open('http://localhost:5000', '_blank'),
          icon: ExternalLink,
        }}
        secondaryAction={{
          label: 'Refresh Status',
          onClick: reloadAll,
          icon: RefreshCw,
        }}
      />

      {toast && (
        <div className="p-3 rounded-xl bg-ok-bg border border-ok/30 text-xs text-ok flex items-center justify-between">
          <span className="font-medium">{toast}</span>
          <button onClick={() => setToast(null)}><X className="size-4" /></button>
        </div>
      )}

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-amber-50 text-amber-700 grid place-items-center">
            <KeyRound className="size-5" />
          </div>
          <div>
            <div className="text-xl font-bold">{noAccountCount}</div>
            <div className="text-xs text-muted">Pending Portal Approval</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-ok-bg text-ok grid place-items-center">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="text-xl font-bold">{activeCount}</div>
            <div className="text-xs text-muted">Active Portal Accounts</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-bad-bg text-bad grid place-items-center">
            <Ban className="size-5" />
          </div>
          <div>
            <div className="text-xl font-bold">{suspendedCount}</div>
            <div className="text-xs text-muted">Suspended / Banned</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-50 text-blue-700 grid place-items-center">
            <Users className="size-5" />
          </div>
          <div>
            <div className="text-xl font-bold">{totalCount}</div>
            <div className="text-xs text-muted">Total PG Residents</div>
          </div>
        </Card>
      </div>

      {/* RESIDENT PORTAL ACCOUNTS DIRECTORY */}
      <Card
        title={
          <div>
            <div className="font-semibold text-ink">Resident Portal Directory & Authentication</div>
            <p className="text-xs font-normal text-muted mt-0.5">
              Approve portal access for new residents, change passwords, and manage active or suspended logins.
            </p>
          </div>
        }
        action={
          <Button variant="ghost" size="sm" onClick={reloadAll}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        }
      >
        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="relative w-full sm:w-72">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or room..."
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                statusFilter === 'all' ? 'bg-ink text-white' : 'bg-canvas text-muted hover:text-ink'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('no_account')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                statusFilter === 'no_account' ? 'bg-amber-600 text-white' : 'bg-canvas text-muted hover:text-ink'
              }`}
            >
              Pending Approval ({noAccountCount})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                statusFilter === 'active' ? 'bg-ok text-white' : 'bg-canvas text-muted hover:text-ink'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                statusFilter === 'suspended' ? 'bg-bad text-white' : 'bg-canvas text-muted hover:text-ink'
              }`}
            >
              Suspended ({suspendedCount})
            </button>
          </div>
        </div>

        {accounts.loading ? (
          <Loading />
        ) : accountList.length === 0 ? (
          <Empty title="No residents matching criteria" />
        ) : (
          <Table head={['Resident', 'Room / Bed', 'Contact (Login ID)', 'Portal Access Status', 'Actions']}>
            {accountList.map((r) => {
              const isSuspended = r.portal_status === 'suspended' || r.resident_status === 'blocked';
              const hasAccount = r.portal_status !== 'no_account';

              return (
                <tr key={r.id} className="hover:bg-canvas/50">
                  <Td className="font-semibold text-ink">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-brand-50 text-brand-700 grid place-items-center font-bold text-xs">
                        {r.full_name?.charAt(0) || 'R'}
                      </div>
                      <div>
                        <div>{r.full_name}</div>
                        <div className="text-[11px] font-normal text-muted">{r.building_name}</div>
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <div className="font-medium text-ink">Room {r.room_number}</div>
                    <div className="text-xs text-muted">Bed {r.bed_label}</div>
                  </Td>

                  <Td>
                    <div className="tabular font-medium">{r.phone}</div>
                    <div className="text-xs text-muted truncate max-w-44">{r.email || '—'}</div>
                  </Td>

                  <Td>
                    {isSuspended ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-bad-bg text-bad border border-bad/30">
                        <Ban className="size-3" />
                        Suspended / Blocked
                      </span>
                    ) : hasAccount ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-ok-bg text-ok border border-ok/30">
                        <CheckCircle2 className="size-3" />
                        Active Portal User
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        <AlertCircle className="size-3" />
                        Pending Portal Approval
                      </span>
                    )}
                  </Td>

                  <Td>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Approve Access / Change Password */}
                      <Button
                        variant={hasAccount ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => {
                          setPassItem(r);
                          setNewPassword(`Pass${(r.phone || '1234').replace(/\D/g, '').slice(-4)}!`);
                        }}
                        className={`h-8 text-xs font-medium ${!hasAccount ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-xs' : ''}`}
                      >
                        <KeyRound className="size-3" />
                        {hasAccount ? 'Change Password' : 'Approve Portal Access'}
                      </Button>

                      {/* Suspend or Reactivate */}
                      {hasAccount && (
                        isSuspended ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmStatusAction({ item: r, action: 'reactivate' })}
                            className="h-8 text-xs text-ok hover:bg-ok-bg"
                          >
                            <UserCheck className="size-3" />
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmStatusAction({ item: r, action: 'suspend' })}
                            className="h-8 text-xs text-bad hover:bg-bad-bg"
                          >
                            <Ban className="size-3" />
                            Suspend / Ban
                          </Button>
                        )
                      )}

                      {/* Remove portal access */}
                      {hasAccount && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmStatusAction({ item: r, action: 'remove_access' })}
                          className="h-8 text-xs text-muted hover:text-bad"
                          title="Remove portal access"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* MODAL 1: APPROVE PORTAL ACCESS OR CHANGE PASSWORD */}
      <ModalDialog
        open={!!passItem}
        onClose={() => setPassItem(null)}
        title={
          passItem?.portal_status === 'no_account'
            ? `Approve Portal Access: ${passItem?.full_name}`
            : `Set Portal Password: ${passItem?.full_name}`
        }
      >
        {passItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              passwordMutation.run();
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Resident Name:</span>
                <span className="font-semibold text-ink">{passItem.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Room & Bed:</span>
                <span className="font-semibold text-ink">Room {passItem.room_number} (Bed {passItem.bed_label})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Login Identifier (Mobile):</span>
                <span className="font-semibold text-ink font-mono">{passItem.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Registered Email:</span>
                <span className="font-semibold text-ink">{passItem.email || 'Auto-generated internal email'}</span>
              </div>
            </div>

            <Field
              label={passItem.portal_status === 'no_account' ? 'Set Initial Portal Password' : 'New Portal Password'}
              required
              hint="Resident will use this password to sign into Port 5000"
            >
              {() => (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-9 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setNewPassword(generateRandomPassword())}
                  >
                    Generate
                  </Button>
                </div>
              )}
            </Field>

            <ErrorBanner error={passwordMutation.error} />

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="ghost" onClick={() => setPassItem(null)}>
                Cancel
              </Button>
              <Button type="submit" busy={passwordMutation.busy} className="bg-brand-600 hover:bg-brand-700 text-white">
                {passItem.portal_status === 'no_account' ? 'Approve & Grant Access' : 'Save & Update Password'}
              </Button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* MODAL 2: CREDENTIALS SUCCESS DIALOG */}
      <ModalDialog
        open={!!createdCreds}
        onClose={() => setCreatedCreds(null)}
        title={createdCreds?.title || 'Portal Credentials Saved'}
      >
        {createdCreds && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-ok-bg/40 border border-ok/30 space-y-2">
              <div className="flex items-center gap-2 text-ok font-semibold text-sm">
                <CheckCircle2 className="size-4" />
                Resident Portal Authentication Ready
              </div>
              <p className="text-muted text-xs">
                {createdCreds.fullName} can now sign in at{' '}
                <a href="http://localhost:5000" target="_blank" rel="noreferrer" className="text-brand-700 font-semibold underline">
                  http://localhost:5000
                </a>{' '}
                using these credentials:
              </p>
            </div>

            <div className="bg-canvas p-4 rounded-xl border border-line font-mono text-xs space-y-2 text-ink">
              <div className="flex justify-between items-center py-1 border-b border-line/60">
                <span className="text-muted">Login URL:</span>
                <span className="font-semibold text-brand-700">http://localhost:5000</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/60">
                <span className="text-muted">Login ID (Mobile):</span>
                <span className="font-bold">{createdCreds.phone}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-line/60">
                <span className="text-muted">Account Email:</span>
                <span className="text-ink">{createdCreds.email}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted">Portal Password:</span>
                <span className="font-bold text-brand-700 bg-white px-2 py-0.5 rounded border border-line">
                  {createdCreds.password}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="w-full bg-brand-600 hover:bg-brand-700 text-white"
                onClick={() => copyCredsToClipboard(createdCreds)}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied to Clipboard!' : 'Copy Credentials for Resident'}
              </Button>
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setCreatedCreds(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* MODAL 3: CONFIRM STATUS ACTION */}
      <ModalDialog
        open={!!confirmStatusAction}
        onClose={() => setConfirmStatusAction(null)}
        title={
          confirmStatusAction?.action === 'suspend'
            ? `Suspend Resident Portal: ${confirmStatusAction.item.full_name}`
            : confirmStatusAction?.action === 'reactivate'
            ? `Reactivate Portal: ${confirmStatusAction.item.full_name}`
            : `Remove Portal Access: ${confirmStatusAction?.item.full_name}`
        }
      >
        {confirmStatusAction && (
          <div className="space-y-4 text-xs">
            <p className="text-ink text-sm">
              {confirmStatusAction.action === 'suspend' && (
                <>
                  Are you sure you want to suspend portal login for <strong>{confirmStatusAction.item.full_name}</strong>?
                  They will immediately be blocked from logging into Port 5000 until reactivated.
                </>
              )}
              {confirmStatusAction.action === 'reactivate' && (
                <>
                  Reactivate portal access for <strong>{confirmStatusAction.item.full_name}</strong>?
                  Their login access to Port 5000 will be restored immediately.
                </>
              )}
              {confirmStatusAction.action === 'remove_access' && (
                <>
                  Permanently remove portal access credentials for <strong>{confirmStatusAction.item.full_name}</strong>?
                  Their Supabase Auth login will be deleted. (Their resident stay and billing history will remain preserved).
                </>
              )}
            </p>

            <ErrorBanner error={statusMutation.error} />

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setConfirmStatusAction(null)}>
                Cancel
              </Button>
              <Button
                busy={statusMutation.busy}
                onClick={() => statusMutation.run()}
                className={
                  confirmStatusAction.action === 'suspend'
                    ? 'bg-bad hover:bg-bad/90 text-white'
                    : confirmStatusAction.action === 'reactivate'
                    ? 'bg-ok hover:bg-ok/90 text-white'
                    : 'bg-bad hover:bg-bad/90 text-white'
                }
              >
                {confirmStatusAction.action === 'suspend'
                  ? 'Yes, Suspend Account'
                  : confirmStatusAction.action === 'reactivate'
                  ? 'Yes, Reactivate Access'
                  : 'Yes, Remove Portal Access'}
              </Button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
