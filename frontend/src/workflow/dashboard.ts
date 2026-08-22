import { CLINIC_LABELS, CLINICS } from './catalog';
import type { CareState, ClinicId, Department, InsuranceType, PatientRecord, VisitRecord } from './types';

export type DashboardPeriod = 'today' | 'all';

export interface StatBlock {
  visits: number;
  registration: number;
  nhis: number;
  private: number;
  checkIns: number;
}

export interface DepartmentStatRow extends StatBlock {
  id: string;
  label: string;
}

export interface TrendPoint extends StatBlock {
  label: string;
}

export interface DashboardSnapshot {
  period: DashboardPeriod;
  hospital: StatBlock;
  departments: DepartmentStatRow[];
  trend: TrendPoint[];
}

const SERVICE_DEPARTMENTS: Array<{ id: Department; label: string }> = [
  { id: 'NURSING', label: 'Nursing' },
  { id: 'LAB', label: 'Laboratory' },
  { id: 'PHARMACY', label: 'Pharmacy' },
  { id: 'RADIOLOGY', label: 'X-ray / imaging' },
];

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

export function inDashboardPeriod(iso: string | undefined, period: DashboardPeriod): boolean {
  if (!iso) return false;
  if (period === 'all') return true;
  return new Date(iso) >= startOfToday();
}

export function isPrivatePayer(type?: InsuranceType): boolean {
  return type === 'PRIVATE' || type === 'CASH';
}

function emptyStats(): StatBlock {
  return { visits: 0, registration: 0, nhis: 0, private: 0, checkIns: 0 };
}

function addVisitToStats(stats: StatBlock, patient: PatientRecord | undefined, isNewRegistration: boolean) {
  stats.visits += 1;
  stats.checkIns += 1;
  if (isNewRegistration) stats.registration += 1;
  if (patient?.insuranceType === 'GOVERNMENT') stats.nhis += 1;
  if (isPrivatePayer(patient?.insuranceType)) stats.private += 1;
}

function patientById(patients: PatientRecord[]) {
  return new Map(patients.map((patient) => [patient.id, patient]));
}

function isNewRegistration(patient: PatientRecord | undefined, visit: VisitRecord, period: DashboardPeriod): boolean {
  if (!patient) return false;
  const opened = patient.folderCreatedAt ?? patient.createdAt;
  if (!inDashboardPeriod(opened, period)) return false;
  const openedTime = new Date(opened).getTime();
  const visitTime = new Date(visit.checkedInAt).getTime();
  return Math.abs(visitTime - openedTime) < 24 * 60 * 60 * 1000;
}

export function buildDashboardSnapshot(state: CareState, period: DashboardPeriod = 'today'): DashboardSnapshot {
  const patients = patientById(state.patients);
  const visits = state.visits.filter((visit) => inDashboardPeriod(visit.checkedInAt, period));
  const hospital = emptyStats();
  const byClinic = new Map<ClinicId, StatBlock>();
  for (const clinic of CLINICS) byClinic.set(clinic.id, emptyStats());
  const byServiceDept = new Map<Department, StatBlock>();
  for (const dept of SERVICE_DEPARTMENTS) byServiceDept.set(dept.id, emptyStats());
  const records = emptyStats();

  const registered = state.patients.filter((patient) =>
    inDashboardPeriod(patient.folderCreatedAt ?? patient.createdAt, period),
  );
  records.registration = registered.length;
  records.visits = registered.length;
  records.checkIns = registered.length;
  for (const patient of registered) {
    if (patient.insuranceType === 'GOVERNMENT') records.nhis += 1;
    if (isPrivatePayer(patient.insuranceType)) records.private += 1;
  }

  hospital.registration = registered.length;

  for (const visit of visits) {
    const patient = patients.get(visit.patientId);
    const newReg = isNewRegistration(patient, visit, period);
    addVisitToStats(hospital, patient, false);
    const clinicStats = byClinic.get(visit.clinic ?? 'GENERAL');
    if (clinicStats) addVisitToStats(clinicStats, patient, newReg);

    const depts = new Set(visit.orders.map((order) => order.department));
    if (visit.stage === 'CHECKED_IN' || visit.stage === 'VITALS_DONE') depts.add('NURSING');
    for (const dept of SERVICE_DEPARTMENTS) {
      if (!depts.has(dept.id)) continue;
      const row = byServiceDept.get(dept.id);
      if (row) addVisitToStats(row, patient, newReg);
    }
  }

  hospital.checkIns = visits.length;
  hospital.visits = visits.length;
  hospital.nhis = visits.filter((visit) => patients.get(visit.patientId)?.insuranceType === 'GOVERNMENT').length;
  hospital.private = visits.filter((visit) => isPrivatePayer(patients.get(visit.patientId)?.insuranceType)).length;

  const departments: DepartmentStatRow[] = [
    { id: 'RECORDS', label: 'Records / registration', ...records },
    ...CLINICS.map((clinic) => ({
      id: clinic.id,
      label: CLINIC_LABELS[clinic.id],
      ...(byClinic.get(clinic.id) ?? emptyStats()),
    })),
    ...SERVICE_DEPARTMENTS.map((dept) => ({
      id: dept.id,
      label: dept.label,
      ...(byServiceDept.get(dept.id) ?? emptyStats()),
    })),
  ];

  return { period, hospital, departments, trend: buildDashboardTrend(state, period, patients) };
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function buildDashboardTrend(
  state: CareState,
  period: DashboardPeriod,
  patientsMap?: Map<string, PatientRecord>,
): TrendPoint[] {
  const patients = patientsMap ?? patientById(state.patients);
  const buckets: TrendPoint[] = [];

  if (period === 'today') {
    for (let hour = 0; hour <= 23; hour += 1) {
      buckets.push({ label: hourLabel(hour), ...emptyStats() });
    }
    for (const visit of state.visits) {
      if (!inDashboardPeriod(visit.checkedInAt, 'today')) continue;
      const hour = new Date(visit.checkedInAt).getHours();
      addVisitToStats(buckets[hour], patients.get(visit.patientId), false);
    }
    for (const patient of state.patients) {
      const opened = patient.folderCreatedAt ?? patient.createdAt;
      if (!inDashboardPeriod(opened, 'today')) continue;
      const hour = new Date(opened).getHours();
      buckets[hour].registration += 1;
    }
    return buckets;
  }

  const today = startOfToday();
  const keys: string[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    keys.push(dayKey(date));
    buckets.push({ label: dayLabel(date), ...emptyStats() });
  }

  for (const visit of state.visits) {
    const index = keys.indexOf(dayKey(new Date(visit.checkedInAt)));
    if (index < 0) continue;
    addVisitToStats(buckets[index], patients.get(visit.patientId), false);
  }
  for (const patient of state.patients) {
    const opened = patient.folderCreatedAt ?? patient.createdAt;
    const index = keys.indexOf(dayKey(new Date(opened)));
    if (index < 0) continue;
    buckets[index].registration += 1;
  }

  return buckets;
}
