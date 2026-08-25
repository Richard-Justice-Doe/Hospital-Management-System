import type {
  BloodGroup,
  CopayerRecord,
  CopayerRelationship,
  FolderPaymentMethod,
  InsuranceType,
  KinContact,
  MaritalStatus,
  NhisStatus,
  PatientRecord,
  PatientSponsor,
  RegistrationVisitType,
  VisitRecord,
} from './types';

export const INSURANCE_LABELS: Record<InsuranceType, string> = {
  GOVERNMENT: 'Government (NHIS / HIN)',
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
    title: 'Government (NHIS / HIN)',
    hint: 'Patient has a valid NHIS card or HIN.',
  },
  {
    id: 'PRIVATE',
    title: 'Private insurance',
    hint: 'Patient has a company or private scheme.',
  },
  {
    id: 'CASH',
    title: 'Private patient',
    hint: 'No NHIS / HIN and no private insurance. Treat as a cash-paying private patient.',
  },
];

export const MARITAL_STATUS: MaritalStatus[] = ['Single', 'Married', 'Widowed', 'Divorced', 'Separated', 'Not stated'];

export const BLOOD_GROUPS: BloodGroup[] = ['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const VISIT_TYPES: Array<{ id: RegistrationVisitType; label: string }> = [
  { id: 'NEW', label: 'New patient' },
  { id: 'WALK_IN', label: 'Walk-in' },
  { id: 'REFERRAL', label: 'Referral' },
  { id: 'EMERGENCY', label: 'Emergency' },
];

export const NHIS_STATUS: Array<{ id: NhisStatus; label: string }> = [
  { id: 'NOT_ENROLLED', label: 'Not enrolled' },
  { id: 'PENDING', label: 'Pending / new card' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'EXPIRED', label: 'Expired' },
];

export const FOLDER_PAYMENTS: Array<{ id: FolderPaymentMethod; label: string; hint: string }> = [
  { id: 'CASH', label: 'Cash', hint: 'Pay at Accounts.' },
  { id: 'NHIS', label: 'NHIS / HIN', hint: 'Government health insurance. Enter the NHIS and HIN numbers below.' },
  { id: 'MOMO', label: 'Mobile money', hint: 'MoMo at Accounts.' },
  { id: 'PRIVATE', label: 'Private insurance', hint: 'Company or private scheme. Enter the insurer details below.' },
];

export function coverFromPayment(method: FolderPaymentMethod): InsuranceType {
  if (method === 'NHIS') return 'GOVERNMENT';
  if (method === 'PRIVATE' || method === 'CORPORATE') return 'PRIVATE';
  return 'CASH';
}

export function isMinor(age: number): boolean {
  return age < 18;
}

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

export function ageYearsMonths(dateOfBirth: string, on = new Date()): { years: number; months: number } {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return { years: 0, months: 0 };
  let years = on.getFullYear() - dob.getFullYear();
  let months = on.getMonth() - dob.getMonth();
  if (on.getDate() < dob.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years: Math.max(0, years), months: Math.max(0, months) };
}

export function patientAgeLabel(patient: Pick<PatientRecord, 'age' | 'dateOfBirth'>, on = new Date()): string {
  if (patient.dateOfBirth) {
    const { years, months } = ageYearsMonths(patient.dateOfBirth, on);
    const y = `${years} year${years === 1 ? '' : 's'}`;
    const m = `${months} month${months === 1 ? '' : 's'}`;
    if (years === 0) return m;
    if (months === 0) return y;
    return `${y}, ${m}`;
  }
  return `${patient.age} year${patient.age === 1 ? '' : 's'}`;
}

export function serviceTypeShort(
  person?: Pick<PatientRecord, 'insuranceType'> | null,
): string {
  if (person?.insuranceType === 'GOVERNMENT') return 'NHIS';
  if (person?.insuranceType === 'PRIVATE') return 'Private';
  if (person?.insuranceType === 'CASH') return 'Cash';
  return 'Not recorded';
}

export function isCashPrivatePatient(patient?: Pick<PatientRecord, 'insuranceType'> | null): boolean {
  return patient?.insuranceType === 'CASH';
}

export function insuranceLabel(
  person?: Pick<PatientRecord, 'insuranceType' | 'insuranceProvider' | 'insuranceNumber' | 'ghanaCardNo' | 'hinNumber'> | null,
): string {
  if (!person?.insuranceType) return 'Not recorded';
  const type = INSURANCE_LABELS[person.insuranceType];
  if (person.insuranceType === 'CASH') return type;
  const extra = [person.insuranceProvider, person.insuranceNumber, person.ghanaCardNo && `Ghana Card ${person.ghanaCardNo}`, person.hinNumber && `HIN ${person.hinNumber}`]
    .filter(Boolean)
    .join(' · ');
  return extra ? `${type} · ${extra}` : type;
}

