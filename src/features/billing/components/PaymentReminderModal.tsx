import { useMemo, useState } from 'react';
import { Bell, Check, Copy, MessageCircle, X } from 'lucide-react';
import { fmtDate, inr } from '../../../lib/format';
import { Button } from '../../../components/ui';

export interface PaymentReminderTarget {
  name: string;
  phone: string;
  totalDue: number;
  overdue?: number;
  oldestDue?: string;
  room?: string | null;
  bed?: string | null;
}

export interface PaymentReminderModalProps {
  target: PaymentReminderTarget | null;
  buildingName?: string;
  onClose: () => void;
  onSent: (msg: string) => void;
}

export function PaymentReminderModal({
  target,
  buildingName,
  onClose,
  onSent,
}: PaymentReminderModalProps) {
  if (!target) return null;

  return (
    <PaymentReminderDialog
      key={`${target.name}-${target.phone}-${target.totalDue}`}
      target={target}
      buildingName={buildingName}
      onClose={onClose}
      onSent={onSent}
    />
  );
}

function PaymentReminderDialog({
  target,
  buildingName,
  onClose,
  onSent,
}: {
  target: PaymentReminderTarget;
  buildingName?: string;
  onClose: () => void;
  onSent: (msg: string) => void;
}) {
  const cleanPhone = (target.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');
  const isOverdue = Number(target.overdue) > 0;

  const defaultMsg = useMemo(() => {
    if (isOverdue) {
      const overdueTxt = target.oldestDue
        ? ` (including ${inr(target.overdue!)} overdue since ${fmtDate(target.oldestDue)})`
        : ` (${inr(target.overdue!)} overdue)`;
      return `Hi ${target.name}, this is an urgent payment reminder from ${buildingName || 'ZIPCO PG'}. You have pending dues of ${inr(target.totalDue)}${overdueTxt}${target.room ? ` for Room ${target.room}` : ''}. Kindly clear the pending payment via UPI or Cash at your earliest convenience. Thank you!`;
    }
    return `Hi ${target.name}, this is a gentle payment reminder from ${buildingName || 'ZIPCO PG'} regarding your unpaid fee of ${inr(target.totalDue)}${target.room ? ` for Room ${target.room}` : ''}. Kindly clear the pending dues via UPI or Cash at your earliest convenience. Thank you!`;
  }, [target, isOverdue, buildingName]);

  const [message, setMessage] = useState(defaultMsg);
  const [copied, setCopied] = useState(false);

  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onSent('Reminder message copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
              <Bell className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base">
                {isOverdue ? 'Overdue Payment Reminder' : 'Fee Payment Reminder'}
              </h2>
              <p className="text-xs text-muted">
                {isOverdue
                  ? 'Notify resident about overdue rent and pending fees'
                  : 'Notify resident about unpaid fees'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-muted hover:text-ink hover:bg-subtle cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="bg-subtle/60 rounded-lg p-3 text-[13px] grid grid-cols-2 gap-2.5">
          <div>
            <span className="text-muted text-[11px] block">Resident</span>
            <span className="font-semibold text-ink">{target.name}</span>
          </div>
          <div>
            <span className="text-muted text-[11px] block">Mobile Number</span>
            <span className="font-mono text-ink">{target.phone || '—'}</span>
          </div>
          {target.room && (
            <div>
              <span className="text-muted text-[11px] block">Room / Bed</span>
              <span className="text-ink">
                Room {target.room} {target.bed ? `· Bed ${target.bed}` : ''}
              </span>
            </div>
          )}
          {isOverdue ? (
            <>
              <div>
                <span className="text-muted text-[11px] block">Overdue Amount</span>
                <span className="font-bold text-bad tabular">{inr(target.overdue!)}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-line/50 flex items-center justify-between">
                <span className="text-muted text-[12px]">Total Pending Dues</span>
                <span className="font-bold text-ink tabular text-[14px]">
                  {inr(target.totalDue)}
                </span>
              </div>
            </>
          ) : (
            <div>
              <span className="text-muted text-[11px] block">Unpaid Fee Due</span>
              <span className="font-bold text-bad tabular">{inr(target.totalDue)}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-ink mb-1.5">
            Reminder Message Preview / Edit
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full text-xs font-sans rounded-lg border border-line p-2.5 focus:border-brand-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy Message'}
          </Button>

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onSent(`WhatsApp opened to send payment reminder to ${target.name}`);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer h-8 px-3 text-[13px] bg-ok text-white hover:brightness-110"
            >
              <MessageCircle className="size-3.5" />
              Send via WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
