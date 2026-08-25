import type { ReactNode } from 'react';
import { inputClass } from '../pages/admin/adminUi';
import { expiryTone, folderDisplayName, insuranceNameShort, patientAgeLabel } from '../workflow/patientAdmin';
import type { PatientRecord } from '../workflow/types';

const rowField = 'flex min-h-[2.25rem] items-center gap-3 text-sm font-medium text-slate-700';
const readInput = `${inputClass} bg-slate-100`;

export function HisReadRow({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'expired' | '' }) {
  const color = tone === 'ok' ? 'text-emerald-600 font-semibold' : tone === 'expired' ? 'text-red-600 font-semibold' : '';
  return (
    <label className={rowField}>
      <span className="w-36 shrink-0">{label}</span>
      <input readOnly value={value} className={`${readInput} ${color}`} />
    </label>
  );
}

export function HisPatientFields({
  patient,
  folderInput,
  folderHits,
  lastVisit,
}: {
  patient?: PatientRecord | null;
  folderInput: ReactNode;
  folderHits?: ReactNode;
  lastVisit?: string;
}) {
  const expiry = expiryTone(patient?.nhisExpires);
  return (
    <div className="space-y-2">
      <label className={rowField}>
        <span className="w-36 shrink-0">Folder No</span>
        {folderInput}
      </label>
      {folderHits}
      <HisReadRow label="Patient Name" value={patient ? folderDisplayName(patient) : ''} />
      <HisReadRow label="Insurance Name" value={patient ? insuranceNameShort(patient) : ''} />
      <HisReadRow label="Insurance No" value={patient?.insuranceNumber ?? ''} />
      <HisReadRow label="Card Expiry Date" value={patient?.nhisExpires ?? ''} tone={patient?.nhisExpires ? expiry : ''} />
      <HisReadRow label="Age" value={patient ? patientAgeLabel(patient) : ''} />
      {patient ? <p className="pt-2 text-sm font-semibold text-red-600">Patient Last Visit: {lastVisit}</p> : null}
    </div>
  );
}