/** Insurer name and membership number stored on the folder for when the card is not presented. */
export function coverOnFile(
  person?: Pick<PatientRecord, 'insuranceType' | 'insuranceProvider' | 'insuranceNumber' | 'hinNumber'> | null,
): string | null {
  if (!person?.insuranceType || person.insuranceType === 'CASH') return null;
  if (person.insuranceType === 'PRIVATE') {
    const line = [person.insuranceProvider, person.insuranceNumber].filter(Boolean).join(' · ');
    return line ? `Private insurance on folder: ${line}` : null;
  }
  const line = [person.insuranceNumber && `NHIS ${person.insuranceNumber}`, person.hinNumber && `HIN ${person.hinNumber}`]
    .filter(Boolean)
    .join(' · ');
  return line ? `NHIS / HIN on folder: ${line}` : null;
}

export function copayerCoverLabel(
  copayer?: Pick<CopayerRecord, 'insuranceType' | 'insuranceProvider' | 'insuranceNumber' | 'ghanaCardNo' | 'hinNumber'> | null,
): string {
  if (!copayer?.insuranceType) return 'Cover not recorded';
  return insuranceLabel(copayer);
}

export function hasGhanaNhiss(
  patient?: Pick<PatientRecord, 'insuranceType' | 'ghanaCardNo' | 'insuranceNumber' | 'hinNumber' | 'preferredPayment'> | null,
) {
  if (!patient) return false;
  if (patient.insuranceType === 'PRIVATE' || patient.insuranceType === 'CASH') return false;
  return (
    patient.insuranceType === 'GOVERNMENT' ||
    patient.preferredPayment === 'NHIS' ||
    Boolean(patient.hinNumber?.trim()) ||
    Boolean(patient.ghanaCardNo?.trim()) ||
    Boolean(patient.insuranceNumber?.trim())
  );
}

export const CC_CODE_LENGTH = 5;
export const CC_REQUIRED_HINT =
  'Enter the 5-digit CC code for this visit. NHIS, HIN, and Ghana Card patients need a new code each time they come.';

export function normalizeCcCode(code?: string | null): string {
  const digits = (code ?? '').replace(/\D/g, '');
  return digits.length === CC_CODE_LENGTH ? digits : '';
}

export function isValidCcCode(code?: string | null): boolean {
  return normalizeCcCode(code).length === CC_CODE_LENGTH;
}

export function visitMissingRequiredCc(
  patient?: Pick<PatientRecord, 'insuranceType' | 'ghanaCardNo' | 'insuranceNumber' | 'hinNumber' | 'preferredPayment'> | null,
  visit?: Pick<VisitRecord, 'nhisCcCode' | 'coverAsPrivate'> | null,
  extraCode?: string | null,
): boolean {
  if (visit?.coverAsPrivate) return false;
  if (!hasGhanaNhiss(patient)) return false;
  return !normalizeCcCode(extraCode || visit?.nhisCcCode);
}

export function previousVisitCcCode(
  visits: Array<Pick<VisitRecord, 'id' | 'patientId' | 'nhisCcCode' | 'checkedInAt'>>,
  patientId: string,
  currentVisitId?: string | null,
): string | undefined {
  const prior = visits
    .filter((visit) => visit.patientId === patientId && visit.id !== currentVisitId && Boolean(normalizeCcCode(visit.nhisCcCode)))
    .sort((a, b) => (b.checkedInAt ?? '').localeCompare(a.checkedInAt ?? ''));
  const code = normalizeCcCode(prior[0]?.nhisCcCode);
  return code || undefined;
}

export function formatDob(dateOfBirth?: string): string {
  if (!dateOfBirth) return '—';
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return dateOfBirth;
  return date.toLocaleDateString();
}

export function stayLabel(patient?: Pick<PatientRecord, 'address' | 'town' | 'hometown'> | null): string {
  if (!patient) return '—';
  return [patient.address, patient.town, patient.hometown && `Hometown ${patient.hometown}`].filter(Boolean).join(', ') || '—';
}

export function kinLabel(kin?: KinContact | null): string | null {
  if (!kin?.name) return null;
  return [kin.name, kin.relationship, kin.phone, kin.address].filter(Boolean).join(' · ');
}

export const CLINIC_DOCTOR_ROLES = ['DOCTOR', 'EYE_DOCTOR', 'ENT_DOCTOR', 'DENTIST', 'MIDWIFE'] as const;

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

export const PATIENT_TITLES = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Master', 'Baby'];

export const RELIGIONS = ['Christian', 'Muslim', 'Traditional', 'Other', 'Not stated'];

export const EDUCATION_LEVELS = ['None', 'Primary', 'JHS', 'SHS', 'Tertiary', 'Not stated'];

