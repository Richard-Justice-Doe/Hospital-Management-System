import type { PatientRecord } from '../workflow/types';

export default function PatientIdentity({
  patient,
  extra,
}: {
  patient?: Pick<PatientRecord, 'firstName' | 'lastName' | 'hospitalNo'> | null;
  extra?: string;
}) {
  if (!patient) return <span>Unknown patient</span>;
  return (
    <span>
      <span className="font-medium">
        {patient.firstName} {patient.lastName}
      </span>
      <span className="ml-2 font-mono text-xs font-semibold tracking-wide text-clinic-700">{patient.hospitalNo}</span>
      {extra ? <span className="text-slate-500">{extra}</span> : null}
    </span>
  );
}
