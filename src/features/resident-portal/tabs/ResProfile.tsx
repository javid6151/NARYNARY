/** Resident profile: stay details (read-only; corrections go through the PG office) and sign out. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { fmtDate, inr } from '../../../lib/format';
import { useAuth } from '../../access/useAuth';
import { Avatar, Button, Card } from '../../../components/ui';
import type { ResidentProfile } from '../types';
import { TopBar } from '../ui/Headers';

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between py-2 text-[13px]">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

export function ResProfile({ p }: { p: ResidentProfile }) {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <TopBar title="Profile" />
      <div className="flex items-center gap-4">
        <Avatar name={p.full_name} size={64} />
        <div>
          <p className="text-lg font-semibold">{p.full_name}</p>
          <p className="text-[13px] text-muted">{p.phone}</p>
        </div>
      </div>
      <Card title="My stay">
        <div className="divide-y divide-line">
          <Row k="PG" v={p.business_name} />
          <Row k="Building" v={p.building_name} />
          <Row k="Floor" v={p.floor_name} />
          <Row k="Room / bed" v={`${p.room_number} · ${p.bed_label}`} />
          <Row k="Sharing" v={`${p.sharing} sharing`} />
          <Row k="Check-in" v={fmtDate(p.admission_date)} />
          <Row k="Monthly rent" v={inr(p.monthly_rent)} />
          <Row k="Security deposit" v={inr(p.security_deposit)} />
          <Row k="Mess" v={p.mess_included ? 'Included' : 'Not included'} />
        </div>
      </Card>
      <Card title="Account">
        <div className="divide-y divide-line">
          <Row k="Email" v={p.email ?? '—'} />
        </div>
        <p className="text-[12px] text-muted mt-2">To correct your details, contact your PG office.</p>
      </Card>
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