export const DISTRICTS = [
  'Accra Metro',
  'Kumasi Metro',
  'Tema Metro',
  'Cape Coast Metro',
  'Tamale Metro',
  'Sekondi-Takoradi Metro',
  'Sunyani',
  'Ho',
  'Koforidua',
  'Tanokrom',
];

export const NHIS_SCHEMES = ['NHIS', 'NHIS — Ashanti', 'NHIS — Greater Accra', 'NHIS — Western', 'NHIS — Northern'];

export const SPONSORS: Array<{ id: PatientSponsor; label: string; insuranceType: InsuranceType; payment: FolderPaymentMethod }> = [
  { id: 'GOVERNMENT', label: 'Government Of Ghana', insuranceType: 'GOVERNMENT', payment: 'NHIS' },
  { id: 'PRIVATE_INSURANCE', label: 'Private Insurance', insuranceType: 'PRIVATE', payment: 'PRIVATE' },
  { id: 'CORPORATE', label: 'Corporate', insuranceType: 'PRIVATE', payment: 'CORPORATE' },
  { id: 'PRIVATE', label: 'Private', insuranceType: 'CASH', payment: 'CASH' },
];

export const SPONSOR_TYPES = [
  'NHIS',
  'Acacia Insurance',
  'Apex Insurance',
  'Cosmopolitan Health Insurance',
  'Glico Healthcare Insurance',
  'Glico TPA Insurance',
  'Liberty Insurance',
  'Metropolitan',
  'Nationwide Medical Insurance',
  'Premier Health',
  'Private',
];

export function sponsorFromCover(insuranceType?: InsuranceType, preferredPayment?: FolderPaymentMethod): PatientSponsor {
  if (preferredPayment === 'CORPORATE') return 'CORPORATE';
  if (insuranceType === 'GOVERNMENT') return 'GOVERNMENT';
  if (insuranceType === 'PRIVATE') return 'PRIVATE_INSURANCE';
  return 'PRIVATE';
}

export function folderDisplayName(patient: Pick<PatientRecord, 'firstName' | 'lastName' | 'otherNames'>): string {
  return [patient.lastName, patient.firstName, patient.otherNames].filter(Boolean).join(' ').toUpperCase();
}

export function alreadyCheckedInMessage(patient: Pick<PatientRecord, 'firstName' | 'lastName' | 'otherNames' | 'gender'>): string {
  const who = patient.gender === 'Female' ? 'She' : patient.gender === 'Male' ? 'He' : 'This person';
  return `${folderDisplayName(patient)} has already been checked in today. ${who} cannot be checked in again until tomorrow. Send this person to Cash and Nursing.`;
}

export function expiredCoverAsPrivateMessage(patient: Pick<PatientRecord, 'firstName' | 'lastName' | 'otherNames' | 'gender'>): string {
  const who = patient.gender === 'Female' ? 'She' : patient.gender === 'Male' ? 'He' : 'This person';
  return `${folderDisplayName(patient)}'s NHIS / HIN / Ghana Card has expired. ${who} will be checked in as Private.`;
}

export function insuranceNameShort(
  person?: Pick<PatientRecord, 'insuranceType' | 'insuranceProvider' | 'sponsor'> | null,
): string {
  if (person?.insuranceType === 'GOVERNMENT') return person.insuranceProvider?.trim() || 'NHIS';
  if (person?.insuranceType === 'PRIVATE') return person.insuranceProvider?.trim() || 'Private';
  if (person?.insuranceType === 'CASH') return 'CASH';
  return '';
}

export function lastVisitDate(
  visits: Array<Pick<VisitRecord, 'id' | 'patientId' | 'checkedInAt'>>,
  patientId: string,
  excludeVisitId?: string,
): string {
  const prior = visits
    .filter((visit) => visit.patientId === patientId && visit.id !== excludeVisitId && visit.checkedInAt)
    .sort((a, b) => (b.checkedInAt ?? '').localeCompare(a.checkedInAt ?? ''));
  const iso = prior[0]?.checkedInAt;
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function formatHisTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}

export function expiryTone(iso?: string, on = new Date()): 'ok' | 'expired' | '' {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const start = new Date(on);
  start.setHours(0, 0, 0, 0);
  return date.getTime() >= start.getTime() ? 'ok' : 'expired';
}

export function nhisCoverExpired(
  patient?: Pick<
    PatientRecord,
    'insuranceType' | 'ghanaCardNo' | 'insuranceNumber' | 'hinNumber' | 'preferredPayment' | 'nhisExpires' | 'nhisStatus'
  > | null,
  on = new Date(),
): boolean {
  if (!hasGhanaNhiss(patient)) return false;
  if (patient?.nhisStatus === 'EXPIRED') return true;
  return expiryTone(patient?.nhisExpires, on) === 'expired';
}

export function daysUntil(iso?: string, on = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return String(Math.ceil((date.getTime() - on.getTime()) / 86_400_000));
}
