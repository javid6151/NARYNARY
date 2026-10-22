/** Owner requests an additional building; ZIPCO Super Admin approves it before rooms and residents can be added. */
import { useState } from 'react';
import { useMutation } from '../../../lib/hooks';
import { Button, Drawer, ErrorBanner, Field, Input, Textarea } from '../../../components/ui';
import { requestBuilding } from '../api';
import { Sparkles } from 'lucide-react';

const EMPTY = { name: '', address: '', city: '', floors: '', approxBeds: '', notes: '' };

export function BuildingRequestDrawer({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (buildingName: string) => void;
}) {
  const [f, setF] = useState(EMPTY);
  const m = useMutation(() =>
    requestBuilding({
      name: f.name.trim(),
      address: f.address.trim(),
      city: f.city.trim(),
      floors: Number(f.floors) || null,
      approxBeds: Number(f.approxBeds) || null,
      notes: f.notes.trim() || null,
    })
  );

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button
        busy={m.busy}
        disabled={f.name.trim().length < 2}
        onClick={async () => {
          const nameSubmitted = f.name.trim();
          if ((await m.run()) !== undefined) {
            setF(EMPTY);
            onSaved(nameSubmitted);
          }
        }}
      >
        Submit Request for Approval
      </Button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Request a New Building" footer={footer}>
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-200/80 text-xs text-brand-900 flex items-start gap-2.5">
          <Sparkles className="size-4 text-brand-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <p className="font-semibold text-brand-950">Super Admin Approval Workflow</p>
            <p className="text-brand-800 mt-0.5">
              When you submit this request, it is sent to the ZIPCO Super Admin queue. Once reviewed and approved by Super Admin, the new building will be automatically added to your portal.
            </p>
          </div>
        </div>

        <ErrorBanner error={m.error} />

        <Field label="Building Name" required hint="e.g. YVR Luxury Block B, Annexe Wing">
          {(id) => (
            <Input
              id={id}
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="e.g. Block B"
              required
            />
          )}
        </Field>

        <Field label="Address">
          {(id) => (
            <Input
              id={id}
              value={f.address}
              onChange={(e) => setF({ ...f, address: e.target.value })}
              placeholder="e.g. Plot 42, Hitech City Main Road"
            />
          )}
        </Field>

        <Field label="City">
          {(id) => (
            <Input
              id={id}
              value={f.city}
              onChange={(e) => setF({ ...f, city: e.target.value })}
              placeholder="e.g. Hyderabad"
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Number of Floors">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                value={f.floors}
                onChange={(e) => setF({ ...f, floors: e.target.value })}
                placeholder="e.g. 4"
              />
            )}
          </Field>

          <Field label="Approximate Beds">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                value={f.approxBeds}
                onChange={(e) => setF({ ...f, approxBeds: e.target.value })}
                placeholder="e.g. 60"
              />
            )}
          </Field>
        </div>

        <Field label="Notes for Super Admin (Optional)" hint="Any extra details regarding this new building">
          {(id) => (
            <Textarea
              id={id}
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              placeholder="e.g. Opening next month for working professionals"
              rows={3}
            />
          )}
        </Field>
      </div>
    </Drawer>
  );
}
