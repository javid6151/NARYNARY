/**
 * Restricted onboarding workspace for signed-in users without a membership.
 * Shows the application form, its review status (pending / changes requested / rejected),
 * and a hint for residents and staff who should ask their PG instead of applying.
 * Leaves for the user's portal as soon as their access changes.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LogOut, XCircle } from 'lucide-react';
import { useAsync } from '../../lib/hooks';
import { useAuth } from '../access/useAuth';
import { Button, Card, Loading } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { getLatestOnboardingRequest } from './api';
import { JoinHint } from './components/JoinHint';
import { OnboardingForm } from './components/OnboardingForm';
import { PendingReview } from './components/PendingReview';

export default function Onboarding() {
  const { access, refreshAccess, homePath, signOut } = useAuth();
  const nav = useNavigate();
  const req = useAsync(() => getLatestOnboardingRequest(), [access?.owned_tenant?.status]);

  useEffect(() => {
    if (homePath !== '/onboarding') nav(homePath, { replace: true });
  }, [homePath, nav]);

  const status = access?.owned_tenant?.status;
  const [editing, setEditing] = useState(false);
  const isPending =
    (status === 'pending' || req.data?.status === 'submitted' || req.data?.status === 'under_review') &&
    status !== 'active' &&
    !editing;

  return (
    <div className="min-h-full bg-canvas">
      <header className="h-16 bg-white border-b border-line flex items-center justify-between px-6">
        <Logo subtitle="Owner onboarding" />
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut();
            nav('/');
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </header>
      <main className="max-w-3xl mx-auto p-4 sm:p-8 space-y-5">
        {req.loading && !req.data ? (
          <Loading />
        ) : (
          <>
            {isPending && req.data && (
              <PendingReview
                req={req.data}
                tenantCode={access?.owned_tenant?.tenant_code}
                onRefresh={async () => {
                  await refreshAccess();
                  req.reload();
                }}
              />
            )}
            {status === 'rejected' && (
              <Card>
                <div className="flex gap-3">
                  <XCircle className="size-6 text-bad shrink-0" />
                  <div>
                    <h1 className="font-semibold text-lg">Application not approved</h1>
                    <p className="text-[13px] text-ink-2 mt-1">{req.data?.review_notes ?? 'Please contact ZIPCO support for details.'}</p>
                  </div>
                </div>
              </Card>
            )}
            {(!status || status === 'changes_requested' || editing) && (
              <>
                {status === 'changes_requested' && (
                  <div className="flex gap-2 rounded-xl border border-warn/30 bg-warn-bg p-4 text-[13px] text-warn">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <b>Changes requested:</b> {req.data?.review_notes ?? 'Please review your details.'}
                    </div>
                  </div>
                )}
                {!status && <JoinHint onRefresh={refreshAccess} />}
                <OnboardingForm
                  initial={req.data}
                  onDone={async () => {
                    setEditing(false);
                    await refreshAccess();
                    req.reload();
                  }}
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
