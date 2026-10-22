/** Resident profile: stay details (read-only; corrections go through the PG office) and sign out. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, LogOut, MapPin, ShieldCheck } from 'lucide-react';
import { fmtDate, inr } from '../../../lib/format';
import { useAuth } from '../../access/useAuth';
import { Avatar, Button } from '../../../components/ui';
import type { ResidentProfile } from '../types';
import { TopBar } from '../ui/Headers';

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="resident-profile-row flex justify-between gap-4 py-3 text-[13px]">
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
      <section className="resident-profile-hero -mt-2">
        <div className="flex items-center gap-3">
          <span className="resident-profile-avatar rounded-full shrink-0">
            <Avatar name={p.full_name} size={60} />
          </span>
          <div className="min-w-0">
            <p className="text-[21px] leading-tight font-semibold truncate">{p.full_name}</p>
            <p className="text-[13px] text-white/75 flex items-center gap-1 mt-1 truncate"><MapPin className="size-3.5 shrink-0" />{p.building_name}</p>
            <p className="text-[12px] font-medium flex items-center gap-1.5 mt-2"><span className="resident-status-dot" aria-hidden />Active resident</p>
          </div>
        </div>
      </section>
      <section className="resident-profile-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="resident-notice-icon size-8 rounded-lg grid place-items-center"><Building2 className="size-4" /></span>
          <div>
            <p className="resident-section-eyebrow">Your home</p>
            <h2 className="text-[16px] font-semibold">Stay details</h2>
          </div>
        </div>
        <div className="mt-2">
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
      </section>
      <section className="resident-profile-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="resident-notice-icon size-8 rounded-lg grid place-items-center"><ShieldCheck className="size-4" /></span>
          <div>
            <p className="resident-section-eyebrow">Private account</p>
            <h2 className="text-[16px] font-semibold">Account details</h2>
          </div>
        </div>
        <div>
          <Row k="Email" v={p.email ?? '—'} />
        </div>
        <p className="text-[12px] text-muted mt-2">To correct your details, contact your PG office.</p>
      </section>
      <Button
        variant="secondary"
        className="resident-logout w-full"
        onClick={async () => {
          await signOut();
          nav('/');
        }}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </>
  );
}
