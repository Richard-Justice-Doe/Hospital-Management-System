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
  | 'consult'
  | 'record_saved'
  | 'already_checked_in'
  | 'expired_cover';

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
  record_saved: 'Record Saved Successfully!',
  already_checked_in: 'Already checked in today',
  expired_cover: 'NHIS / Ghana Card expired',
};

export function promptKindForDepartment(department: Department): PromptKind {
  return DEPT_KIND[department];
}

export default function ActionPrompt({
  title,
  kind,
  patientName,
  detail,
  nextLabel,
  onNext,
  secondaryLabel,
  onSecondary,
  onClose,
}: {
  title?: string;
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
  const his = kind === 'record_saved';
  const warn = kind === 'already_checked_in' || kind === 'expired_cover';
  const banner = his || warn;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="action-prompt-title"
        className={`bg-white text-center shadow-xl ${banner ? 'w-full max-w-md rounded-md px-10 py-9' : 'w-full max-w-sm rounded-xl p-8'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto flex items-center justify-center rounded-full ${
            his
              ? 'h-24 w-24 border-[5px] border-emerald-500 text-emerald-500'
              : warn
                ? 'h-24 w-24 border-[5px] border-amber-500 text-amber-500'
                : 'h-16 w-16 bg-emerald-100 text-emerald-700'
          }`}
        >
          {warn ? (
            <span className="text-4xl font-bold leading-none" aria-hidden="true">
              !
            </span>
          ) : (
            <svg viewBox="0 0 24 24" className={his ? 'h-12 w-12' : 'h-8 w-8'} aria-hidden="true">
              <path fill="currentColor" d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8.6-8.6 1.4 1.4z" />
            </svg>
          )}
        </div>
        <h2 id="action-prompt-title" className={`mt-6 ${banner ? 'text-2xl font-normal text-slate-500' : 'text-xl font-semibold text-slate-900'}`}>
          {title || KIND_TITLE[kind ?? 'saved']}
        </h2>
        {patientName && <p className="mt-2 text-base font-medium text-slate-800">{patientName}</p>}
        {detail && <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>}
        <div className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md py-2.5 text-sm font-semibold text-white ${banner ? 'bg-sky-500 hover:bg-sky-600' : 'bg-clinic-600 hover:bg-clinic-700'}`}
          >
            OK
          </button>
          {nextLabel && onNext && (
            <button
              type="button"
              onClick={onNext}
              className="rounded-lg border border-clinic-600 py-2.5 text-sm font-semibold text-clinic-700 hover:bg-clinic-50"
            >
              {nextLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-lg border py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
