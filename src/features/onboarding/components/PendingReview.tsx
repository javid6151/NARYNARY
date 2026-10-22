/**
 * "Approval Sent / Under Review" screen with clear 24-hr verification notice,
 * submitted business summary, and real-time live auto-unlock listener.
 */
import { useEffect, useState } from 'react';
import {
  Clock, RefreshCw, CheckCircle2, Sparkles, Building2, MapPin,
  Phone, ShieldCheck, ArrowRight, Hourglass, Check
} from 'lucide-react';
import { fmtDateTime } from '../../../lib/format';
import { Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import type { OnboardingRequest } from '../types';

export function PendingReview({
  req,
  tenantCode,
  onRefresh,
}: {
  req: OnboardingRequest;
  /** The business's unique ID, assigned when the application was submitted. */
  tenantCode?: string;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [approvedTransition, setApprovedTransition] = useState(false);

  // Live real-time auto-detection: Polls every 3s and subscribes to Supabase Realtime updates
  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      if (!active) return;
      try {
        await onRefresh();
        setLastChecked(new Date());
      } catch (err) {
        console.warn('Live status check non-fatal:', err);
      }
    };

    // 1. Supabase Postgres Realtime broadcast listener
    const channel = supabase
      .channel(`onboarding-watch-${req.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          ...(req.tenant_id ? { filter: `id=eq.${req.tenant_id}` } : {}),
        },
        async (payload) => {
          if ((payload.new as any)?.status === 'active') {
            setApprovedTransition(true);
            await checkStatus();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenant_onboarding_requests',
          filter: `id=eq.${req.id}`,
        },
        async (payload) => {
          if ((payload.new as any)?.status === 'approved') {
            setApprovedTransition(true);
            await checkStatus();
          }
        }
      )
      .subscribe();

    // 2. Active background heartbeat polling (every 3 seconds) for live instant unlock
    const interval = setInterval(checkStatus, 3000);

    return () => {
      active = false;
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [req.id, req.tenant_id, onRefresh]);

  const handleManualRefresh = async () => {
    setBusy(true);
    await onRefresh();
    setLastChecked(new Date());
    setBusy(false);
  };

  const buildings = req.business_details.buildings ?? [];

  return (
    <div className="space-y-6">
      {/* Live Approval Transition Banner */}
      {approvedTransition && (
        <div className="rounded-2xl bg-ok text-white p-5 shadow-lg flex items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-white shrink-0" />
            <div>
              <p className="font-bold text-base">Application Approved by Super Admin!</p>
              <p className="text-xs text-white/90">Unlocking and loading your Owner Portal live now...</p>
            </div>
          </div>
          <ArrowRight className="size-5 text-white" />
        </div>
      )}

      {/* Main Approval Notice Card */}
      <div className="bg-white rounded-2xl border border-line shadow-md p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-brand-500 to-purple-600" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
              <Hourglass className="size-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  Verification Pending
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight mt-0.5">
                Your Approval Request Has Been Sent!
              </h1>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="text-xs gap-1.5 h-9 shrink-0 cursor-pointer"
            busy={busy}
            onClick={handleManualRefresh}
          >
            <RefreshCw className={`size-3.5 ${busy ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </Button>
        </div>

        {/* 24-Hour Notice Banner */}
        <div className="my-6 p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 flex items-start gap-3">
          <Clock className="size-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-[13.5px] leading-relaxed">
            <p className="font-semibold text-amber-900">
              Your application will be verified soon, mostly within 24 hours.
            </p>
            <p className="text-amber-800 mt-1">
              ZIPCO Super Admin is reviewing your business details and verifying your PG setup. As soon as approved, your entire Owner Portal and buildings will be unlocked immediately.
            </p>
          </div>
        </div>

        {/* Real-Time Live Auto-Unlock Notification */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-200/70 flex items-start gap-3">
          <Sparkles className="size-5 text-brand-700 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-[13px] text-ink leading-relaxed">
            <p className="font-bold text-brand-900">Live Auto-Unlock Active</p>
            <p className="text-muted mt-0.5">
              This screen is listening live in real-time. Whenever the Super Admin approves your application in the platform, this page will automatically unlock and redirect to your portal with zero manual refreshes required.
            </p>
          </div>
        </div>

        {/* Progress Timeline */}
        <div className="py-4 border-y border-line">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Onboarding Progress</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-canvas border border-line">
              <div className="size-8 rounded-full bg-ok text-white flex items-center justify-center shrink-0">
                <Check className="size-4 stroke-[3]" />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">1. Submitted</p>
                <p className="text-[11px] text-muted">PG details recorded</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-300">
              <div className="size-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Clock className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900">2. Super Admin Verification</p>
                <p className="text-[11px] text-amber-700 font-medium">In review (within 24h)</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-canvas border border-line opacity-60">
              <div className="size-8 rounded-full bg-subtle text-muted flex items-center justify-center shrink-0">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">3. Owner Portal Live</p>
                <p className="text-[11px] text-muted">Ready on approval</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submitted Business Summary */}
        <div className="mt-6 pt-2">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Submitted Application Details</p>
          <div className="grid sm:grid-cols-2 gap-4 text-xs sm:text-[13px]">
            <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1">
              <p className="text-muted">Business Name</p>
              <p className="text-sm font-bold text-ink">{req.business_details.business_name}</p>
            </div>

            {tenantCode && (
              <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1">
                <p className="text-muted">Business Reference ID</p>
                <p className="text-sm font-mono font-bold text-brand-700">{tenantCode}</p>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1">
              <p className="text-muted flex items-center gap-1.5">
                <Phone className="size-3.5" />
                <span>Contact Phone</span>
              </p>
              <p className="font-semibold text-ink">{req.contact_details.phone || '—'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1">
              <p className="text-muted flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                <span>City</span>
              </p>
              <p className="font-semibold text-ink">{req.contact_details.city || '—'}</p>
            </div>

            <div className="sm:col-span-2 p-3.5 rounded-xl bg-canvas border border-line space-y-2">
              <p className="text-muted flex items-center gap-1.5">
                <Building2 className="size-3.5" />
                <span>Requested Buildings ({buildings.length})</span>
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {buildings.map((b, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-line text-xs font-medium text-ink shadow-xs"
                  >
                    <Building2 className="size-3 text-brand-600" />
                    <span>{b.name}</span>
                    {b.floors && <span className="text-muted">({b.floors} floors)</span>}
                    {b.approx_beds && <span className="text-muted">· {b.approx_beds} beds</span>}
                  </span>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 text-right text-[11.5px] text-muted pt-1">
              Submitted on {fmtDateTime(req.created_at)} · Last checked: {lastChecked.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
