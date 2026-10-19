/** Business + buildings application form (pre-filled when re-submitting after "changes requested"). */
import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useMutation } from '../../../lib/hooks';
import { Button, Card, ErrorBanner, Field, Input, Textarea } from '../../../components/ui';
import { PHONE_RE } from '../../../lib/validation';
import { submitOnboarding } from '../api';
import type { BuildingDraft, OnboardingRequest } from '../types';

const MAX_BUILDINGS = 20;
const blank = (): BuildingDraft => ({ name: '', address: '', city: '', floors: '', approx_beds: '' });

export function OnboardingForm({ initial, onDone }: { initial: OnboardingRequest | null; onDone: () => void }) {
  const [biz, setBiz] = useState(initial?.business_details.business_name ?? '');
  const [phone, setPhone] = useState(initial?.contact_details.phone ?? '');
  const [city, setCity] = useState(initial?.contact_details.city ?? '');
  const [notes, setNotes] = useState(initial?.business_details.notes ?? '');
  const [buildings, setBuildings] = useState<BuildingDraft[]>(
    initial?.business_details.buildings?.map((b) => ({
      ...blank(),
      ...b,
      floors: String(b.floors ?? ''),
      approx_beds: String(b.approx_beds ?? ''),
    })) ?? [blank()],
  );
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const m = useMutation(() =>
    submitOnboarding({
      businessName: biz,
      phone,
      city,
      notes: notes || null,
      buildings: buildings.map((b) => ({
        name: b.name.trim(),
        address: b.address.trim(),
        // A building without its own city inherits the business city.
        city: b.city.trim() || city,
        floors: b.floors ? Number(b.floors) : null,
        approx_beds: b.approx_beds ? Number(b.approx_beds) : null,
      })),
    }),
  );

  const set = (i: number, k: keyof BuildingDraft, v: string) => setBuildings((bs) => bs.map((b, j) => (j === i ? { ...b, [k]: v } : b)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (biz.trim().length < 2) fe.biz = 'Enter your business name';
    if (!PHONE_RE.test(phone.trim())) fe.phone = 'Enter a valid 10-digit phone number';
    buildings.forEach((b, i) => {
      if (b.name.trim().length < 2) fe[`b${i}`] = 'Building name is required';
    });
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    const r = await m.run();
    if (r !== undefined) onDone();
  };

  const addBuilding = buildings.length < MAX_BUILDINGS && (
    <Button type="button" variant="ghost" size="sm" onClick={() => setBuildings([...buildings, blank()])}>
      <Plus className="size-4" />
      Add building
    </Button>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Register your PG business</h1>
        <p className="text-[13px] text-muted mt-1">
          Tell us about your business and buildings. After approval you’ll set up floors, rooms and beds.
        </p>
      </div>
      <Card title="Business details">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Business name" required error={fieldErr.biz} className="sm:col-span-2">
            {(id) => <Input id={id} value={biz} onChange={(e) => setBiz(e.target.value)} />}
          </Field>
          <Field label="Phone number" required error={fieldErr.phone}>
            {(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91 98765 43210" />}
          </Field>
          <Field label="City">{(id) => <Input id={id} value={city} onChange={(e) => setCity(e.target.value)} />}</Field>
          <Field label="Anything else we should know?" className="sm:col-span-2">
            {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
        </div>
      </Card>
      <Card title={`Buildings (${buildings.length})`} action={addBuilding}>
        <div className="space-y-4">
          {buildings.map((b, i) => (
            <div key={i} className="rounded-lg border border-line p-4 grid sm:grid-cols-2 gap-3 relative">
              <Field label={`Building ${i + 1} name`} required error={fieldErr[`b${i}`]}>
                {(id) => <Input id={id} value={b.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder="e.g. A Block" />}
              </Field>
              <Field label="City">{(id) => <Input id={id} value={b.city} onChange={(e) => set(i, 'city', e.target.value)} />}</Field>
              <Field label="Address" className="sm:col-span-2">
                {(id) => <Input id={id} value={b.address} onChange={(e) => set(i, 'address', e.target.value)} />}
              </Field>
              <Field label="Number of floors">
                {(id) => <Input id={id} type="number" min={0} value={b.floors} onChange={(e) => set(i, 'floors', e.target.value)} />}
              </Field>
              <Field label="Approx. beds">
                {(id) => <Input id={id} type="number" min={0} value={b.approx_beds} onChange={(e) => set(i, 'approx_beds', e.target.value)} />}
              </Field>
              {buildings.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="sm:col-span-2 justify-self-start text-bad"
                  onClick={() => setBuildings(buildings.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>
      <ErrorBanner error={m.error} />
      <div className="flex justify-end">
        <Button type="submit" busy={m.busy}>Submit for approval</Button>
      </div>
    </form>
  );
}
