/** Resident profile: stay details (read-only; corrections go through the PG office) and sign out. */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, HelpCircle, LogOut, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { fmtDate, inr } from '../../../lib/format';
import { useAuth } from '../../access/useAuth';
import { Avatar, Button } from '../../../components/ui';
import { PgLogo } from '../../../components/PgLogo';
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
      <section className="resident-profile-hero -mt-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-6 pb-8 mb-4">
        <div className="relative z-10 flex items-center gap-3.5">
          <span className="resident-profile-avatar rounded-full shrink-0">
            <Avatar name={p.full_name} size={60} />
          </span>
          <div className="min-w-0">
            <p className="text-[22px] leading-tight font-bold text-[#30271F] truncate">{p.full_name}</p>
            <p className="text-[13px] text-[#5C554B] flex items-center gap-1 mt-1 truncate">
              <MapPin className="size-3.5 shrink-0 text-[#77736B]" />
              {p.building_name} · {p.business_name}
            </p>
            <p className="text-[12px] font-semibold text-[#2F6B27] flex items-center gap-1.5 mt-2">
              <span className="resident-status-dot" aria-hidden />Active resident
            </p>
          </div>
        </div>
      </section>

      {/* Specific PG Hostel Info & Contact Details */}
      <section className="resident-profile-card p-4 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-[#EAE3D7]">
          <div className="flex items-center gap-2.5 min-w-0">
            <PgLogo tenantId={p.tenant_id} logoUrl={p.logo_url} name={p.business_name} size="md" />
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-[#30271F] leading-tight truncate">
                {p.business_name}
              </h2>
              <p className="text-[12px] text-[#77736B] truncate">
                {p.building_name}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#EBF0E6] text-[#343B2B] border border-[#CAD7BF] shrink-0">
            Hostel Office
          </span>
        </div>

        {p.building_address && (
          <div className="flex items-start gap-2 text-[12.5px] text-[#5C554B] pt-0.5">
            <MapPin className="size-4 shrink-0 text-[#77736B] mt-0.5" />
            <span className="leading-snug">{p.building_address}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {p.pg_phone ? (
            <a
              href={`tel:${p.pg_phone}`}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F5F0E8] hover:bg-[#EAE3D7] border border-[#DED6CB] text-[12.5px] font-medium text-[#30271F] transition-colors"
            >
              <span className="size-7 rounded-lg bg-[#343B2B] text-white grid place-items-center shrink-0">
                <Phone className="size-3.5" />
              </span>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-[#77736B] font-semibold">PG Helpline</span>
                <span className="truncate block font-semibold">{p.pg_phone}</span>
              </div>
            </a>
          ) : (
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F5F0E8] border border-[#DED6CB] text-[12.5px] text-[#77736B]">
              <span className="size-7 rounded-lg bg-[#EAE3D7] text-[#77736B] grid place-items-center shrink-0">
                <Phone className="size-3.5" />
              </span>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-[#77736B] font-semibold">PG Helpline</span>
                <span className="truncate block">Contact PG Manager</span>
              </div>
            </div>
          )}

          {p.pg_email ? (
            <a
              href={`mailto:${p.pg_email}`}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F5F0E8] hover:bg-[#EAE3D7] border border-[#DED6CB] text-[12.5px] font-medium text-[#30271F] transition-colors"
            >
              <span className="size-7 rounded-lg bg-[#343B2B] text-white grid place-items-center shrink-0">
                <Mail className="size-3.5" />
              </span>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-[#77736B] font-semibold">PG Email</span>
                <span className="truncate block font-semibold">{p.pg_email}</span>
              </div>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => nav('../complaints')}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F5F0E8] hover:bg-[#EAE3D7] border border-[#DED6CB] text-[12.5px] font-medium text-[#30271F] transition-colors text-left cursor-pointer"
            >
              <span className="size-7 rounded-lg bg-[#343B2B] text-white grid place-items-center shrink-0">
                <HelpCircle className="size-3.5" />
              </span>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-[#77736B] font-semibold">Helpdesk</span>
                <span className="truncate block font-semibold">Raise Complaint</span>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* Stay details */}
      <section className="resident-profile-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="resident-notice-icon size-8 rounded-lg grid place-items-center"><Building2 className="size-4" /></span>
          <div>
            <p className="resident-section-eyebrow">Your room &amp; stay</p>
            <h2 className="text-[16px] font-semibold">Stay details</h2>
          </div>
        </div>
        <div className="mt-2">
          <Row k="Resident Unique ID" v={<span className="font-mono font-bold text-[#30271F] bg-[#EBF0E6] px-2 py-0.5 rounded border border-[#CAD7BF]">{p.resident_code || ('RES-' + String(p.resident_id).replace(/-/g, '').slice(0, 6).toUpperCase())}</span>} />
          <Row k="PG / Hostel" v={<span className="font-semibold text-[#30271F]">{p.business_name}</span>} />
          <Row k="Building" v={p.building_name} />
          <Row k="Floor" v={p.floor_name} />
          <Row k="Room / Bed" v={`${p.room_number} · Bed ${p.bed_label}`} />
          <Row k="Sharing" v={`${p.sharing} sharing`} />
          <Row k="Check-in" v={fmtDate(p.admission_date)} />
          <Row k="Monthly rent" v={<span className="font-semibold text-[#30271F]">{inr(p.monthly_rent)}</span>} />
          <Row k="Security deposit" v={inr(p.security_deposit)} />
          <Row k="Mess / Meals" v={p.mess_included ? 'Included' : 'Not included'} />
        </div>
      </section>

      {/* Account details */}
      <section className="resident-profile-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="resident-notice-icon size-8 rounded-lg grid place-items-center"><ShieldCheck className="size-4" /></span>
          <div>
            <p className="resident-section-eyebrow">Resident account</p>
            <h2 className="text-[16px] font-semibold">Account details</h2>
          </div>
        </div>
        <div>
          <Row k="Resident Unique ID" v={<span className="font-mono font-bold text-[#30271F]">{p.resident_code || ('RES-' + String(p.resident_id).replace(/-/g, '').slice(0, 6).toUpperCase())}</span>} />
          <Row k="Full name" v={p.full_name} />
          <Row k="Mobile" v={p.phone || '—'} />
          <Row k="Email" v={p.email || '—'} />
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
