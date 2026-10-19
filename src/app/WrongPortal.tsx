/** Shown on a per-portal port when the signed-in user belongs to another portal; links to the right port. */
import { useAuth } from '../features/access/useAuth';
import { Button, Card } from '../components/ui';
import { Logo } from '../components/Logo';
import { CURRENT_PORTAL, PORTALS, portalUrl, type PortalId } from '../lib/portals';

export function WrongPortal({ portal }: { portal: PortalId }) {
  const { signOut } = useAuth();
  const target = PORTALS.find((p) => p.id === portal)!;
  return (
    <div className="max-w-md mx-auto pt-24 px-4 space-y-4">
      <Logo subtitle={`${CURRENT_PORTAL?.label} portal`} />
      <Card>
        <h1 className="text-lg font-semibold">This is the {CURRENT_PORTAL?.label} portal</h1>
        <p className="text-[13px] text-ink-2 mt-1">
          Your account uses the {target.label} portal on port {target.port}. Each port keeps its own sign-in, so you’ll sign in again there.
        </p>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => window.location.assign(portalUrl(portal))}>Open {target.label} portal</Button>
          <Button variant="secondary" onClick={() => signOut()}>Sign out</Button>
        </div>
      </Card>
    </div>
  );
}
