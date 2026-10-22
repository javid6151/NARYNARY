/**
 * Screen displayed when a resident's portal access has been suspended or blocked by management.
 */
import { Ban, LogOut } from 'lucide-react';
import { useAuth } from '../features/access/useAuth';
import { Button } from './ui';
import { Logo } from './Logo';

export function AccountSuspended() {
  const { signOut, session } = useAuth();

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 selection:bg-bad/20">
      <div className="w-full max-w-md bg-white border border-line rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-5">
        <div className="flex justify-center">
          <Logo subtitle="Resident Portal" />
        </div>

        <div className="size-16 rounded-2xl bg-bad/10 text-bad flex items-center justify-center mx-auto border border-bad/20">
          <Ban className="size-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-ink">Portal Access Suspended</h1>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Your resident account access has been suspended by PG management. You cannot access your stay details, rent dues, food menu, or submit requests while your status is suspended.
          </p>
        </div>

        <div className="bg-canvas border border-line rounded-xl p-3 text-left space-y-1.5 text-xs">
          <div className="text-muted flex justify-between">
            <span>Account:</span>
            <span className="font-semibold text-ink">{session?.user?.email || 'Resident Account'}</span>
          </div>
          <div className="text-muted flex justify-between">
            <span>Access Status:</span>
            <span className="font-semibold text-bad">Suspended / Blocked</span>
          </div>
        </div>

        <p className="text-xs text-muted">
          If you believe this was done in error or to settle pending formalities, please contact your hostel warden or PG management.
        </p>

        <div className="pt-2">
          <Button
            variant="secondary"
            className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            onClick={async () => {
              await signOut();
              localStorage.clear();
              window.location.href = '/';
            }}
          >
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
