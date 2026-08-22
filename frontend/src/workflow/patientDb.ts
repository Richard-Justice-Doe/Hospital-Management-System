import type { PatientRecord } from './types';

export const PATIENT_DB_KEY = 'cms_patient_database_v1';
export const HOSPITAL_NO_PREFIX = 'CH';

export interface PatientDatabase {
  patients: PatientRecord[];
  nextSeq: number;
}

export function formatHospitalNo(seq: number): string {
  return `${HOSPITAL_NO_PREFIX}-${String(seq).padStart(5, '0')}`;
}

export function normalizeHospitalNo(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hospitalNoSeq(hospitalNo: string | undefined): number {
  if (!hospitalNo) return 0;
  const ch = hospitalNo.toUpperCase().match(/^CH-?(\d+)$/);
  return ch ? Number(ch[1]) || 0 : 0;
}

export function folderYear(folderDate: string): number {
  const year = new Date(folderDate).getFullYear();
  return Number.isNaN(year) ? new Date().getFullYear() : year;
}

export function formatFolderNo(year: number, seq: number): string {
  return `${year}/${String(seq).padStart(7, '0')}`;
}

export function formatManualFolderNo(value: string, folderDate?: string): string {
  const raw = value.trim().toUpperCase();
  if (!raw) return '';
  const year = folderDate ? folderYear(folderDate) : new Date().getFullYear();
  const match = raw.match(/^(?:(\d{4})[/-])?(\d+)$/);
  if (match?.[2]) {
    const y = match[1] ? Number(match[1]) : year;
    return formatFolderNo(y, Number(match[2]));
  }
  return raw.replace(/\s+/g, '');
}

export function nextFolderNoForDate(patients: PatientRecord[], folderDate: string): string {
  const year = folderYear(folderDate);
  let max = 0;
  for (const patient of patients) {
    const match = patient.hospitalNo.toUpperCase().match(/^(\d{4})[/-](\d+)$/);
    if (match && Number(match[1]) === year) max = Math.max(max, Number(match[2]));
  }
  return formatFolderNo(year, max + 1);
}

export function highestHospitalSeq(patients: PatientRecord[]): number {
  return patients.reduce((max, patient) => Math.max(max, hospitalNoSeq(patient.hospitalNo)), 0);
}

export function ensureHospitalNumbers(patients: PatientRecord[], startSeq = 1): { patients: PatientRecord[]; nextSeq: number } {
  let seq = Math.max(startSeq - 1, highestHospitalSeq(patients));
  const nextPatients = patients.map((patient) => {
    if (patient.hospitalNo) return patient;
    seq += 1;
    return { ...patient, hospitalNo: formatHospitalNo(seq) };
  });
  return { patients: nextPatients, nextSeq: Math.max(seq + 1, highestHospitalSeq(nextPatients) + 1) };
}

export function issueHospitalNo(nextSeq: number, patients: PatientRecord[]): { hospitalNo: string; nextSeq: number } {
  const seq = Math.max(nextSeq, highestHospitalSeq(patients) + 1);
  return { hospitalNo: formatHospitalNo(seq), nextSeq: seq + 1 };
}

export function findByHospitalNo(patients: PatientRecord[], query: string): PatientRecord | undefined {
  const needle = normalizeHospitalNo(query);
  if (!needle) return undefined;
  return patients.find((patient) => normalizeHospitalNo(patient.hospitalNo) === needle);
}

export function loadPatientDatabase(): PatientDatabase | null {
  try {
    const raw = localStorage.getItem(PATIENT_DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PatientDatabase;
    if (!Array.isArray(parsed.patients)) return null;
    const ensured = ensureHospitalNumbers(parsed.patients, parsed.nextSeq || 1);
    return {
      patients: ensured.patients,
      nextSeq: Math.max(parsed.nextSeq || 1, ensured.nextSeq),
    };
  } catch {
    return null;
  }
}

export function savePatientDatabase(db: PatientDatabase): void {
  localStorage.setItem(
    PATIENT_DB_KEY,
    JSON.stringify({
      patients: db.patients,
      nextSeq: db.nextSeq,
      savedAt: new Date().toISOString(),
    }),
  );
}

export function mergePatientRecords(primary: PatientRecord[], extra: PatientRecord[]): PatientRecord[] {
  const byId = new Map(primary.map((patient) => [patient.id, patient]));
  const byNo = new Map(primary.map((patient) => [normalizeHospitalNo(patient.hospitalNo), patient]));
  for (const patient of extra) {
    if (byId.has(patient.id)) continue;
    if (byNo.has(normalizeHospitalNo(patient.hospitalNo))) continue;
    byId.set(patient.id, patient);
  }
  return [...byId.values()];
}
