/** Bed allocation panel for one room: occupant + checkout, pending admission, or "Admit resident". */
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ChevronRight, LogOut as CheckoutIcon, Pencil, UserPlus, X } from 'lucide-react';
import { Avatar, Badge, Button, Card } from '../../../components/ui';
import { cx } from '../../../lib/cx';
import type { LayoutBed, LayoutRoom } from '../types';

export function RoomBeds({
  room,
  onEdit,
  onClose,
  onCheckout,
  onSelectResident,
  onTransfer,
}: {
  room: LayoutRoom;
  onEdit: () => void;
  onClose: () => void;
  onCheckout: (bed: LayoutBed) => void;
  onSelectResident?: (residentId: string) => void;
  onTransfer?: (bed: LayoutBed) => void;
}) {
  const nav = useNavigate();
  const actions = (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="size-4" />
        Edit room
      </Button>
      <button onClick={onClose} aria-label="Close room details" className="p-1.5 rounded-md hover:bg-subtle cursor-pointer">
        <X className="size-4" />
      </button>
    </div>
  );

  return (
    <Card title={`Room ${room.room_number} — bed allocation`} action={actions}>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {room.beds.map((b) => (
          <div
            key={b.bed_id}
            onClick={() => {
              if (b.resident_id && onSelectResident) {
                onSelectResident(b.resident_id);
              }
            }}
            className={cx(
              'rounded-xl border border-line bg-subtle/50 p-4 transition-all',
              b.resident_id && onSelectResident && 'cursor-pointer hover:border-[#CAD7BF] hover:shadow-xs hover:bg-[#FFFEFC]',
            )}
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[13px]">Bed {b.label}</span>
              <Badge tone={b.resident_id ? 'brand' : b.pending_admission ? 'warn' : 'ok'}>
                {b.resident_id ? 'Occupied' : b.pending_admission ? 'Pending approval' : 'Available'}
              </Badge>
            </div>
            {b.resident_id ? (
              <div className="flex items-center justify-between gap-2.5 mt-4 pt-3 border-t border-line/60">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (b.resident_id && onSelectResident) {
                      onSelectResident(b.resident_id);
                    }
                  }}
                  className="flex items-center gap-2.5 text-left group cursor-pointer hover:opacity-90 p-1 -m-1 rounded-xl transition-all min-w-0 flex-1 focus:outline-none"
                  title={`View resident details for ${b.resident_name ?? 'Resident'}`}
                >
                  <div className="relative shrink-0">
                    <Avatar name={b.resident_name ?? 'Resident'} size={38} />
                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[#4A5D3E] ring-2 ring-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-[#30271F] group-hover:text-[#343B2B] truncate flex items-center gap-1">
                      <span className="truncate">{b.resident_name}</span>
                      <ChevronRight className="size-3.5 text-[#77736B] group-hover:text-[#343B2B] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </p>
                    <p className="text-[11.5px] text-[#77736B] group-hover:text-[#343B2B]/80 transition-colors">
                      Active resident · <span className="underline decoration-dotted underline-offset-2">View details</span>
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onTransfer && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTransfer(b);
                      }}
                      title="Move to vacant bed or swap beds"
                      className="shrink-0"
                    >
                      <ArrowLeftRight className="size-3.5 text-amber-700" />
                      Swap
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCheckout(b);
                    }}
                    className="shrink-0"
                  >
                    <CheckoutIcon className="size-3.5" />
                    Checkout
                  </Button>
                </div>
              </div>
            ) : b.pending_admission ? (
              <Button variant="secondary" size="sm" className="w-full mt-4" onClick={() => nav('../residents')}>
                View resident
              </Button>
            ) : (
              <Button size="sm" className="w-full mt-4" onClick={() => nav(`../residents/new?bed=${b.bed_id}`)}>
                <UserPlus className="size-4" />
                Admit resident
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
