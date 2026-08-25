import { CLINIC_LABELS, CLINICS } from './catalog';
import { visitBalance } from './billing';
import { isLowStock } from './pharmacyStock';
import { moneyBooks } from './accounts';
import { itDeskStats } from './itDesk';
import { theatreStats } from './theatre';
import { accountantInboxTotals, claimDeskStats, storeStats } from './supportDesks';
import type { PageKey } from './permissions';
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

export const PAGE_DASHBOARD_DEPARTMENT: Partial<Record<PageKey, Department>> = {
  reception: 'RECORDS',
  nursing: 'NURSING',
  doctor: 'CONSULTATION',
  lab: 'LAB',
  pharmacy: 'PHARMACY',
  xray: 'RADIOLOGY',
  physio: 'PHYSIO',
  dental: 'DENTAL',
  eye: 'EYE',
  ent: 'ENT',
  maternity: 'MATERNITY',
  theatre: 'THEATRE',
  ward: 'WARD',
  triage: 'NURSING',
  claims: 'CLAIMS',
  stores: 'STORES',
  procurement: 'PROCUREMENT',
  it: 'IT',
};

export const PAGE_DASHBOARD_TITLE: Record<PageKey, string> = {
  dashboard: 'Hospital dashboard',
  admin: 'Hospital dashboard',
  reception: 'Reception dashboard',
  nursing: 'Nursing dashboard',
  doctor: 'Doctor dashboard',
  lab: 'Laboratory dashboard',
  pharmacy: 'Pharmacy dashboard',
  xray: 'Imaging dashboard',
  physio: 'Physiotherapy dashboard',
  dental: 'Dental dashboard',
  eye: 'Eye clinic dashboard',
  ent: 'ENT dashboard',
  maternity: 'Maternity dashboard',
  theatre: 'Theatre dashboard',
  ward: 'Ward dashboard',
  triage: 'ED triage dashboard',
  billing: 'Accounts dashboard',
  collections: 'Collections dashboard',
  claims: 'Claims dashboard',
  stores: 'Stores dashboard',
  procurement: 'Procurement dashboard',
  it: 'IT support dashboard',
  chart: 'Patient chart dashboard',
  appointments: 'Appointments dashboard',
  messages: 'Messages dashboard',
  shifts: 'Shifts dashboard',
  assistant: 'Assistant dashboard',
  clinical: 'Clinical chart dashboard',
};

export interface PageDashboardCard {
  key: string;
  label: string;
  value: number;
  hint: string;
}

export interface PageDashboardSnapshot extends DashboardSnapshot {
  page: PageKey;
  title: string;
  cards: PageDashboardCard[];
  department?: Department;
  hospitalWide: boolean;
}

function openVisits(state: CareState) {
  return state.visits.filter((visit) => visit.stage !== 'COMPLETED');
}

function pendingDeptOrders(state: CareState, department: Department) {
  return state.visits.reduce(
    (sum, visit) => sum + visit.orders.filter((order) => order.department === department && order.status === 'ORDERED').length,
    0,
  );
}

