import { inputClass } from '../pages/admin/adminUi';
import { CLINICS, HIS_CLINIC_LABELS } from '../workflow/catalog';
import { CC_CODE_LENGTH } from '../workflow/patientAdmin';
import type { ClinicId } from '../workflow/types';

async function pasteText() {
  try {
    return (await navigator.clipboard.readText()).trim();
  } catch {
    return '';
  }
}

export function HisCheckInHeader({
  processDate,
  onProcessDateChange,
  clinic,
  onClinicChange,
  ccCode,
  onCcCodeChange,
  onMessage,
  ccRequired,
}: {
  processDate: string;
  onProcessDateChange: (value: string) => void;
  clinic: ClinicId;
  onClinicChange: (value: ClinicId) => void;
  ccCode: string;
  onCcCodeChange: (value: string) => void;
  onMessage?: (message: string | null) => void;
  ccRequired?: boolean;
}) {
  async function getCcCode() {
    const pasted = (await pasteText()).replace(/\D/g, '').slice(0, CC_CODE_LENGTH);
    if (pasted.length === CC_CODE_LENGTH) {
      onCcCodeChange(pasted);
      onMessage?.(null);
      return;
    }
    onMessage?.('Paste or type the 5-digit CC from NHIS / Ghana Card.');
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        Process Date
        <input
          type="date"
          value={processDate}
          onChange={(e) => onProcessDateChange(e.target.value)}
          className={`${inputClass} w-44`}
          aria-label="Process Date"
        />
      </label>
      <label className="flex min-w-[16rem] flex-1 items-center gap-2 text-sm font-medium text-slate-700">
        Select your check in point
        <select
          value={clinic}
          onChange={(e) => onClinicChange(e.target.value as ClinicId)}
          className={`${inputClass} flex-1`}
          aria-label="Select your check in point"
        >
          {CLINICS.map((point) => (
            <option key={point.id} value={point.id}>
              {HIS_CLINIC_LABELS[point.id]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        Claim Check Code{ccRequired ? <span className="text-red-600">*</span> : null}
        <input
          inputMode="numeric"
          pattern={`\\d{${CC_CODE_LENGTH}}`}
          maxLength={CC_CODE_LENGTH}
          value={ccCode}
          onChange={(e) => onCcCodeChange(e.target.value.replace(/\D/g, '').slice(0, CC_CODE_LENGTH))}
          placeholder="Claim check code"
          required={ccRequired}
          className={`${inputClass} w-36 font-mono ${ccRequired && ccCode.length !== CC_CODE_LENGTH ? 'border-red-400' : ''}`}
          aria-label="Claim Check Code"
          aria-required={ccRequired || undefined}
        />
      </label>
      <button type="button" onClick={() => void getCcCode()} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
        Get CC Code
      </button>
    </div>
  );
}
