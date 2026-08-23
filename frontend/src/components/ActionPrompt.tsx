import type { Department } from '../workflow/types';

export type PromptKind =
  | 'saved'
  | 'folder'
  | 'checked_in'
  | 'vitals'
  | 'sent_doctor'
  | 'sent_lab'
  | 'sent_pharmacy'
  | 'sent_xray'
  | 'sent_physio'
  | 'sent_eye'
  | 'sent_ent'
  | 'sent_dental'
  | 'sent_maternity'
  | 'sent_nursing'
  | 'sent_ward'
  | 'sent_theatre'
  | 'sent_accounts'
  | 'sent_services'
  | 'work_done'
  | 'bill'
  | 'paid'
  | 'consult';

const DEPT_KIND: Record<Department, PromptKind> = {
  RECORDS: 'checked_in',
  CONSULTATION: 'sent_doctor',
  NURSING: 'sent_nursing',
  LAB: 'sent_lab',
  PHARMACY: 'sent_pharmacy',
  RADIOLOGY: 'sent_xray',
  PHYSIO: 'sent_physio',
  DENTAL: 'sent_dental',
  EYE: 'sent_eye',
  ENT: 'sent_ent',
  MATERNITY: 'sent_maternity',
  THEATRE: 'sent_theatre',
  WARD: 'sent_ward',
  CLAIMS: 'work_done',
  STORES: 'work_done',
  PROCUREMENT: 'work_done',
  IT: 'work_done',
};

const KIND_TITLE: Record<PromptKind, string> = {
  saved: 'Saved',
  folder: 'Folder opened',
  checked_in: 'Checked in',
  vitals: 'Vitals saved',
  sent_doctor: 'Sent to doctor',
  sent_lab: 'Sent to laboratory',
  sent_pharmacy: 'Sent to pharmacy',
  sent_xray: 'Sent to imaging',
  sent_physio: 'Sent to physiotherapy',
  sent_eye: 'Sent to eye clinic',
  sent_ent: 'Sent to ENT',
  sent_dental: 'Sent to dental',
  sent_maternity: 'Sent to maternity',
  sent_nursing: 'Sent to nursing',
  sent_ward: 'Sent to ward',
  sent_theatre: 'Sent to theatre',
  sent_accounts: 'Ready for Accounts',
  sent_services: 'Services ordered',
  work_done: 'Work done',
  bill: 'Bill saved',
  paid: 'Payment recorded',
  consult: 'Consult saved',
};

export function promptKindForDepartment(department: Department): PromptKind {
  return DEPT_KIND[department];
}

export default function ActionPrompt({
  kind,
  patientName,
  detail,
  nextLabel,
  onNext,
  secondaryLabel,
  onSecondary,
  onClose,
}: {
  kind?: PromptKind;
  patientName?: string;
  detail?: string;
  destinations?: PromptKind[];
  nextLabel?: string;
  onNext?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="action-prompt-title"
        className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-5xl">✅</div>
        <h2 id="action-prompt-title" className="mt-4 text-3xl font-black text-slate-900">
          {KIND_TITLE[kind ?? 'saved']}
        </h2>
        {patientName && <p className="mt-2 text-lg font-semibold text-slate-800">{patientName}</p>}
        {detail && <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>}
        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-clinic-600 py-4 text-xl font-bold text-white hover:bg-clinic-700"
          >
            OK
          </button>
          {nextLabel && onNext && (
            <button
              type="button"
              onClick={onNext}
              className="rounded-2xl border-2 border-clinic-600 py-3 text-lg font-semibold text-clinic-700 hover:bg-clinic-50"
            >
              {nextLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-2xl border py-3 text-lg font-semibold text-slate-700 hover:bg-slate-50"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
