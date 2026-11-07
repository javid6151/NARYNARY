/** Shown on a per-portal port when the signed-in user belongs to another portal; links to the right port. */
import { useAuth } from '../features/access/useAuth';
import { supabase } from '../lib/supabase';
import { Button, Card } from '../components/ui';
import { Logo } from '../components/Logo';
import { CURRENT_PORTAL, PORTALS, portalUrl, type PortalId } from '../lib/portals';

export function WrongPortal({ portal }: { portal: PortalId }) {
  const { signOut } = useAuth();
  const target = PORTALS.find((p) => p.id === portal) ?? PORTALS[0];

  const handleSwitch = async () => {
    const url = portalUrl(portal);
    try {
      const sessionRes = await supabase.auth.getSession();
      const s = sessionRes.data.session;
      const tokens = s?.access_token ? `#access_token=${s.access_token}&refresh_token=${s.refresh_token}` : '';
      window.location.href = `${url}${tokens}`;
    } catch {
      window.location.href = url;
    }
  };

  return (
    <div className="max-w-md mx-auto pt-24 px-4 space-y-4">
      <Logo subtitle={`${CURRENT_PORTAL?.label ?? 'Current'} Portal`} />
      <Card>
        <h1 className="text-lg font-semibold text-[#30271F]">This is the {CURRENT_PORTAL?.label ?? 'Dedicated'} Portal</h1>
        <p className="text-[13px] text-[#77736B] mt-1">
          Your account uses the <strong>{target.label} Portal</strong>. You can switch to your dedicated portal below.
        </p>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSwitch}>Open {target.label} Portal →</Button>
          <Button variant="secondary" onClick={() => signOut()}>Sign Out</Button>
        </div>
      </Card>
    </div>
  );
}
