/**
 * New admission wizard (owner/manager): bed → resident details → KYC → charges → review.
 *
 * On submit, `create_admission` creates the resident and a pending admission that holds the bed,
 * then any chosen KYC files are uploaded. The idempotency key is fixed for the life of the form,
 * so "Submit again" after a failed upload reuses the same admission and uploads only the remaining files.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { ApiError, newKey } from '../../lib/api';
import { useAsync, useMutation } from '../../lib/hooks';
import { isoDate } from '../../lib/format';
import { useBuilding } from '../access/useBuilding';
import { Async, Button, Card, PageHeader } from '../../components/ui';
import { BuildingPicker } from '../../components/BuildingPicker';
import { SectionPromoBanner } from '../../components/SectionPromoBanner';
import { uploadFile } from '../files/api';
import { fileError } from '../files/rules';
import { getBuildingLayout } from '../property/api';
import type { LayoutFloor } from '../property/types';
import { autoApproveAdmission, createAdmission, getAdmissionResidentId } from './api';
import type { PendingDoc, ResidentForm, TermsForm } from './types';
import { EMAIL_RE, ID_LAST4_RE, PHONE_RE } from '../../lib/validation';
import { BedStep } from './new-admission/BedStep';
import { DetailsStep } from './new-admission/DetailsStep';
import { KycStep } from './new-admission/KycStep';
import { ReviewStep } from './new-admission/ReviewStep';
import { StepIndicator } from './new-admission/StepIndicator';
import { TermsStep } from './new-admission/TermsStep';

const STEPS = ['Room & bed', 'Resident details', 'KYC', 'Charges', 'Review & submit'];
const MAX_DOCS = 10;

export default function NewAdmission() {
  const { buildingId, building } = useBuilding();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const layout = useAsync(
    () => (buildingId ? getBuildingLayout(buildingId) : Promise.resolve([] as LayoutFloor[])),
    [buildingId],
  );
  const [step, setStep] = useState(0);
  const [bedId, setBedId] = useState(params.get('bed') ?? '');
  const [floorId, setFloorId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [res, setRes] = useState<ResidentForm>({
    full_name: '',
    phone: '',
    email: '',
    gender: '',
    date_of_birth: '',
    occupation: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    id_type: 'aadhaar',
    id_number_last4: '',
    portal_password: '',
  });
  const [terms, setTerms] = useState<TermsForm>({
    admission_date: isoDate(),
    monthly_rent: '',
    security_deposit: '',
    setup_fee: '0',
    mess_included: true,
    source: '',
    payment_status: 'paid',
    payment_method: 'upi',
    payment_reference: '',
    reminder_date: '',
    reminder_note: '',
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [idemKey] = useState(newKey);
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [docType, setDocType] = useState('id_proof');
  const uploaded = useRef(new Set<File>()); // survives a retry so files aren't uploaded twice

  const floors = useMemo(() => layout.data ?? [], [layout.data]);
  // Preselect floor/room (and default rent) from ?bed=
  useEffect(() => {
    if (!bedId || !floors.length || roomId) return;
    for (const f of floors) {
      for (const r of f.rooms) {
        if (r.beds.some((b) => b.bed_id === bedId)) {
          setFloorId(f.floor_id);
          setRoomId(r.room_id);
          setTerms((t) => ({
            ...t,
            monthly_rent: t.monthly_rent || String(r.rent),
            security_deposit: t.security_deposit || String(r.rent * 2),
          }));
        }
      }
    }
  }, [bedId, floors, roomId]);

  const floor = floors.find((f) => f.floor_id === floorId);
  const room = floor?.rooms.find((r) => r.room_id === roomId);
  const bed = room?.beds.find((b) => b.bed_id === bedId);

  // create_admission is idempotent on idemKey, so a retry after a failed upload reuses the same admission.
  const m = useMutation(async () => {
    const admissionId = await createAdmission({
      bedId,
      resident: { ...res, email: res.email.trim() || null },
      terms: {
        ...terms,
        monthly_rent: Number(terms.monthly_rent),
        security_deposit: Number(terms.security_deposit || 0),
        setup_fee: Number(terms.setup_fee || 0),
      },
      idempotencyKey: idemKey,
    });
    const pending = docs.filter((d) => !uploaded.current.has(d.file));
    if (pending.length) {
      const residentId = await getAdmissionResidentId(admissionId);
      for (const d of pending) {
        try {
          await uploadFile('resident_document', residentId, d.file, d.type);
          uploaded.current.add(d.file);
        } catch (e) {
          throw new ApiError(
            (e as ApiError).code ?? 'INTERNAL_ERROR',
            `Admission submitted, but "${d.file.name}" did not upload: ${(e as Error).message} Submit again to retry the remaining files.`,
          );
        }
      }
    }
    return admissionId;
  });

  /** Adds valid files (up to MAX_DOCS); invalid ones are reported and skipped. */
  const addFiles = (files: File[]) => {
    const bad = files.map(fileError).filter(Boolean);
    setErrs((e) => ({ ...e, docs: bad.join(' ') }));
    setDocs((d) => [...d, ...files.filter((f) => !fileError(f)).map((file) => ({ file, type: docType }))].slice(0, MAX_DOCS));
  };

  /** Validates one step; sets field errors and returns whether it passed. */
  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0 && !bedId) e.bed = 'Select an available bed';
    if (s === 1) {
      if (res.full_name.trim().length < 2) e.full_name = 'Full name is required';
      if (!PHONE_RE.test(res.phone.trim())) e.phone = 'Enter a valid mobile number';
      if (res.email && !EMAIL_RE.test(res.email)) e.email = 'Enter a valid email';
      if (res.emergency_contact_phone && !PHONE_RE.test(res.emergency_contact_phone.trim())) {
        e.emergency_contact_phone = 'Enter a valid number';
      }
    }
    if (s === 2 && res.id_number_last4 && !ID_LAST4_RE.test(res.id_number_last4)) {
      e.id_number_last4 = 'Enter exactly the last 4 characters';
    }
    if (s === 3) {
      if (!terms.admission_date) e.admission_date = 'Required';
      if (terms.monthly_rent === '' || Number(terms.monthly_rent) < 0) e.monthly_rent = 'Enter the monthly rent';
      if (terms.payment_status === 'paid' && terms.payment_method === 'upi') {
        const utr = (terms.payment_reference || '').trim();
        if (!utr) {
          e.payment_reference = 'Please enter the UPI transaction / UTR reference number';
        } else if (utr.length < 6) {
          e.payment_reference = 'Enter a valid UPI UTR reference number (at least 6 digits)';
        }
      }
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  };
  const next = () => {
    if (validate(step)) setStep(step + 1);
  };
  const submit = async () => {
    // Re-check every step and jump to the first one with errors.
    for (let s = 0; s < 4; s++) {
      if (!validate(s)) {
        setStep(s);
        return;
      }
    }
    const id = await m.run();
    if (id) {
      try {
        await autoApproveAdmission(id, res.portal_password, {
          status: terms.payment_status,
          method: terms.payment_method,
          reference: terms.payment_reference?.trim() || null,
          reminderDate: terms.reminder_date || null,
          reminderNote: terms.reminder_note?.trim() || null,
        });
      } catch (e) {
        console.warn('Auto-approval error:', e);
      }
      nav('../residents', { replace: true });
    }
  };

  return (
    <>
      <PageHeader title="New admission" subtitle={building?.name} crumbs="PG Members / New Admission" actions={<BuildingPicker />} />
      <SectionPromoBanner
        eyebrow="RESIDENT ONBOARDING"
        title="New Admission & Bed Allocation."
        subtitle={
          building
            ? `Onboarding resident for ${building.name} with instant KYC and portal access credentials.`
            : 'Onboard new residents with bed allocation and instant login credentials.'
        }
        imageSrc="/owner-assets/residents-hero.jpg"
        primaryAction={{
          label: 'Back to Residents',
          onClick: () => nav('../residents'),
          icon: ArrowLeft,
        }}
      />
      <StepIndicator steps={STEPS} current={step} />

      <Card className="max-w-3xl">
        <Async state={layout}>
          {() => (
            <div className="space-y-4">
              {step === 0 && (
                <BedStep
                  floors={floors}
                  floorId={floorId}
                  roomId={roomId}
                  bedId={bedId}
                  error={errs.bed}
                  buildingName={building?.name}
                  onFloor={(id) => {
                    setFloorId(id);
                    setRoomId('');
                    setBedId('');
                  }}
                  onRoom={(id, rent) => {
                    setRoomId(id);
                    setBedId('');
                    // Picking a room resets rent and deposit (2 × rent) to that room's standard.
                    if (rent !== undefined) setTerms((t) => ({ ...t, monthly_rent: String(rent), security_deposit: String(rent * 2) }));
                  }}
                  onBed={setBedId}
                />
              )}
              {step === 1 && <DetailsStep res={res} setRes={setRes} errs={errs} />}
              {step === 2 && (
                <KycStep
                  res={res}
                  setRes={setRes}
                  errs={errs}
                  docs={docs}
                  setDocs={setDocs}
                  docType={docType}
                  setDocType={setDocType}
                  isUploaded={(f) => uploaded.current.has(f)}
                  maxDocs={MAX_DOCS}
                  onAddFiles={addFiles}
                />
              )}
              {step === 3 && <TermsStep terms={terms} setTerms={setTerms} errs={errs} />}
              {step === 4 && (
                <ReviewStep
                  res={res}
                  terms={terms}
                  location={`${floor?.floor_name} · Room ${room?.room_number} · ${bed?.label}`}
                  docCount={docs.length}
                  error={m.error}
                />
              )}
              <div className="flex justify-between pt-2">
                <Button variant="secondary" onClick={() => (step ? setStep(step - 1) : nav('../residents'))}>
                  <ChevronLeft className="size-4" />
                  {step ? 'Back' : 'Cancel'}
                </Button>
                {step < 4 ? (
                  <Button onClick={next}>
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button busy={m.busy} onClick={submit}>Complete Admission</Button>
                )}
              </div>
            </div>
          )}
        </Async>
      </Card>
    </>
  );
}
