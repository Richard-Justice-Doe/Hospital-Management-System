import { STAGE_ORDER } from '../workflow/types';
import { STAGE_PICTURE, patientPlace } from '../workflow/deskUi';
import { hasGhanaNhiss, insuranceLabel } from '../workflow/patientAdmin';
import type { PatientRecord, VisitRecord } from '../workflow/types';

export default function PatientJourneyCard({
  patient,
  visit,
}: {
  patient?: PatientRecord;
  visit?: VisitRecord;
}) {
  if (!patient) return null;
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center gap-3">
        {patient.photoUrl ? (
          <img src={patient.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-clinic-100 text-2xl">👤</div>
        )}
        <div>
          <p className="text-lg font-bold">
            {patient.firstName} {patient.lastName}
          </p>
          <p className="font-mono text-sm text-clinic-700">{patient.hospitalNo}</p>
          <p className="text-xs text-slate-500">{insuranceLabel(patient)}</p>
          {visit?.nhisCcCode ? (
            <p className="text-xs font-semibold text-emerald-800">CC {visit.nhisCcCode}</p>
          ) : hasGhanaNhiss(patient) ? (
            <p className="text-xs font-semibold text-amber-800">CC code required</p>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700">{patientPlace(visit)}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {STAGE_ORDER.filter((stage) => stage !== 'COMPLETED').map((stage) => {
          const pic = STAGE_PICTURE[stage];
          const on = visit?.stage === stage;
          return (
            <span key={stage} className={`rounded-full px-2 py-1 text-xs font-semibold ${on ? pic.color : 'bg-slate-100 text-slate-400'}`}>
              {pic.icon} {stage.replace('_', ' ')}
            </span>
          );
        })}
      </div>
    </div>
  );
}
