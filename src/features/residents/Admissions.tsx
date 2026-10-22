import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Copy, Eye, FileClock, Inbox, KeyRound, Plus, Search, Share2, X, XCircle } from 'lucide-react';
import { useAsync, useMutation } from '../../lib/hooks';
import { fmtDate, fmtDateTime, inr } from '../../lib/format';
import { useAuth } from '../access/useAuth';
import { useBuilding } from '../access/useBuilding';
import { Async, Avatar, Badge, Button, Card, Empty, ErrorBanner, Field, Input, PageHeader, StatCard, Table, Tabs, Td, Toast } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { listAdmissions, setResidentPortalPassword } from './api';
import { AdmissionDrawer } from './components/AdmissionDrawer';
import type { AdmissionRow } from './types';

type Tab = 'all' | 'pending_review' | 'approved' | 'rejected' | 'completed';

/** Badge text for statuses whose raw name reads badly. */
const statusText = (s: string) => (s === 'pending_review' ? 'Pending approval' : s === 'completed' ? 'Checked out' : undefined);

export default function Admissions() {
  const { staff } = useAuth();
  const { buildingId } = useBuilding();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Portal access modal state
  const [portalTarget, setPortalTarget] = useState<AdmissionRow | null>(null);
  const [portalPassword, setPortalPassword] = useState('');
  const [portalSuccess, setPortalSuccess] = useState<{
    name: string;
    phone: string;
    password: string;
    copied: boolean;
  } | null>(null);

  const st = useAsync(() => (!buildingId ? Promise.resolve([] as AdmissionRow[]) : listAdmissions(buildingId)), [buildingId]);

  const portalMutation = useMutation(async () => {
    if (!portalTarget) return;
    const pwd = portalPassword.trim() || `Pass${(portalTarget.residents.phone || '1234').replace(/\D/g, '').slice(-4)}!`;
    await setResidentPortalPassword({
      residentId: portalTarget.residents.id,
      phone: portalTarget.residents.phone,
      email: portalTarget.residents.email || undefined,
      fullName: portalTarget.residents.full_name,
      password: pwd,
    });
    setPortalSuccess({
      name: portalTarget.residents.full_name,
      phone: portalTarget.residents.phone,
      password: pwd,
      copied: false,
    });
    setToast('Resident portal access activated!');
    st.reload();
  });

  const rows = useMemo(() => st.data ?? [], [st.data]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tab === 'all' || r.status === tab) &&
          (!search ||
            `${r.residents.full_name} ${r.residents.phone} ${r.rooms.room_number} ${r.beds.bed_label}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [rows, tab, search],
  );
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Admission requests"
        subtitle="Review new residents, approve to allocate the bed and create first-month charges."
        actions={
          <>
            <BuildingPicker />
            <Button onClick={() => nav('/app/admissions/new')}>
              <Plus className="size-4" />
              New admission
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Inbox className="size-5" />} label="Total requests" value={rows.length} />
        <StatCard
          icon={<FileClock className="size-5" />}
          tone="warn"
          label="Pending approval"
          value={count('pending_review')}
          onClick={() => setTab('pending_review')}
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          tone="ok"
          label="Approved"
          value={count('approved')}
          onClick={() => setTab('approved')}
        />
        <StatCard
          icon={<XCircle className="size-5" />}
          tone="bad"
          label="Rejected"
          value={count('rejected')}
          onClick={() => setTab('rejected')}
        />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: `All (${rows.length})` },
              { id: 'pending_review', label: `Pending (${count('pending_review')})` },
              { id: 'approved', label: `Approved (${count('approved')})` },
              { id: 'rejected', label: `Rejected (${count('rejected')})` },
              { id: 'completed', label: `Checked out (${count('completed')})` },
            ]}
          />
          <label className="relative mb-4">
            <span className="sr-only">Search</span>
            <Search className="size-4 text-muted absolute left-3 top-3" aria-hidden />
            <Input
              placeholder="Search name, mobile, room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </label>
        </div>
        <Async state={st}>
          {() =>
            filtered.length === 0 ? (
              <Empty title="No admissions here" />
            ) : (
              <Table head={['Applicant', 'Room / Bed', 'Admission date', 'Rent', 'Requested', 'Status', 'Portal access', '']}>
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-subtle/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.residents.full_name} size={32} />
                        <div>
                          <p className="font-medium">{r.residents.full_name}</p>
                          <p className="text-[12px] text-muted">{r.residents.phone}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      Room {r.rooms.room_number}
                      <p className="text-[12px] text-muted">Bed {r.beds.bed_label} · {r.floors.name}</p>
                    </Td>
                    <Td>{fmtDate(r.admission_date)}</Td>
                    <Td className="tabular">{inr(r.monthly_rent)}</Td>
                    <Td className="text-muted">{fmtDateTime(r.created_at)}</Td>
                    <Td><Badge status={r.status}>{statusText(r.status)}</Badge></Td>
                    <Td>
                      {r.status === 'approved' ? (
                        r.residents.user_id ? (
                          <div className="flex items-center gap-2">
                            <Badge status="active">Access granted</Badge>
                            <button
                              onClick={() => {
                                setPortalTarget(r);
                                setPortalPassword(`Pass${(r.residents.phone || '1234').replace(/\D/g, '').slice(-4)}!`);
                                setPortalSuccess(null);
                              }}
                              className="text-xs text-brand-600 hover:text-brand-800 font-medium cursor-pointer underline"
                              title="Change resident password"
                            >
                              Password
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setPortalTarget(r);
                              setPortalPassword(`Pass${(r.residents.phone || '1234').replace(/\D/g, '').slice(-4)}!`);
                              setPortalSuccess(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 shadow-xs cursor-pointer transition-colors"
                          >
                            <KeyRound className="size-3.5" />
                            Grant Portal Access
                          </button>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => setOpenId(r.id)} aria-label={`View ${r.residents.full_name}`}>
                          <Eye className="size-4" />
                          View
                        </Button>
                        {r.status === 'approved' && !r.residents.user_id && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setPortalTarget(r);
                              setPortalPassword(`Pass${(r.residents.phone || '1234').replace(/\D/g, '').slice(-4)}!`);
                              setPortalSuccess(null);
                            }}
                            className="h-8 text-xs font-medium text-brand-700 hover:bg-brand-50"
                          >
                            <KeyRound className="size-3.5" />
                            Portal
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </Table>
            )
          }
        </Async>
      </Card>
      <AdmissionDrawer
        row={open}
        canApprove={staff?.role === 'owner'}
        onClose={() => setOpenId(null)}
        onDone={(msg) => {
          setToast(msg);
          st.reload();
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />

      {/* PORTAL ACCESS MODAL */}
      {portalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-xs" onClick={() => setPortalTarget(null)} aria-hidden />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-line p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h3 className="font-semibold text-base text-ink flex items-center gap-2">
                <KeyRound className="size-4 text-brand-600" />
                {portalSuccess ? 'Portal Credentials Saved' : `Grant Portal Access: ${portalTarget.residents.full_name}`}
              </h3>
              <button
                onClick={() => setPortalTarget(null)}
                className="p-1 rounded-lg hover:bg-subtle text-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {portalSuccess ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-ok-bg/50 border border-ok/30 space-y-2.5">
                  <div className="flex items-center gap-2 text-ok font-semibold text-xs">
                    <CheckCircle2 className="size-4" />
                    Authentication details live on Port 5000!
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-line font-mono text-xs space-y-1">
                    <div>Portal: <b>http://localhost:5000</b></div>
                    <div>Mobile (Login ID): <b>{portalSuccess.phone}</b></div>
                    <div>Password: <b className="text-brand-700">{portalSuccess.password}</b></div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Resident Portal Login: http://localhost:5000\nMobile: ${portalSuccess.phone}\nPassword: ${portalSuccess.password}`
                      );
                      setPortalSuccess({ ...portalSuccess, copied: true });
                    }}
                  >
                    {portalSuccess.copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {portalSuccess.copied ? 'Copied Details!' : 'Copy Login Details'}
                  </Button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hello ${portalSuccess.name}! Your resident portal access has been granted.\n\nLogin URL: http://localhost:5000\nMobile: ${portalSuccess.phone}\nPassword: ${portalSuccess.password}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Share2 className="size-4" />
                    WhatsApp
                  </a>
                </div>

                <div className="flex justify-end pt-2 border-t border-line">
                  <Button variant="ghost" size="sm" onClick={() => setPortalTarget(null)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  portalMutation.run();
                }}
                className="space-y-4 text-xs"
              >
                <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">Resident:</span>
                    <span className="font-semibold text-ink">{portalTarget.residents.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Mobile Login ID:</span>
                    <span className="font-semibold text-ink">{portalTarget.residents.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Room / Bed:</span>
                    <span className="font-semibold text-ink">Room {portalTarget.rooms.room_number} ({portalTarget.beds.bed_label})</span>
                  </div>
                </div>

                <Field label="Portal Login Password / PIN" required hint="Resident will sign in on Port 5000 using their mobile and this password">
                  {() => (
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={portalPassword}
                        onChange={(e) => setPortalPassword(e.target.value)}
                        required
                        className="h-9 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                          let code = '';
                          for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
                          setPortalPassword(`Zip@${code}`);
                        }}
                      >
                        Random
                      </Button>
                    </div>
                  )}
                </Field>

                <ErrorBanner error={portalMutation.error} />

                <div className="flex justify-end gap-2 pt-2 border-t border-line">
                  <Button type="button" variant="ghost" onClick={() => setPortalTarget(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" busy={portalMutation.busy} className="bg-brand-600 hover:bg-brand-700 text-white">
                    Save & Activate Portal
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
