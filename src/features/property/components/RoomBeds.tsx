/** Bed allocation panel for one room: occupant + checkout, pending admission, or "Admit resident". */
import { useNavigate } from 'react-router-dom';
import { LogOut as CheckoutIcon, Pencil, UserPlus, X } from 'lucide-react';
import { Badge, Button, Card } from '../../../components/ui';
import type { LayoutBed, LayoutRoom } from '../types';

export function RoomBeds({ room, onEdit, onClose, onCheckout }: {
  room: LayoutRoom;
  onEdit: () => void;
  onClose: () => void;
  onCheckout: (bed: LayoutBed) => void;
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
          <div key={b.bed_id} className="rounded-xl border border-line bg-subtle/50 p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[13px]">Bed {b.label}</span>
              <Badge tone={b.resident_id ? 'brand' : b.pending_admission ? 'warn' : 'ok'}>
                {b.resident_id ? 'Occupied' : b.pending_admission ? 'Pending approval' : 'Available'}
              </Badge>
            </div>
            {b.resident_id ? (
              <div className="flex items-end justify-between mt-4">
                <div>
                  <p className="font-medium">{b.resident_name}</p>
                  <p className="text-[12px] text-muted">Active resident</p>
                </div>
                <Button variant="danger" size="sm" onClick={() => onCheckout(b)}>
                  <CheckoutIcon className="size-4" />
                  Checkout
                </Button>
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
