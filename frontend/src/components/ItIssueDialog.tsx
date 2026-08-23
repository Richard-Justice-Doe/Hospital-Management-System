import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL, openTicket } from '../workflow/itDesk';
import type { ItTicketCategory, ItTicketPriority } from '../workflow/types';
import { btnPrimary, btnSecondary, Field, inputClass } from '../pages/admin/adminUi';

export default function ItIssueDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { updateCare } = useCare();
  const [category, setCategory] = useState<ItTicketCategory>('HIS');
  const [priority, setPriority] = useState<ItTicketPriority>('NORMAL');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [location, setLocation] = useState('');
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;
    updateCare((state) =>
      openTicket(state, {
        openedByStaffId: user.id,
        category,
        priority,
        title,
        detail,
        location,
      }),
    );
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="it-issue-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <p id="it-issue-title" className="text-xl font-semibold text-slate-900">
              Ticket sent to IT
            </p>
            <p className="mt-2 text-sm text-slate-600">IT will pick it up from their queue. You can keep working.</p>
            <button type="button" className={`${btnPrimary} mt-5`} onClick={onClose}>
              OK
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <h2 id="it-issue-title" className="text-lg font-semibold text-slate-900">
                Report an IT issue
              </h2>
              <p className="mt-1 text-sm text-slate-500">Login, printer, network, or HIS problem. IT sees this on their desk.</p>
            </div>
            <Field label="What kind of problem">
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as ItTicketCategory)}>
                {(Object.keys(TICKET_CATEGORY_LABEL) as ItTicketCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {TICKET_CATEGORY_LABEL[key]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as ItTicketPriority)}>
                {(Object.keys(TICKET_PRIORITY_LABEL) as ItTicketPriority[]).map((key) => (
                  <option key={key} value={key}>
                    {TICKET_PRIORITY_LABEL[key]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Short title">
              <input required className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cannot print folder cover" />
            </Field>
            <Field label="Where">
              <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Desk, ward, or room" />
            </Field>
            <Field label="What happened">
              <textarea className={inputClass} rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary}>
                Send to IT
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
