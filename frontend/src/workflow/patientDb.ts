import type { PatientRecord } from './types';

export const PATIENT_DB_KEY = 'cms_patient_database_v1';
export const HOSPITAL_NO_PREFIX = 'A';
export const FOLDER_YEAR_MAX = 10000;

export interface PatientDatabase {
  patients: PatientRecord[];
  nextSeq: number;
}

export function folderYear(folderDate: string): number {
  const match = folderDate.trim().match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const year = new Date(folderDate).getFullYear();
  return Number.isNaN(year) ? new Date().getFullYear() : year;
}

export function migrateFolderNo(hospitalNo: string, folderCreatedAt?: string): string {
  if (/^A\d{1,5}\/\d{4}$/i.test(hospitalNo.trim())) return hospitalNo.trim().toUpperCase();
  const parsed = parseFolderNo(hospitalNo);
  if (!parsed) return hospitalNo.trim().toUpperCase();
  const year = parsed.year ?? (folderCreatedAt ? folderYear(folderCreatedAt) : new Date().getFullYear());
  return formatFolderNo(year, Math.min(Math.max(parsed.seq, 1), FOLDER_YEAR_MAX));
}

export function formatFolderNo(year: number, seq: number): string {
  return `${HOSPITAL_NO_PREFIX}${seq}/${year}`;
}

export function formatHospitalNo(seq: number, year = new Date().getFullYear()): string {
  return formatFolderNo(year, seq);
}

export function parseFolderNo(value: string | undefined): { year?: number; seq: number } | null {
  if (!value) return null;
  const raw = value.trim().toUpperCase();
  const aYear = raw.match(/^A(\d{1,5})[/-](\d{4})$/);
  if (aYear) return { seq: Number(aYear[1]), year: Number(aYear[2]) };
  const yearA = raw.match(/^(\d{4})[/-]A?(\d{1,5})$/);
  if (yearA) return { year: Number(yearA[1]), seq: Number(yearA[2]) };
  const aOnly = raw.match(/^A(\d{1,5})$/);
  if (aOnly) return { seq: Number(aOnly[1]) };
  const ch = raw.match(/^CH-?(\d+)$/);
  if (ch) return { seq: Number(ch[1]) };
  const digits = raw.match(/^(\d{1,5})$/);
  if (digits) return { seq: Number(digits[1]) };
  return null;
}

export function normalizeHospitalNo(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hospitalNoSeq(hospitalNo: string | undefined): number {
  return parseFolderNo(hospitalNo)?.seq ?? 0;
}

export function formatManualFolderNo(value: string, folderDate?: string): string {
  const parsed = parseFolderNo(value);
  if (!parsed) return value.trim().toUpperCase();
  const year = parsed.year ?? (folderDate ? folderYear(folderDate) : new Date().getFullYear());
  const seq = Math.min(Math.max(parsed.seq, 1), FOLDER_YEAR_MAX);
  return formatFolderNo(year, seq);
}

export function nextFolderSeqForYear(patients: PatientRecord[], year: number): number {
  let max = 0;
  for (const patient of patients) {
    const parsed = parseFolderNo(patient.hospitalNo);
    if (!parsed) continue;
    if (parsed.year === year) max = Math.max(max, parsed.seq);
  }
  return Math.min(max + 1, FOLDER_YEAR_MAX);
}

export function nextFolderNoForDate(patients: PatientRecord[], folderDate: string): string {
  const year = folderYear(folderDate);
  return formatFolderNo(year, nextFolderSeqForYear(patients, year));
}

export function highestHospitalSeq(patients: PatientRecord[]): number {
  const year = new Date().getFullYear();
  return Math.max(0, nextFolderSeqForYear(patients, year) - 1);
}

export function ensureHospitalNumbers(patients: PatientRecord[], startSeq = 1): { patients: PatientRecord[]; nextSeq: number } {
  const year = new Date().getFullYear();
  let seq = Math.max(startSeq - 1, highestHospitalSeq(patients));
  const nextPatients = patients.map((patient) => {
    if (patient.hospitalNo) {
      return { ...patient, hospitalNo: migrateFolderNo(patient.hospitalNo, patient.folderCreatedAt) };
    }
    seq = Math.min(seq + 1, FOLDER_YEAR_MAX);
    return { ...patient, hospitalNo: formatFolderNo(year, seq) };
  });
  return { patients: nextPatients, nextSeq: Math.min(Math.max(seq + 1, highestHospitalSeq(nextPatients) + 1), FOLDER_YEAR_MAX + 1) };
}

export function issueHospitalNo(_nextSeq: number, patients: PatientRecord[]): { hospitalNo: string; nextSeq: number } {
  const year = new Date().getFullYear();
  const seq = nextFolderSeqForYear(patients, year);
  return { hospitalNo: formatFolderNo(year, seq), nextSeq: Math.min(seq + 1, FOLDER_YEAR_MAX + 1) };
}

export function findByHospitalNo(patients: PatientRecord[], query: string): PatientRecord | undefined {
  const needle = normalizeHospitalNo(query);
  if (!needle) return undefined;
  const exact = patients.find((patient) => normalizeHospitalNo(patient.hospitalNo) === needle);
  if (exact) return exact;
  const parsed = parseFolderNo(query);
  if (!parsed) return undefined;
  return patients.find((patient) => {
    const other = parseFolderNo(patient.hospitalNo);
    if (!other || other.seq !== parsed.seq) return false;
    if (parsed.year && other.year) return parsed.year === other.year;
    return true;
  });
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