function pageCards(state: CareState, page: PageKey, period: DashboardPeriod, snapshot: DashboardSnapshot): PageDashboardCard[] {
  const periodVisits = state.visits.filter((visit) => inDashboardPeriod(visit.checkedInAt, period));
  const open = openVisits(state);
  const unpaid = state.visits.filter((visit) => visitBalance(visit) > 0).length;
  const hospital: PageDashboardCard[] = [
    { key: 'visits', label: 'Total visits', value: snapshot.hospital.visits, hint: 'Encounters in this period' },
    { key: 'registration', label: 'Registration', value: snapshot.hospital.registration, hint: 'New folders opened' },
    { key: 'nhis', label: 'NHIS', value: snapshot.hospital.nhis, hint: 'Government insurance visits' },
    { key: 'private', label: 'Private', value: snapshot.hospital.private, hint: 'Private or cash patients' },
    { key: 'checkIns', label: 'Total check-ins', value: snapshot.hospital.checkIns, hint: 'Checked in at reception' },
  ];

  if (page === 'admin' || page === 'dashboard') return hospital;

  if (page === 'reception') {
    return [
      { key: 'registration', label: 'Folders opened', value: snapshot.hospital.registration, hint: 'New records folders' },
      { key: 'checkIns', label: 'Check-ins', value: snapshot.hospital.checkIns, hint: 'Visits started' },
      { key: 'open', label: 'Open visits', value: open.length, hint: 'Not yet completed' },
      { key: 'unpaid', label: 'Still owing', value: unpaid, hint: 'Visits with a balance' },
      { key: 'nhis', label: 'NHIS visits', value: snapshot.hospital.nhis, hint: 'Government insurance' },
    ];
  }

  if (page === 'nursing') {
    return [
      { key: 'vitals', label: 'Waiting vitals', value: open.filter((visit) => visit.stage === 'CHECKED_IN').length, hint: 'At the nursing desk' },
      { key: 'ready', label: 'Ready for doctor', value: open.filter((visit) => visit.stage === 'VITALS_DONE').length, hint: 'Vitals already saved' },
      { key: 'work', label: 'Nursing work', value: pendingDeptOrders(state, 'NURSING'), hint: 'Procedures still open' },
      { key: 'checkIns', label: 'Check-ins', value: snapshot.hospital.checkIns, hint: 'This period' },
    ];
  }

  if (page === 'doctor') {
    return [
      { key: 'waiting', label: 'Waiting consult', value: open.filter((visit) => visit.stage === 'VITALS_DONE').length, hint: 'Vitals done' },
      { key: 'with', label: 'With doctor', value: open.filter((visit) => visit.stage === 'WITH_DOCTOR').length, hint: 'Open consults' },
      { key: 'labs', label: 'Lab to review', value: open.filter((visit) => visit.orders.some((order) => order.department === 'LAB' && order.needsDoctorReview)).length, hint: 'Results waiting' },
      { key: 'visits', label: 'Visits', value: snapshot.hospital.visits, hint: 'This period' },
    ];
  }

  if (page === 'theatre') {
    const ot = theatreStats(state);
    return [
      { key: 'scheduled', label: 'Scheduled', value: ot.scheduled, hint: 'Waiting for pre-op and knife-to-skin' },
      { key: 'in', label: 'In theatre', value: ot.inTheatre, hint: 'Procedure underway' },
      { key: 'recovery', label: 'Recovery', value: ot.recovery, hint: 'Post-op observation' },
      { key: 'queue', label: 'Pending orders', value: pendingDeptOrders(state, 'THEATRE'), hint: 'Doctor orders not finished' },
    ];
  }

  if (page === 'lab' || page === 'pharmacy' || page === 'xray' || page === 'physio' || page === 'dental' || page === 'eye' || page === 'ent' || page === 'maternity') {
    const department = PAGE_DASHBOARD_DEPARTMENT[page]!;
    const row = snapshot.departments.find((item) => item.id === department);
    return [
      { key: 'queue', label: 'Pending work', value: pendingDeptOrders(state, department), hint: 'Orders not finished' },
      { key: 'visits', label: 'Visits', value: row?.visits ?? 0, hint: 'This desk this period' },
      { key: 'nhis', label: 'NHIS', value: row?.nhis ?? 0, hint: 'Government insurance' },
      { key: 'private', label: 'Private', value: row?.private ?? 0, hint: 'Private or cash' },
      ...(page === 'pharmacy'
        ? [{ key: 'stock', label: 'Low stock', value: (state.drugStock ?? []).filter((item) => isLowStock(item)).length, hint: 'Items to reorder' }]
        : []),
    ];
  }

  if (page === 'claims') {
    const claims = claimDeskStats(state);
    return [
      { key: 'nhis', label: 'NHIS queue', value: claims.nhis, hint: 'Ghana Card / NHIS visits to work' },
      { key: 'private', label: 'Private queue', value: claims.private, hint: 'Company insurance visits' },
      { key: 'denied', label: 'Denied / query', value: claims.denied, hint: 'Need documents or codes' },
      { key: 'waiting', label: 'Awaiting remittance', value: claims.waitingPay, hint: 'Submitted, not yet paid' },
    ];
  }

  if (page === 'stores') {
    const stores = storeStats(state);
    return [
      { key: 'items', label: 'Store items', value: stores.items, hint: 'Central stock lines' },
      { key: 'low', label: 'Low stock', value: stores.low, hint: 'At or below reorder point' },
      { key: 'issues', label: 'Issues', value: stores.issues, hint: 'Issued to departments' },
      { key: 'orders', label: 'Open orders', value: stores.openOrders, hint: 'Procurement still pending' },
    ];
  }

  if (page === 'procurement') {
    const stores = storeStats(state);
    const open = (state.purchaseOrders ?? []).filter((row) => row.status === 'REQUESTED').length;
    const ordered = (state.purchaseOrders ?? []).filter((row) => row.status === 'ORDERED').length;
    const pharmacy = (state.purchaseOrders ?? []).filter(
      (row) => row.department === 'PHARMACY' && (row.status === 'REQUESTED' || row.status === 'ORDERED'),
    ).length;
    return [
      { key: 'requested', label: 'Requested', value: open, hint: 'Waiting for an LPO' },
      { key: 'ordered', label: 'On order', value: ordered, hint: 'Awaiting goods received' },
      { key: 'pharmacy', label: 'From pharmacy', value: pharmacy, hint: 'Medicines sent by pharmacy' },
      { key: 'low', label: 'Low stock', value: stores.low, hint: 'Stores need a restock' },
    ];
  }

  if (page === 'it') {
    const it = itDeskStats(state);
    return [
      { key: 'tickets', label: 'Open tickets', value: it.open + it.inProgress + it.waiting, hint: 'Not yet resolved' },
      { key: 'staff', label: 'Active users', value: it.active, hint: 'Unlocked staff accounts' },
      { key: 'locked', label: 'Locked', value: it.locked, hint: 'Need a reset or unlock' },
      { key: 'audit', label: 'Audit rows', value: (state.auditLog ?? []).length, hint: 'Read-only incident trail' },
    ];
  }

  if (page === 'billing' || page === 'collections') {
    const inbox = accountantInboxTotals(state);
    const books = moneyBooks(state);
    return [
      { key: 'allocated', label: 'Allocated', value: books.allocated, hint: 'This month’s budget' },
      { key: 'spent', label: 'Spent', value: books.spent, hint: 'Wages and purchases on the books' },
      { key: 'left', label: 'Remaining', value: books.remaining, hint: 'Allocation still unused' },
      { key: 'claims', label: 'Claims remittance', value: inbox.remittanceWaiting, hint: 'Cash still to receive from claims' },
    ];
  }

  if (page === 'ward') {
    const beds = state.beds ?? [];
    return [
      { key: 'occupied', label: 'Beds occupied', value: beds.filter((bed) => bed.status === 'OCCUPIED' || bed.patientId).length, hint: 'Patients on the ward' },
      { key: 'free', label: 'Beds free', value: beds.filter((bed) => bed.status !== 'OCCUPIED' && !bed.patientId).length, hint: 'Empty beds' },
      { key: 'visits', label: 'Visits', value: snapshot.hospital.visits, hint: 'This period' },
    ];
  }

  if (page === 'triage') {
    return [
      { key: 'waiting', label: 'Waiting vitals', value: open.filter((visit) => visit.stage === 'CHECKED_IN').length, hint: 'Need triage or vitals' },
      { key: 'open', label: 'Open visits', value: open.length, hint: 'Still in the hospital' },
      { key: 'checkIns', label: 'Check-ins', value: snapshot.hospital.checkIns, hint: 'This period' },
    ];
  }

  if (page === 'chart') {
    return [
      { key: 'patients', label: 'Folders', value: state.patients.length, hint: 'All patient records' },
      { key: 'open', label: 'Open visits', value: open.length, hint: 'Active encounters' },
      { key: 'visits', label: 'Visits', value: periodVisits.length, hint: 'This period' },
    ];
  }

  if (page === 'appointments') {
    const booked = (state.appointments ?? []).filter((row) => inDashboardPeriod(row.startsAt, period)).length;
    return [
      { key: 'booked', label: 'Booked', value: booked, hint: 'Appointments this period' },
      { key: 'open', label: 'Open visits', value: open.length, hint: 'Patients already in' },
    ];
  }

  if (page === 'messages') {
    return [
      { key: 'messages', label: 'Messages', value: (state.messages ?? []).filter((row) => inDashboardPeriod(row.at, period)).length, hint: 'This period' },
      { key: 'open', label: 'Open visits', value: open.length, hint: 'Patients still here' },
    ];
  }

  if (page === 'shifts') {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const onDuty = (state.shifts ?? []).filter((shift) => shift.day === today).length;
    const thisMonth = (state.shifts ?? []).filter((shift) => shift.day.startsWith(month)).length;
    return [
      { key: 'today', label: 'Shifts today', value: onDuty, hint: 'Rostered for this date' },
      { key: 'month', label: 'This month', value: thisMonth, hint: 'Rostered days this month' },
      { key: 'staff', label: 'Staff', value: state.staff.filter((staff) => staff.isActive).length, hint: 'Active accounts' },
    ];
  }

  return [
    { key: 'visits', label: 'Visits', value: snapshot.hospital.visits, hint: 'This period' },
    { key: 'open', label: 'Open visits', value: open.length, hint: 'Not yet completed' },
  ];
}

export function buildPageDashboard(state: CareState, page: PageKey, period: DashboardPeriod = 'today'): PageDashboardSnapshot {
  const snapshot = buildDashboardSnapshot(state, period);
  const hospitalWide = page === 'admin' || page === 'dashboard';
  const department = PAGE_DASHBOARD_DEPARTMENT[page];
  const departments = hospitalWide
    ? snapshot.departments
    : snapshot.departments.filter((row) => row.id === department || row.id === page.toUpperCase());
  return {
    ...snapshot,
    departments: departments.length > 0 ? departments : snapshot.departments.slice(0, 1),
    page,
    title: PAGE_DASHBOARD_TITLE[page],
    cards: pageCards(state, page, period, snapshot),
    department,
    hospitalWide,
  };
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
