import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Check, ChevronDown, Clock, Plus } from 'lucide-react';
import { useBuilding } from '../features/access/useBuilding';
import { useAuth } from '../features/access/useAuth';
import { toSlug } from '../features/access/api';
import { Toast } from './ui';
import { BuildingRequestDrawer } from '../features/property/components/BuildingRequestDrawer';
import { listBuildingRequests } from '../features/property/api';
import type { BuildingRequest } from '../features/property/types';

/** Building selector. `allowAll` only on pages that aggregate across buildings. */
export function BuildingPicker({ allowAll = false }: { allowAll?: boolean }) {
  const { staff, isOwner: authIsOwner, access } = useAuth();
  const { tenantSlug: paramSlug, pgSlug: paramPgSlug } = useParams<{ tenantSlug?: string; pgSlug?: string }>();
  const nav = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Anyone on the owner portal, or with owner role, or platform admin has building request permissions
  const isOwner =
    authIsOwner ||
    staff?.role === 'owner' ||
    Boolean(access?.is_platform_admin) ||
    Boolean(access?.owned_tenant) ||
    (typeof window !== 'undefined' && window.location.pathname.includes('/owner'));

  const { buildings, selected, setSelected, buildingId, reload } = useBuilding();

  const [open, setOpen] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingReqs, setPendingReqs] = useState<BuildingRequest[]>([]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // If user has owner permissions, fetch any pending building requests awaiting Super Admin approval
  useEffect(() => {
    let live = true;
    listBuildingRequests()
      .then((reqs) => {
        if (live) setPendingReqs(reqs.filter((r) => r.status === 'pending_approval'));
      })
      .catch(() => {
        if (live) setPendingReqs([]);
      });
    return () => {
      live = false;
    };
  }, [isOwner, buildings]);

  // Non-owners with 1 or fewer buildings without allowAll don't need a picker
  if (buildings.length <= 1 && !allowAll && !isOwner) return null;

  const currentBuildingId = allowAll ? selected : (buildingId ?? selected);
  const activeBuilding = buildings.find((b) => b.id === currentBuildingId);
  const displayLabel = allowAll && selected === 'all'
    ? 'All buildings'
    : (activeBuilding?.name ?? 'Select building');

  const handleSelect = (v: string) => {
    setOpen(false);
    setSelected(v);
    if (paramSlug && paramPgSlug && v !== 'all') {
      const chosen = buildings.find((b) => b.id === v);
      if (chosen) {
        const newPg = toSlug(chosen.name);
        const loc = window.location.pathname;
        const rolePart = loc.includes('/manager') ? 'manager' : 'owner';
        const subPath = loc.replace(new RegExp(`^/${paramSlug}/${paramPgSlug}/${rolePart}`), '');
        nav(`/${paramSlug}/${newPg}/${rolePart}${subPath}`);
      }
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Custom Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 h-9 px-3.5 rounded-full bg-[#FFFEFC] hover:bg-[#ECE5DA] border border-[#DED6CB] shadow-2xs text-[#30271F] text-xs font-semibold cursor-pointer transition-all duration-150 focus:outline-hidden"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Building2 className="size-3.5 text-[#343B2B] shrink-0" aria-hidden />
        <span className="truncate max-w-[150px] sm:max-w-[200px]">{displayLabel}</span>
        <ChevronDown
          className={`size-3.5 text-[#77736B] shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {/* Custom Dropdown Menu */}
      {open && (
        <div className="absolute left-0 mt-1.5 w-60 rounded-2xl bg-[#FFFEFC] border border-[#DED6CB] shadow-lg p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-[#77736B]">
            Buildings ({buildings.length})
          </div>

          <div className="space-y-0.5 max-h-64 overflow-y-auto owner-scrollbar">
            {allowAll && buildings.length > 1 && (
              <button
                type="button"
                onClick={() => handleSelect('all')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                  selected === 'all'
                    ? 'bg-[#EBF0E6] text-[#343B2B] font-semibold'
                    : 'text-[#30271F] hover:bg-[#ECE5DA]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="size-3.5 text-[#343B2B]" />
                  <span>All buildings</span>
                </span>
                {selected === 'all' && <Check className="size-3.5 text-[#343B2B] shrink-0" />}
              </button>
            )}

            {buildings.map((b) => {
              const isCurrent = currentBuildingId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelect(b.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isCurrent
                      ? 'bg-[#EBF0E6] text-[#343B2B] font-semibold'
                      : 'text-[#30271F] hover:bg-[#ECE5DA]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate pr-2">
                    <span className={`size-1.5 rounded-full shrink-0 ${isCurrent ? 'bg-[#343B2B]' : 'bg-[#DED6CB]'}`} />
                    <span className="truncate">{b.name}</span>
                  </span>
                  {isCurrent && <Check className="size-3.5 text-[#343B2B] shrink-0" />}
                </button>
              );
            })}

            {/* Pending Requests */}
            {pendingReqs.length > 0 && (
              <div className="pt-1 mt-1 border-t border-[#DED6CB]">
                <div className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-[#77736B]">
                  Pending Approval
                </div>
                {pendingReqs.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-[#77736B] rounded-lg bg-[#FAF6F0]"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Clock className="size-3 text-[#B9674B] shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-[#FFFEFC] border border-[#DED6CB] rounded text-[#77736B] shrink-0">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Request a New Building Action */}
          <div className="pt-1.5 mt-1 border-t border-[#DED6CB]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowDrawer(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#30271F] hover:text-[#343B2B] hover:bg-[#EBF0E6] rounded-xl transition-all cursor-pointer text-left group"
            >
              <div className="size-6 rounded-lg bg-[#343B2B] text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <Plus className="size-3.5 stroke-[3]" />
              </div>
              <span className="font-semibold text-xs">Request a new building…</span>
            </button>
          </div>
        </div>
      )}

      {/* Request New Building Drawer */}
      <BuildingRequestDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSaved={(buildingName) => {
          setShowDrawer(false);
          setToast(`Building request for "${buildingName}" sent to Super Admin for approval!`);
          reload();
          listBuildingRequests()
            .then((reqs) => {
              setPendingReqs(reqs.filter((r) => r.status === 'pending_approval'));
            })
            .catch(() => {});
        }}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
