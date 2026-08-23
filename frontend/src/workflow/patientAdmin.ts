import type { CopayerRelationship, InsuranceType, PatientRecord, VisitRecord } from './types';

export const INSURANCE_LABELS: Record<InsuranceType, string> = {
  GOVERNMENT: 'Government (NHIS)',
  PRIVATE: 'Private insurance',
  CASH: 'Private patient (cash)',
};

export const INSURANCE_OPTIONS: Array<{
  id: InsuranceType;
  title: string;
  hint: string;
}> = [
  {
    id: 'GOVERNMENT',
    title: 'Government (NHIS)',
    hint: 'Patient has a valid NHIS card.',
  },
  {
    id: 'PRIVATE',
    title: 'Private insurance',
    hint: 'Patient has a company or private scheme.',
  },
  {
    id: 'CASH',
    title: 'Private patient',
    hint: 'No NHIS card and no private insurance. Treat as a cash-paying private patient.',
  },
];

export const COPAYER_RELATIONSHIPS: CopayerRelationship[] = [
  'Self',
  'Parent',
  'Spouse',
  'Child',
  'Sibling',
  'Guardian',
  'Employer',
  'Other',
];

export function ageFromDob(dateOfBirth: string, on = new Date()): number {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  let age = on.getFullYear() - dob.getFullYear();
  const month = on.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && on.getDate() < dob.getDate())) age -= 1;
  return Math.max(0, age);
}

export function isCashPrivatePatient(patient?: Pick<PatientRecord, 'insuranceType'> | null): boolean {
  return patient?.insuranceType === 'CASH';
}

export function insuranceLabel(
  patient?: Pick<PatientRecord, 'insuranceType' | 'insuranceProvider' | 'insuranceNumber' | 'ghanaCardNo' | 'hinNumber'> | null,
): string {
  if (!patient?.insuranceType) return 'Not recorded';
  const type = INSURANCE_LABELS[patient.insuranceType];
  if (patient.insuranceType === 'CASH') return type;
  const extra = [patient.insuranceProvider, patient.insuranceNumber, patient.ghanaCardNo && `Ghana Card ${patient.ghanaCardNo}`, patient.hinNumber && `HIN ${patient.hinNumber}`]
    .filter(Boolean)
    .join(' · ');
  return extra ? `${type} · ${extra}` : type;
}

export function hasGhanaNhiss(patient?: Pick<PatientRecord, 'insuranceType' | 'ghanaCardNo' | 'insuranceNumber'> | null) {
  return patient?.insuranceType === 'GOVERNMENT' && Boolean(patient.ghanaCardNo || patient.insuranceNumber);
}

export function normalizeCcCode(code?: string | null): string {
  return (code ?? '').trim().toUpperCase();
}

export function visitMissingRequiredCc(
  patient?: Pick<PatientRecord, 'insuranceType' | 'ghanaCardNo' | 'insuranceNumber'> | null,
  visit?: Pick<VisitRecord, 'nhisCcCode'> | null,
  extraCode?: string | null,
): boolean {
  if (!hasGhanaNhiss(patient)) return false;
  return !normalizeCcCode(extraCode || visit?.nhisCcCode);
}

export function formatDob(dateOfBirth?: string): string {
  if (!dateOfBirth) return '—';
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return dateOfBirth;
  return date.toLocaleDateString();
}

export function stayLabel(patient?: Pick<PatientRecord, 'address' | 'town'> | null): string {
  if (!patient) return '—';
  return [patient.address, patient.town].filter(Boolean).join(', ') || '—';
}

export function isStaffRelated(patient?: Pick<PatientRecord, 'relatedStaffId'> | null): boolean {
  return Boolean(patient?.relatedStaffId);
}

export function staffRelationLabel(
  patient: PatientRecord | undefined,
  staff: Array<{ id: string; firstName: string; lastName: string }>,
): string | null {
  if (!patient?.relatedStaffId) return null;
  const worker = staff.find((s) => s.id === patient.relatedStaffId);
  const who = worker ? `${worker.firstName} ${worker.lastName}` : 'a hospital worker';
  return `${patient.staffRelation ?? 'Related to'} · ${who}`;
}
