import type {
  AlertSeverity,
  AllergyRecord,
  AppointmentRecord,
  AppointmentStatus,
  AuditEvent,
  BedRecord,
  CareState,
  ClaimStatus,
  ClinicalNoteRecord,
  ClinicId,
  Department,
  HisCollections,
  LabLine,
  MedicationRecord,
  NoteSensitivity,
  PatientRecord,
  ShiftRecord,
  StaffRole,
  VisitRecord,
} from './types';
import { DEPARTMENT_LABELS } from './catalog';
import { canAccessPage } from './permissions';
import { DEFAULT_DRUG_STOCK, ensureDefaultServices, ensureDrugStock } from './pharmacyStock';
import { findByHospitalNo } from './patientDb';
import { visitMissingRequiredCc } from './patientAdmin';
import { ROLE_SALARY_GHS } from './accounts';
import { claimSchemeOf } from './supportDesks';

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function fingerprint(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  return (hash >>> 0).toString(16);
}

export const SESSION_MS = 15 * 60 * 1000;
export const LOGIN_WINDOW_MS = 60_000;
export const LOGIN_MAX_FAILS = 5;

export const DRUG_INTERACTIONS: Array<{ a: string; b: string; detail: string }> = [
  { a: 'ibuprofen', b: 'amlodipine', detail: 'NSAIDs can blunt BP control and raise bleed risk.' },
  { a: 'amoxicillin', b: 'penicillin', detail: 'Penicillin-class cross-reactivity.' },
];

export function emptyHis(): HisCollections {
  return {
    allergies: [],
    problems: [],
    medications: [],
    immunizations: [],
    carePlans: [],
    clinicalNotes: [],
    familyLinks: [],
    appointments: [],
    waitlist: [],
    orderSets: [
      { id: 'set-malaria', name: 'Uncomplicated malaria', serviceIds: ['lab-rdt', 'lab-mp', 'rx-act'] },
      { id: 'set-anc', name: 'ANC labs', serviceIds: ['lab-fbc', 'lab-urine', 'lab-hepb'] },
      { id: 'set-wound', name: 'Wound review', serviceIds: ['nurs-dress-min', 'rx-pcm'] },
    ],
    samples: [],
    imagingStudies: [],
    drugStock: DEFAULT_DRUG_STOCK.map((item) => ({ ...item })),
    controlledLog: [],
    beds: [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `bed-ward-${i + 1}`,
        label: `Ward ${i + 1}`,
        ward: 'WARD' as const,
        status: 'FREE' as const,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `bed-ed-${i + 1}`,
        label: `ED ${i + 1}`,
        ward: 'ED' as const,
        status: 'FREE' as const,
      })),
      { id: 'bed-ot-1', label: 'OT 1', ward: 'OT', status: 'FREE' },
      { id: 'bed-ot-2', label: 'OT 2', ward: 'OT', status: 'FREE' },
    ],
    adtEvents: [],
    marEntries: [],
    ioEntries: [],
    otCases: [],
    triageRecords: [],
    claims: [],
    notifications: [],
    messages: [],
    auditLog: [],
    breakGlass: [],
    supplies: [
      { id: 'sup-glove', name: 'Nitrile gloves (box)', quantity: 40, reorderAt: 10, vendorId: 'ven-med' },
      { id: 'sup-gauze', name: 'Gauze packs', quantity: 25, reorderAt: 8, vendorId: 'ven-med' },
      { id: 'sup-reagent', name: 'Lab reagent pack', quantity: 6, reorderAt: 4, vendorId: 'ven-med' },
      { id: 'sup-linen', name: 'Ward linen set', quantity: 12, reorderAt: 5, vendorId: 'ven-med' },
    ],
    storeIssues: [],
    purchaseOrders: [],
    vendors: [{ id: 'ven-med', name: 'Accra Medical Supplies', phone: '030 222 1100' }],
    assets: [
      { id: 'ast-xray', name: 'Mobile X-ray', location: 'Imaging', nextMaintenance: '2026-10-01', kind: 'OTHER', status: 'IN_USE' },
      { id: 'ast-ot', name: 'OT table', location: 'Theatre', nextMaintenance: '2026-09-15', kind: 'OTHER', status: 'IN_USE' },
      { id: 'ast-pc-rec', name: 'Reception PC', location: 'Records', kind: 'PC', assignedStaffId: 'staff-reception', serial: 'PC-REC-01', status: 'IN_USE' },
      { id: 'ast-prn-rec', name: 'Folder printer', location: 'Records', kind: 'PRINTER', serial: 'HP-LJ-2040', status: 'IN_USE' },
      { id: 'ast-phone-nurs', name: 'Nursing desk phone', location: 'Nursing', kind: 'PHONE', status: 'IN_USE' },
      {
        id: 'ast-lic-win',
        name: 'Windows 11 Pro',
        location: 'IT store',
        kind: 'LICENSE',
        licenseKey: 'XXXXX-XXXXX-XXXXX',
        assignedStaffId: 'staff-it',
        status: 'IN_USE',
      },
    ],
    itTickets: [],
    failedLogins: [],
    shifts: [],
    cashCloses: [],
    budgets: [],
    payroll: [],
    financeAdjustments: [],
    paymentPlans: [],
    vendorInvoices: [],
    bankTxns: [],
    periodLocks: [],
    preAuths: [],
    eobRecords: [],
    handovers: [],
    nextAccessionSeq: 1,
    nextClaimSeq: 1,
    nextPoSeq: 1,
    rolePageGrants: {},
  };
}

export function hydrateHis(state: CareState): CareState {
  const defaults = emptyHis();
  const next: CareState = { ...defaults, ...state };
  (Object.keys(defaults) as Array<keyof HisCollections>).forEach((key) => {
    const value = state[key];
    if (value === undefined || value === null) {
      (next as HisCollections)[key] = defaults[key] as never;
    }
  });
  next.staff = (next.staff ?? []).map((s) => ({
    ...s,
    phone: s.phone || staffPhoneFromId(s.id),
    salaryGhs: Number(s.salaryGhs) > 0 ? s.salaryGhs : ROLE_SALARY_GHS[s.role],
  }));
  next.shifts = (next.shifts ?? []).map((sh) => {
    const worker = next.staff.find((s) => s.id === sh.staffId);
    return {
      ...sh,
      department: sh.department ?? worker?.department ?? 'NURSING',
      createdBy: sh.createdBy ?? 'staff-admin',
      createdAt: sh.createdAt ?? nowIso(),
    };
  });
  next.services = ensureDefaultServices(next.services);
  next.drugStock = ensureDrugStock(next.drugStock);
  next.notifications = Array.isArray(next.notifications) ? next.notifications : [];
  next.itTickets = Array.isArray(next.itTickets) ? next.itTickets : [];
  next.failedLogins = Array.isArray(next.failedLogins) ? next.failedLogins : [];
  next.assets = (next.assets ?? []).map((asset) => ({
    ...asset,
    kind: asset.kind ?? 'OTHER',
    status: asset.status ?? 'IN_USE',
  }));
  next.visits = assignVisitQueueNumbers(next.visits);
  return next;
}

function assignVisitQueueNumbers(visits: VisitRecord[]): VisitRecord[] {
  const days = new Map<string, VisitRecord[]>();
  for (const visit of visits) {
    const day = visit.checkedInAt.slice(0, 10);
    const list = days.get(day) ?? [];
    list.push(visit);
    days.set(day, list);
  }
  const numbers = new Map<string, number>();
  for (const list of days.values()) {
    const sorted = [...list].sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
    let seq = Math.max(0, ...sorted.map((visit) => visit.queueNo ?? 0));
    for (const visit of sorted) {
      if (visit.queueNo) continue;
      seq += 1;
      numbers.set(visit.id, seq);
    }
  }
  if (numbers.size === 0) return visits;
  return visits.map((visit) => (numbers.has(visit.id) ? { ...visit, queueNo: numbers.get(visit.id) } : visit));
}

function staffPhoneFromId(id: string): string {
  const n = [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return `024 ${String(100 + (n % 900)).padStart(3, '0')} ${String(1000 + (n % 9000)).padStart(4, '0')}`;
}

export function seedHis(state: Omit<CareState, keyof HisCollections> & Partial<HisCollections>): CareState {
  const his = emptyHis();
  const later = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString();
  const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
  return {
    ...state,
    ...his,
    patients: state.patients.map((p) => ({
      ...p,
      portalPin: p.portalPin,
    })),
    staff: state.staff.map((s) => ({
      ...s,
      phone: s.phone,
      licenseNo: s.licenseNo ?? (s.role === 'DOCTOR' ? 'MDC-10021' : s.role === 'NURSE' ? 'NMC-44012' : undefined),
      licenseExpires: s.licenseExpires ?? '2027-12-31',
      credentials: s.credentials ?? s.role,
      lastAccessReviewAt: s.lastAccessReviewAt ?? ago(20 * 24 * 60),
    })),
    allergies: [
      {
        id: 'alg-kwame-pen',
        patientId: 'pat-kwame',
        substance: 'Penicillin',
        reaction: 'Anaphylaxis',
        severity: 'severe',
        recordedAt: ago(4000),
        recordedBy: 'staff-doctor',
      },
    ],
    problems: [
      {
        id: 'prb-kwame-htn',
        patientId: 'pat-kwame',
        name: 'Essential hypertension',
        icdHint: 'I10',
        status: 'active',
        recordedAt: ago(4000),
        recordedBy: 'staff-doctor',
      },
    ],
    medications: [
      {
        id: 'med-kwame-amlo',
        patientId: 'pat-kwame',
        name: 'Amlodipine 10mg',
        sig: '1 tab daily',
        drugClass: 'calcium-channel',
        controlled: false,
        status: 'active',
        recordedAt: ago(2000),
        recordedBy: 'staff-doctor',
      },
    ],
    immunizations: [
      {
        id: 'imm-lisa-tt',
        patientId: 'pat-lisa',
        vaccine: 'Tetanus toxoid',
        dose: 'Booster',
        givenAt: ago(200),
        recordedBy: 'staff-nurse',
      },
    ],
    familyLinks: [{ id: 'fam-lisa-parent', patientId: 'pat-lisa', relatedPatientId: 'pat-nina', relationship: 'Guardian' }],
    appointments: [
      {
        id: 'apt-amara-anc',
        patientId: 'pat-amara',
        providerId: 'staff-midwife',
        clinic: 'MATERNITY',
        startsAt: later(24 * 60),
        durationMin: 20,
        reason: 'ANC follow-up',
        status: 'BOOKED',
        resource: 'ANC room 1',
        reminderAt: later(23 * 60),
        createdBy: 'staff-reception',
      },
    ],
    waitlist: [{ id: 'wl-omar', patientId: 'pat-omar', clinic: 'PHYSIO', reason: 'Shoulder physio', createdAt: ago(30) }],
    clinicalNotes: [
      {
        id: 'note-kwame-gen',
        patientId: 'pat-kwame',
        visitId: 'vis-kwame',
        sensitivity: 'GENERAL',
        title: 'OPD consult',
        body: 'Chest tightness. Known hypertensive. Continue amlodipine.',
        createdAt: ago(20),
        createdBy: 'staff-doctor',
      },
      {
        id: 'note-kwame-psych',
        patientId: 'pat-kwame',
        visitId: 'vis-kwame',
        sensitivity: 'PSYCH',
        title: 'Psychosocial note',
        body: 'Reports work-related anxiety. No SI. Follow up with counselling.',
        createdAt: ago(18),
        createdBy: 'staff-doctor',
      },
    ],
    shifts: [
      {
        id: 'sh-n1',
        staffId: 'staff-nurse',
        department: 'NURSING',
        day: new Date().toISOString().slice(0, 10),
        startHour: 7,
        endHour: 19,
        createdBy: 'staff-nursing-head',
        createdAt: ago(40),
        notifiedAt: ago(40),
        emailSent: true,
        smsSent: true,
      },
      {
        id: 'sh-d1',
        staffId: 'staff-doctor',
        department: 'CONSULTATION',
        day: new Date().toISOString().slice(0, 10),
        startHour: 8,
        endHour: 16,
        createdBy: 'staff-consult-head',
        createdAt: ago(40),
        notifiedAt: ago(40),
        emailSent: true,
        smsSent: true,
      },
      {
        id: 'sh-r1',
        staffId: 'staff-reception',
        department: 'RECORDS',
        day: new Date().toISOString().slice(0, 10),
        startHour: 7,
        endHour: 17,
        createdBy: 'staff-records-head',
        createdAt: ago(40),
        notifiedAt: ago(40),
        emailSent: true,
        smsSent: true,
      },
      {
        id: 'sh-lab1',
        staffId: 'staff-lab',
        department: 'LAB',
        day: new Date().toISOString().slice(0, 10),
        startHour: 7,
        endHour: 16,
        createdBy: 'staff-lab-head',
        createdAt: ago(40),
        notifiedAt: ago(40),
        emailSent: true,
        smsSent: true,
      },
      {
        id: 'sh-ph1',
        staffId: 'staff-pharmacy',
        department: 'PHARMACY',
        day: new Date().toISOString().slice(0, 10),
        startHour: 8,
        endHour: 20,
        createdBy: 'staff-pharmacy-head',
        createdAt: ago(40),
        notifiedAt: ago(40),
        emailSent: true,
        smsSent: true,
      },
      {
        id: 'sh-c1',
        staffId: 'staff-cashier',
        department: 'RECORDS',
        day: new Date().toISOString().slice(0, 10),
        startHour: 8,
        endHour: 18,
        createdBy: 'staff-admin',
        createdAt: ago(40),
        notifiedAt: ago(40),
        emailSent: true,
        smsSent: true,
      },
    ],
    claims: [
      {
        id: 'clm-amara',
        visitId: 'vis-amara',
        patientId: 'pat-amara',
        claimNo: 'CLM-00001',
        status: 'SUBMITTED' as const,
        scheme: 'NHIS' as const,
        amountGhs: 130,
        updatedAt: ago(30),
        submittedAt: ago(30),
        submissionRef: 'SUB-AMARA',
        eligibilityDetail: 'Ghana Card GHA-123456789-1 — eligible on file.',
      },
      {
        id: 'clm-kwame',
        visitId: 'vis-kwame',
        patientId: 'pat-kwame',
        claimNo: 'CLM-00002',
        status: 'ELIGIBLE' as const,
        scheme: 'NHIS' as const,
        amountGhs: 80,
        updatedAt: ago(15),
        eligibilityDetail: 'Ghana Card GHA-223456789-2 — eligible on file.',
      },
      {
        id: 'clm-lisa',
        visitId: 'vis-lisa',
        patientId: 'pat-lisa',
        claimNo: 'CLM-00003',
        status: 'DRAFT' as const,
        scheme: 'PRIVATE' as const,
        amountGhs: 60,
        updatedAt: ago(10),
      },
      {
        id: 'clm-nina',
        visitId: 'vis-nina',
        patientId: 'pat-nina',
        claimNo: 'CLM-00004',
        status: 'DENIED' as const,
        scheme: 'NHIS' as const,
        amountGhs: 40,
        denialReason: 'Need antenatal notes and Ghana Card copy.',
        updatedAt: ago(8),
      },
    ],
    nextClaimSeq: 5,
    purchaseOrders: [
      {
        id: 'po-gloves',
        poNo: 'PO-0001',
        itemName: 'Nitrile gloves (box)',
        quantity: 20,
        vendorId: 'ven-med',
        department: 'NURSING' as const,
        status: 'ORDERED' as const,
        requestedBy: 'staff-procurement',
        requestedAt: ago(200),
        orderedAt: ago(180),
        note: 'Ward and OPD restock',
        amountGhs: 180,
      },
      {
        id: 'po-gauze',
        poNo: 'PO-0002',
        itemName: 'Gauze rolls',
        quantity: 15,
        vendorId: 'ven-med',
        department: 'NURSING' as const,
        status: 'REQUESTED' as const,
        requestedBy: 'staff-procurement',
        requestedAt: ago(40),
        note: 'Theatre and dressing rooms',
        amountGhs: 95,
      },
    ],
    nextPoSeq: 3,
    budgets: [
      {
        id: 'bud-month',
        period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        allocatedGhs: 120000,
        note: 'Monthly operating allocation',
        setBy: 'staff-accountant',
        at: ago(200),
      },
    ],
    payroll: [],
    financeAdjustments: [],
    paymentPlans: [],
    vendorInvoices: [
      {
        id: 'vinv-gloves',
        invoiceNo: 'ACC-INV-0041',
        vendorId: 'ven-med',
        poId: 'po-gloves',
        amountGhs: 180,
        category: 'OTHER' as const,
        status: 'MATCHED' as const,
        at: ago(160),
        receivedAt: ago(160),
        note: 'Nitrile gloves — match to PO-0001',
      },
    ],
    bankTxns: [
      {
        id: 'bnk-open',
        at: ago(400),
        amountGhs: 5000,
        direction: 'IN' as const,
        reference: 'Opening transfer GCB',
      },
    ],
    periodLocks: [],
    preAuths: [
      {
        id: 'auth-amara',
        visitId: 'vis-amara',
        payer: 'NHIS',
        ref: 'PA-AMARA-01',
        status: 'APPROVED' as const,
        at: ago(2000),
      },
    ],
    eobRecords: [],
    storeIssues: [
      {
        id: 'iss-lab-glove',
        supplyId: 'sup-glove',
        quantity: 2,
        toDepartment: 'LAB' as const,
        issuedBy: 'staff-stores',
        at: ago(50),
        note: 'Phlebotomy bench',
      },
    ],
    itTickets: [
      {
        id: 'tkt-printer',
        createdAt: ago(90),
        updatedAt: ago(90),
        openedByStaffId: 'staff-reception',
        category: 'PRINTER' as const,
        priority: 'HIGH' as const,
        status: 'OPEN' as const,
        title: 'Reception printer jam',
        detail: 'Folder printer will not feed A4. Queue tickets cannot print.',
        location: 'Records',
      },
      {
        id: 'tkt-login',
        createdAt: ago(40),
        updatedAt: ago(20),
        openedByStaffId: 'staff-nurse',
        assignedToStaffId: 'staff-it',
        category: 'LOGIN' as const,
        priority: 'NORMAL' as const,
        status: 'IN_PROGRESS' as const,
        title: 'Night nurse cannot sign in',
        detail: 'Account locked after the night shift. Need a password reset.',
        location: 'Nursing',
      },
    ],
    failedLogins: [
      {
        id: 'fail-demo-1',
        at: ago(15),
        login: 'nurse',
        reason: 'Wrong password',
      },
    ],
    auditLog: [],
  };
}

export function appendAudit(
  state: CareState,
  input: { staffId: string; action: string; patientId?: string; entity: string; reason?: string },
): CareState {
  const prev = state.auditLog[0]?.hash ?? 'genesis';
  const at = nowIso();
  const payload = JSON.stringify({ ...input, at, prev });
  const event: AuditEvent = {
    id: newId('aud'),
    at,
    staffId: input.staffId,
    action: input.action,
    patientId: input.patientId,
    entity: input.entity,
    reason: input.reason,
    prevHash: prev,
    hash: fingerprint(payload),
  };
  return { ...state, auditLog: [event, ...state.auditLog].slice(0, 2000) };
}

export function notify(
  state: CareState,
  item: Omit<CareState['notifications'][number], 'id' | 'at'> & { at?: string },
): CareState {
  return {
    ...state,
    notifications: [
      { id: newId('ntf'), at: item.at ?? nowIso(), ...item },
      ...state.notifications,
    ].slice(0, 200),
  };
}

export type CdsAlert = { severity: AlertSeverity; title: string; detail: string };

export function evaluateCds(
  state: CareState,
  patientId: string,
  draftRx: string,
  serviceIds: string[] = [],
): CdsAlert[] {
  const alerts: CdsAlert[] = [];
  const blob = `${draftRx} ${serviceIds.join(' ')}`.toLowerCase();
  const allergies = state.allergies.filter((a) => a.patientId === patientId);
  for (const allergy of allergies) {
    const needle = allergy.substance.toLowerCase();
    const hit =
      blob.includes(needle) ||
      (needle.includes('penicillin') && (blob.includes('amox') || blob.includes('penicillin')));
    if (hit) {
      alerts.push({
        severity: allergy.severity === 'severe' ? 'critical' : 'warning',
        title: `Allergy: ${allergy.substance}`,
        detail: `${allergy.reaction} (${allergy.severity})`,
      });
    }
  }
  const meds = state.medications.filter((m) => m.patientId === patientId && m.status === 'active');
  for (const med of meds) {
    for (const rule of DRUG_INTERACTIONS) {
      const medHit = med.name.toLowerCase().includes(rule.a) || med.drugClass.toLowerCase().includes(rule.a);
      const rxHit = blob.includes(rule.b) || blob.includes(rule.a);
      const reverse = med.name.toLowerCase().includes(rule.b) && blob.includes(rule.a);
      if ((medHit && rxHit) || reverse) {
        alerts.push({ severity: 'warning', title: `Interaction: ${med.name}`, detail: rule.detail });
      }
    }
  }
  const expired = (state.drugStock ?? []).filter((d) => new Date(d.expiresOn).getTime() < Date.now() && blob.includes(d.name.split(' ')[0].toLowerCase()));
  for (const stock of expired) {
    alerts.push({ severity: 'warning', title: `Expired stock: ${stock.name}`, detail: `Expiry ${stock.expiresOn}` });
  }
  return alerts;
}

export function findDuplicatePatients(patients: PatientRecord[], candidate: PatientRecord): PatientRecord[] {
  if (candidate.mergedIntoId) return [];
  const name = `${candidate.firstName} ${candidate.lastName}`.toLowerCase();
  return patients.filter((p) => {
    if (p.id === candidate.id || p.mergedIntoId) return false;
    const sameName = `${p.firstName} ${p.lastName}`.toLowerCase() === name;
    const sameDob = Boolean(candidate.dateOfBirth) && p.dateOfBirth === candidate.dateOfBirth;
    const samePhone = Boolean(candidate.phone) && p.phone.replace(/\s/g, '') === candidate.phone.replace(/\s/g, '');
    return (sameName && sameDob) || (sameName && samePhone);
  });
}

export function mergePatients(state: CareState, survivorId: string, duplicateId: string, staffId: string): CareState {
  if (survivorId === duplicateId) return state;
  const move = <T extends { patientId: string }>(rows: T[]) =>
    rows.map((row) => (row.patientId === duplicateId ? { ...row, patientId: survivorId } : row));
  let next: CareState = {
    ...state,
    patients: state.patients.map((p) => (p.id === duplicateId ? { ...p, mergedIntoId: survivorId } : p)),
    visits: state.visits.map((v) => (v.patientId === duplicateId ? { ...v, patientId: survivorId } : v)),
    copayers: (state.copayers ?? []).map((c) => (c.patientId === duplicateId ? { ...c, patientId: survivorId } : c)),
    allergies: move(state.allergies),
    problems: move(state.problems),
    medications: move(state.medications),
    immunizations: move(state.immunizations),
    carePlans: move(state.carePlans),
    clinicalNotes: move(state.clinicalNotes),
    appointments: move(state.appointments),
    waitlist: move(state.waitlist),
    familyLinks: state.familyLinks.map((f) =>
      f.patientId === duplicateId
        ? { ...f, patientId: survivorId }
        : f.relatedPatientId === duplicateId
          ? { ...f, relatedPatientId: survivorId }
          : f,
    ),
  };
  next = appendAudit(next, {
    staffId,
    action: 'merge_patient',
    patientId: survivorId,
    entity: duplicateId,
    reason: 'Duplicate chart merge',
  });
  return next;
}

function canWriteClinicalChart(state: CareState, staffId?: string): boolean {
  if (!staffId) return false;
  const staff = state.staff.find((item) => item.id === staffId);
  if (!staff) return false;
  return canAccessPage(
    {
      role: staff.role,
      department: staff.department,
      extra: staff.permissions?.extra,
      hidden: staff.permissions?.hidden,
      rolePages: state.rolePageGrants?.[staff.role],
    },
    'clinical',
  );
}

export function addAllergy(state: CareState, record: Omit<AllergyRecord, 'id' | 'recordedAt'>): CareState {
  if (!canWriteClinicalChart(state, record.recordedBy)) return state;
  const row: AllergyRecord = { ...record, id: newId('alg'), recordedAt: nowIso() };
  return appendAudit({ ...state, allergies: [row, ...state.allergies] }, {
    staffId: record.recordedBy,
    action: 'write_allergy',
    patientId: record.patientId,
    entity: row.id,
  });
}

export function addProblem(
  state: CareState,
  input: { patientId: string; name: string; icdHint?: string; recordedBy: string },
): CareState {
  if (!canWriteClinicalChart(state, input.recordedBy)) return state;
  if (state.problems.some((p) => p.patientId === input.patientId && p.name.toLowerCase() === input.name.toLowerCase() && p.status === 'active')) {
    return state;
  }
  return {
    ...state,
    problems: [
      {
        id: newId('prb'),
        patientId: input.patientId,
        name: input.name.trim(),
        icdHint: input.icdHint,
        status: 'active',
        recordedAt: nowIso(),
        recordedBy: input.recordedBy,
      },
      ...state.problems,
    ],
  };
}

export function addMedication(
  state: CareState,
  input: Omit<MedicationRecord, 'id' | 'recordedAt' | 'status'> & { status?: MedicationRecord['status'] },
): CareState {
  if (!canWriteClinicalChart(state, input.recordedBy)) return state;
  const row: MedicationRecord = {
    ...input,
    id: newId('med'),
    status: input.status ?? 'active',
    recordedAt: nowIso(),
  };
  return { ...state, medications: [row, ...state.medications] };
}

export function addImmunization(
  state: CareState,
  input: { patientId: string; vaccine: string; dose: string; givenAt: string; recordedBy: string },
): CareState {
  if (!canWriteClinicalChart(state, input.recordedBy)) return state;
  return {
    ...state,
    immunizations: [{ id: newId('imm'), ...input }, ...state.immunizations],
  };
}

export function addClinicalNote(
  state: CareState,
  input: Omit<ClinicalNoteRecord, 'id' | 'createdAt'>,
): CareState {
  if (!canWriteClinicalChart(state, input.createdBy)) return state;
  const row: ClinicalNoteRecord = { ...input, id: newId('note'), createdAt: nowIso() };
  return appendAudit({ ...state, clinicalNotes: [row, ...state.clinicalNotes] }, {
    staffId: input.createdBy,
    action: 'write_note',
    patientId: input.patientId,
    entity: row.sensitivity,
  });
}

export function hasBreakGlass(state: CareState, patientId: string, staffId: string): boolean {
  const stamp = Date.now();
  return state.breakGlass.some(
    (g) => g.patientId === patientId && g.staffId === staffId && new Date(g.expiresAt).getTime() > stamp,
  );
}

export function grantBreakGlass(
  state: CareState,
  input: { patientId: string; staffId: string; reason: string },
): CareState {
  const at = nowIso();
  const row = {
    id: newId('bg'),
    patientId: input.patientId,
    staffId: input.staffId,
    reason: input.reason.trim(),
    at,
    expiresAt: new Date(Date.now() + SESSION_MS).toISOString(),
  };
  return appendAudit({ ...state, breakGlass: [row, ...state.breakGlass] }, {
    staffId: input.staffId,
    action: 'break_glass',
    patientId: input.patientId,
    entity: 'chart',
    reason: input.reason.trim(),
  });
}

export function canReadNote(
  state: CareState,
  note: ClinicalNoteRecord,
  staffId: string,
  role: StaffRole,
): boolean {
  if (note.sensitivity === 'GENERAL') return true;
  if (role === 'ADMIN') return true;
  return hasBreakGlass(state, note.patientId, staffId);
}

export function recordChartAccess(state: CareState, staffId: string, patientId: string): CareState {
  return appendAudit(state, { staffId, action: 'read_chart', patientId, entity: 'patient' });
}

export function afterPlanCare(state: CareState, visitId: string, staffId: string, rxText: string): CareState {
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit) return state;
  let next = state;
  if (visit.diagnosis?.trim()) {
    next = addProblem(next, { patientId: visit.patientId, name: visit.diagnosis.trim(), recordedBy: staffId });
  }
  if (rxText.trim()) {
    next = addMedication(next, {
      patientId: visit.patientId,
      visitId,
      name: rxText.trim().slice(0, 80),
      sig: rxText.trim(),
      drugClass: rxText.toLowerCase().includes('amox') ? 'penicillin' : 'other',
      controlled: false,
      recordedBy: staffId,
    });
    next = {
      ...next,
      marEntries: [
        {
          id: newId('mar'),
          visitId,
          patientId: visit.patientId,
          medicationId: next.medications[0]?.id ?? '',
          dueAt: nowIso(),
          status: 'DUE',
        },
        ...next.marEntries,
      ],
    };
  }
  if (visit.soapPlan?.trim() || visit.notes?.trim()) {
    next = {
      ...next,
      carePlans: [
        {
          id: newId('plan'),
          patientId: visit.patientId,
          visitId,
          goal: visit.disposition ?? 'Follow-up',
          steps: visit.soapPlan || visit.notes || '',
          createdAt: nowIso(),
          createdBy: staffId,
        },
        ...next.carePlans,
      ],
    };
  }
  if (visit.disposition === 'ADMITTED') {
    next = admitVisit(next, visitId, staffId, 'WARD');
  }
  if (visit.orders.some((o) => o.department === 'THEATRE' && o.status === 'ORDERED')) {
    next = scheduleOt(next, visitId, staffId, visit.diagnosis || 'Minor procedure');
  }
  return next;
}

export function admitVisit(state: CareState, visitId: string, staffId: string, ward: BedRecord['ward'] = 'WARD'): CareState {
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit) return state;
  const bed = state.beds.find((b) => b.ward === ward && b.status === 'FREE');
  if (!bed) {
    return notify(state, {
      audience: 'staff',
      title: 'No free bed',
      body: `Cannot admit — no free ${ward} bed.`,
      kind: 'system',
    });
  }
  const beds = state.beds.map((b) =>
    b.id === bed.id ? { ...b, status: 'OCCUPIED' as const, patientId: visit.patientId, visitId } : b,
  );
  const visits = state.visits.map((v) => (v.id === visitId ? { ...v, bedId: bed.id, disposition: 'ADMITTED' as const } : v));
  const adt = {
    id: newId('adt'),
    visitId,
    patientId: visit.patientId,
    type: 'ADMIT' as const,
    bedId: bed.id,
    at: nowIso(),
    staffId,
  };
  return appendAudit({ ...state, beds, visits, adtEvents: [adt, ...state.adtEvents] }, {
    staffId,
    action: 'adt_admit',
    patientId: visit.patientId,
    entity: bed.id,
  });
}

export function dischargeVisit(state: CareState, visitId: string, staffId: string): CareState {
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit?.bedId) return state;
  const beds = state.beds.map((b) =>
    b.id === visit.bedId ? { ...b, status: 'CLEANING' as const, patientId: undefined, visitId: undefined } : b,
  );
  const adt = {
    id: newId('adt'),
    visitId,
    patientId: visit.patientId,
    type: 'DISCHARGE' as const,
    bedId: visit.bedId,
    at: nowIso(),
    staffId,
  };
  return {
    ...state,
    beds,
    visits: state.visits.map((v) => (v.id === visitId ? { ...v, bedId: undefined } : v)),
    adtEvents: [adt, ...state.adtEvents],
  };
}

export function transferBed(state: CareState, visitId: string, bedId: string, staffId: string): CareState {
  const visit = state.visits.find((v) => v.id === visitId);
  const bed = state.beds.find((b) => b.id === bedId && b.status === 'FREE');
  if (!visit || !bed) return state;
  const beds = state.beds.map((b) => {
    if (b.id === visit.bedId) return { ...b, status: 'CLEANING' as const, patientId: undefined, visitId: undefined };
    if (b.id === bedId) return { ...b, status: 'OCCUPIED' as const, patientId: visit.patientId, visitId };
    return b;
  });
  return {
    ...state,
    beds,
    visits: state.visits.map((v) => (v.id === visitId ? { ...v, bedId } : v)),
    adtEvents: [
      { id: newId('adt'), visitId, patientId: visit.patientId, type: 'TRANSFER', bedId, at: nowIso(), staffId },
      ...state.adtEvents,
    ],
  };
}

export function markMar(state: CareState, marId: string, status: 'GIVEN' | 'HELD' | 'REFUSED', staffId: string): CareState {
  return {
    ...state,
    marEntries: state.marEntries.map((m) =>
      m.id === marId ? { ...m, status, givenAt: nowIso(), givenBy: staffId } : m,
    ),
  };
}

export function addIo(
  state: CareState,
  input: { visitId: string; patientId: string; kind: 'IN' | 'OUT'; amountMl: number; note: string; staffId: string },
): CareState {
  return {
    ...state,
    ioEntries: [
      { id: newId('io'), at: nowIso(), ...input },
      ...state.ioEntries,
    ],
  };
}

export function bookAppointment(
  state: CareState,
  input: Omit<AppointmentRecord, 'id' | 'status' | 'reminderSent'> & { status?: AppointmentStatus },
): CareState {
  const clash = state.appointments.some(
    (a) =>
      a.providerId === input.providerId &&
      a.status !== 'CANCELLED' &&
      a.status !== 'NO_SHOW' &&
      a.startsAt === input.startsAt,
  );
  if (clash) return state;
  const row: AppointmentRecord = {
    ...input,
    id: newId('apt'),
    status: input.status ?? 'BOOKED',
    reminderAt: input.reminderAt ?? new Date(new Date(input.startsAt).getTime() - 60 * 60 * 1000).toISOString(),
  };
  return notify({ ...state, appointments: [row, ...state.appointments] }, {
    audience: 'patient',
    patientId: input.patientId,
    title: 'Appointment booked',
    body: `${input.reason} at ${new Date(input.startsAt).toLocaleString()}`,
    kind: 'reminder',
  });
}

export function setAppointmentStatus(state: CareState, id: string, status: AppointmentStatus): CareState {
  return {
    ...state,
    appointments: state.appointments.map((a) => (a.id === id ? { ...a, status } : a)),
  };
}

export function addWaitlist(state: CareState, patientId: string, clinic: ClinicId, reason: string): CareState {
  return {
    ...state,
    waitlist: [{ id: newId('wl'), patientId, clinic, reason, createdAt: nowIso() }, ...state.waitlist],
  };
}

export function sendDueReminders(state: CareState): CareState {
  const stamp = Date.now();
  let next = state;
  for (const apt of state.appointments) {
    if (apt.reminderSent || !apt.reminderAt) continue;
    if (new Date(apt.reminderAt).getTime() > stamp) continue;
    next = {
      ...next,
      appointments: next.appointments.map((a) => (a.id === apt.id ? { ...a, reminderSent: true } : a)),
    };
    next = notify(next, {
      audience: 'patient',
      patientId: apt.patientId,
      title: 'Appointment reminder',
      body: `Please come for ${apt.reason} on ${new Date(apt.startsAt).toLocaleString()}.`,
      kind: 'reminder',
    });
  }
  return next;
}

export const SHIFT_PRESETS: Array<{ id: string; label: string; startHour: number; endHour: number }> = [
  { id: 'morning', label: 'Morning 07:00–15:00', startHour: 7, endHour: 15 },
  { id: 'afternoon', label: 'Afternoon 15:00–23:00', startHour: 15, endHour: 23 },
  { id: 'night', label: 'Night 19:00–07:00', startHour: 19, endHour: 7 },
  { id: 'day', label: 'Day 08:00–16:00', startHour: 8, endHour: 16 },
];

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatShiftHours(startHour: number, endHour: number): string {
  const overnight = endHour <= startHour ? ' (overnight)' : '';
  return `${hourLabel(startHour)}–${hourLabel(endHour)}${overnight}`;
}

export function staffForDepartment(state: CareState, department: Department) {
  return state.staff.filter((s) => s.isActive && s.department === department);
}

function shiftSpans(startHour: number, endHour: number): Array<[number, number]> {
  if (endHour > startHour) return [[startHour * 60, endHour * 60]];
  return [
    [startHour * 60, 24 * 60],
    [0, endHour * 60],
  ];
}

export function shiftsOverlap(
  a: { startHour: number; endHour: number },
  b: { startHour: number; endHour: number },
): boolean {
  for (const [s1, e1] of shiftSpans(a.startHour, a.endHour)) {
    for (const [s2, e2] of shiftSpans(b.startHour, b.endHour)) {
      if (s1 < e2 && s2 < e1) return true;
    }
  }
  return false;
}

export function shiftNoticeText(
  staff: { firstName: string; lastName: string },
  shift: Pick<ShiftRecord, 'day' | 'startHour' | 'endHour' | 'note'>,
  departmentLabel: string,
): string {
  const note = shift.note?.trim() ? ` Note: ${shift.note.trim()}` : '';
  return `Hello ${staff.firstName} ${staff.lastName}, you are scheduled for ${departmentLabel} on ${shift.day} ${formatShiftHours(shift.startHour, shift.endHour)}.${note}`;
}

export function scheduleShift(
  state: CareState,
  input: {
    staffId: string;
    department: Department;
    day: string;
    startHour: number;
    endHour: number;
    note?: string;
    createdBy: string;
  },
): { state: CareState; error?: string; shift?: ShiftRecord } {
  const worker = state.staff.find((s) => s.id === input.staffId && s.isActive);
  if (!worker) return { state, error: 'Choose an active worker in this department.' };
  if (worker.department && worker.department !== input.department) {
    return { state, error: 'That worker belongs to another department.' };
  }
  if (!input.day) return { state, error: 'Pick a date.' };
  const clash = state.shifts.some(
    (sh) =>
      sh.staffId === input.staffId &&
      sh.day === input.day &&
      shiftsOverlap(sh, { startHour: input.startHour, endHour: input.endHour }),
  );
  if (clash) return { state, error: 'That worker already has an overlapping shift on this day.' };
  const shift: ShiftRecord = {
    id: newId('sh'),
    staffId: input.staffId,
    department: input.department,
    day: input.day,
    startHour: input.startHour,
    endHour: input.endHour,
    note: input.note?.trim() || undefined,
    createdBy: input.createdBy,
    createdAt: nowIso(),
  };
  let next: CareState = { ...state, shifts: [shift, ...state.shifts].slice(0, 2000) };
  next = notify(next, {
    audience: 'staff',
    staffId: worker.id,
    title: 'Shift scheduled',
    body: shiftNoticeText(worker, shift, DEPARTMENT_LABELS[input.department]),
    kind: 'shift',
  });
  next = appendAudit(next, {
    staffId: input.createdBy,
    action: 'schedule_shift',
    entity: shift.id,
    reason: `${worker.firstName} ${worker.lastName} ${input.day} ${formatShiftHours(input.startHour, input.endHour)}`,
  });
  return { state: next, shift };
}

export function cancelShift(state: CareState, shiftId: string, staffId: string): CareState {
  const shift = state.shifts.find((s) => s.id === shiftId);
  if (!shift) return state;
  let next: CareState = { ...state, shifts: state.shifts.filter((s) => s.id !== shiftId) };
  next = notify(next, {
    audience: 'staff',
    staffId: shift.staffId,
    title: 'Shift cancelled',
    body: `Your ${shift.day} ${formatShiftHours(shift.startHour, shift.endHour)} shift was cancelled.`,
    kind: 'shift',
  });
  next = appendAudit(next, { staffId, action: 'cancel_shift', entity: shiftId });
  return next;
}

export function pendingShiftNotices(state: CareState): ShiftRecord[] {
  return state.shifts.filter((sh) => !sh.notifiedAt);
}

export function pendingShiftMessages(state: CareState) {
  return state.notifications.filter((n) => n.kind === 'shift' && n.staffId && !n.deliveredAt);
}

export function markNoticeDelivered(
  state: CareState,
  noticeId: string,
  flags: { emailSent: boolean; smsSent: boolean },
): CareState {
  const notice = state.notifications.find((n) => n.id === noticeId);
  let next: CareState = {
    ...state,
    notifications: state.notifications.map((n) => (n.id === noticeId ? { ...n, deliveredAt: nowIso() } : n)),
  };
  if (notice?.title === 'Shift scheduled' && notice.staffId) {
    const shift = next.shifts.find((sh) => sh.staffId === notice.staffId && !sh.notifiedAt);
    if (shift) next = markShiftNotified(next, shift.id, flags);
  }
  return next;
}

export function markShiftNotified(
  state: CareState,
  shiftId: string,
  flags: { emailSent: boolean; smsSent: boolean },
): CareState {
  return {
    ...state,
    shifts: state.shifts.map((sh) =>
      sh.id === shiftId ? { ...sh, notifiedAt: nowIso(), emailSent: flags.emailSent, smsSent: flags.smsSent } : sh,
    ),
  };
}

export function afterLabResults(
  state: CareState,
  visitId: string,
  updates: Array<{ orderId: string; result?: string; labLines?: LabLine[] }>,
  staffId: string,
): CareState {
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit) return state;
  let next = state;
  let seq = next.nextAccessionSeq || 1;
  for (const update of updates) {
    const order = visit.orders.find((o) => o.id === update.orderId);
    if (!order) continue;
    const accessionNo = `ACC-${String(seq).padStart(5, '0')}`;
    seq += 1;
    next = {
      ...next,
      visits: next.visits.map((v) =>
        v.id !== visitId
          ? v
          : { ...v, orders: v.orders.map((o) => (o.id === order.id ? { ...o, accessionNo } : o)) },
      ),
      samples: [
        { id: newId('smp'), visitId, orderId: order.id, accessionNo, collectedAt: nowIso(), collectedBy: staffId },
        ...next.samples,
      ],
    };
    const critical = (update.labLines ?? []).some((line) => isCriticalLine(line));
    if (critical) {
      next = notify(next, {
        audience: 'staff',
        staffId: 'staff-doctor',
        patientId: visit.patientId,
        title: 'Critical lab value',
        body: `${order.name} (${accessionNo}) needs acknowledgement.`,
        kind: 'critical',
      });
      next = appendAudit(next, {
        staffId,
        action: 'critical_lab',
        patientId: visit.patientId,
        entity: accessionNo,
      });
    }
  }
  return { ...next, nextAccessionSeq: seq };
}

export function isCriticalLine(line: LabLine): boolean {
  const v = line.value.toLowerCase();
  if (['reactive', 'positive'].includes(v) && /hiv|hbsag|hcg/i.test(line.name) === false && /hiv/i.test(line.name)) return true;
  if (/hiv/i.test(line.name) && v === 'reactive') return true;
  if (/hb\b/i.test(line.name) && Number(line.value) > 0 && Number(line.value) < 7) return true;
  if (line.flag === 'H' && /potassium|k\+/i.test(line.name) && Number(line.value) >= 6) return true;
  return line.flag === 'H' && /hiv|hbsag/i.test(line.name);
}

export function afterImaging(state: CareState, visitId: string, orderId: string, report: string): CareState {
  const visit = state.visits.find((v) => v.id === visitId);
  const order = visit?.orders.find((o) => o.id === orderId);
  if (!visit || !order) return state;
  return {
    ...state,
    imagingStudies: [
      {
        id: newId('img'),
        visitId,
        orderId,
        modality: order.name,
        report,
        dicomUid: `1.2.840.demo.${Date.now()}`,
        createdAt: nowIso(),
      },
      ...state.imagingStudies,
    ],
  };
}

function hasUnreadStockAlert(state: CareState, title: string, name: string): boolean {
  return state.notifications.some((note) => !note.read && note.kind === 'stock' && note.title === title && note.body.includes(name));
}

export function dispenseStock(
  state: CareState,
  input: { serviceId: string; quantity: number; visitId: string; staffId: string; witness?: string },
): CareState {
  const stock =
    (state.drugStock ?? []).find((d) => d.serviceId === input.serviceId && !d.controlled) ??
    (state.drugStock ?? []).find((d) => d.serviceId === input.serviceId);
  if (!stock || stock.quantity < input.quantity) {
    const name = stock?.name ?? input.serviceId;
    if (hasUnreadStockAlert(state, 'Out of stock', name)) return state;
    return notify(state, {
      audience: 'staff',
      title: 'Out of stock',
      body: `${name} cannot be dispensed. Quantity on the shelf is ${stock?.quantity ?? 0}. Reorder now.`,
      kind: 'stock',
    });
  }
  const remaining = stock.quantity - input.quantity;
  let next: CareState = {
    ...state,
    drugStock: state.drugStock.map((d) => (d.id === stock.id ? { ...d, quantity: remaining } : d)),
  };
  if (stock.controlled) {
    next = {
      ...next,
      controlledLog: [
        {
          id: newId('ctl'),
          stockId: stock.id,
          visitId: input.visitId,
          quantity: input.quantity,
          witness: input.witness?.trim() || 'unwitnessed',
          staffId: input.staffId,
          at: nowIso(),
        },
        ...next.controlledLog,
      ],
    };
  }
  if (remaining === 0 && !hasUnreadStockAlert(next, 'Out of stock', stock.name)) {
    next = notify(next, {
      audience: 'staff',
      title: 'Out of stock',
      body: `${stock.name} is now out of stock. Reorder immediately.`,
      kind: 'stock',
    });
  } else if (remaining > 0 && remaining <= stock.reorderAt && !hasUnreadStockAlert(next, 'Low stock', stock.name)) {
    next = notify(next, {
      audience: 'staff',
      title: 'Low stock',
      body: `${stock.name} is down to ${remaining} (reorder at ${stock.reorderAt}).`,
      kind: 'stock',
    });
  }
  return next;
}

export function afterPharmacyDispense(state: CareState, visitId: string, orderId: string, staffId: string): CareState {
  const visit = state.visits.find((item) => item.id === visitId);
  const order = visit?.orders.find((item) => item.id === orderId);
  if (!order || order.department !== 'PHARMACY' || order.serviceId === 'rx-dispense') return state;
  return dispenseStock(state, { serviceId: order.serviceId, quantity: 1, visitId, staffId });
}

export function scheduleOt(state: CareState, visitId: string, staffId: string, procedure: string): CareState {
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit) return state;
  if (state.otCases.some((c) => c.visitId === visitId)) return state;
  const ot = state.beds.find((b) => b.ward === 'OT' && b.status === 'FREE');
  return {
    ...state,
    otCases: [
      {
        id: newId('ot'),
        visitId,
        patientId: visit.patientId,
        procedure,
        startsAt: nowIso(),
        otBedId: ot?.id ?? 'bed-ot-1',
        preopDone: false,
        surgicalNotes: '',
        anesthesia: '',
        status: 'SCHEDULED',
      },
      ...state.otCases,
    ],
  };
}

export function updateOt(
  state: CareState,
  id: string,
  patch: Partial<Pick<CareState['otCases'][number], 'preopDone' | 'surgicalNotes' | 'anesthesia' | 'status'>>,
): CareState {
  return { ...state, otCases: state.otCases.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

export function recordTriage(
  state: CareState,
  input: { visitId: string; esi: 1 | 2 | 3 | 4 | 5; complaint: string; staffId: string },
): CareState {
  const visit = state.visits.find((v) => v.id === input.visitId);
  if (!visit) return state;
  let next: CareState = {
    ...state,
    visits: state.visits.map((v) => (v.id === input.visitId ? { ...v, esiScore: input.esi } : v)),
    triageRecords: [
      {
        id: newId('esi'),
        visitId: input.visitId,
        patientId: visit.patientId,
        esi: input.esi,
        complaint: input.complaint,
        at: nowIso(),
        staffId: input.staffId,
      },
      ...state.triageRecords,
    ],
  };
  if (input.esi <= 2) {
    next = admitVisit(next, input.visitId, input.staffId, 'ED');
  }
  return next;
}

export function upsertClaim(
  state: CareState,
  input: { visitId: string; status?: ClaimStatus; denialReason?: string },
): CareState {
  const visit = state.visits.find((v) => v.id === input.visitId);
  if (!visit) return state;
  const patient = state.patients.find((p) => p.id === visit.patientId);
  if (input.status === 'SUBMITTED' && visitMissingRequiredCc(patient, visit)) return state;
  const existing = state.claims.find((c) => c.visitId === input.visitId);
  const amount = visit.orders.filter((o) => o.chargeable !== false).reduce((sum, o) => sum + o.priceGhs, 0);
  const scheme = existing?.scheme ?? claimSchemeOf(patient);
  if (existing) {
    const submitted = input.status === 'SUBMITTED';
    return {
      ...state,
      claims: state.claims.map((c) =>
        c.id === existing.id
          ? {
              ...c,
              status: input.status ?? c.status,
              scheme: scheme ?? c.scheme,
              denialReason: input.denialReason,
              amountGhs: amount,
              updatedAt: nowIso(),
              submittedAt: submitted ? nowIso() : c.submittedAt,
              submissionRef: submitted ? c.submissionRef ?? `SUB-${Date.now()}` : c.submissionRef,
              eligibilityDetail: input.status === 'ELIGIBLE' ? verifyEligibility(state, visit.patientId).detail : c.eligibilityDetail,
            }
          : c,
      ),
    };
  }
  const seq = state.nextClaimSeq || 1;
  const submitted = (input.status ?? 'DRAFT') === 'SUBMITTED';
  return {
    ...state,
    nextClaimSeq: seq + 1,
    claims: [
      {
        id: newId('clm'),
        visitId: visit.id,
        patientId: visit.patientId,
        claimNo: `CLM-${String(seq).padStart(5, '0')}`,
        status: input.status ?? 'DRAFT',
        scheme,
        amountGhs: amount,
        updatedAt: nowIso(),
        submittedAt: submitted ? nowIso() : undefined,
        submissionRef: submitted ? `SUB-${Date.now()}` : undefined,
        eligibilityDetail: verifyEligibility(state, visit.patientId).detail,
      },
      ...state.claims,
    ],
  };
}

export function verifyEligibility(state: CareState, patientId: string): { ok: boolean; detail: string } {
  const patient = state.patients.find((p) => p.id === patientId);
  if (!patient) return { ok: false, detail: 'Unknown patient' };
  const number = (patient.insuranceNumber ?? '').replace(/\s/g, '');
  if (patient.insuranceType === 'GOVERNMENT') {
    const ghanaId = (patient.ghanaCardNo ?? patient.hinNumber ?? number).replace(/\s/g, '');
    if (!/^[A-Z0-9-]{8,24}$/i.test(ghanaId)) {
      return { ok: false, detail: 'NHIS / Ghana Card / HIN missing or invalid.' };
    }
    const via = patient.ghanaCardNo ? `Ghana Card ${patient.ghanaCardNo}` : number ? `NHIS ${number}` : `HIN ${patient.hinNumber}`;
    return { ok: true, detail: `${via} — eligible on file.` };
  }
  if (patient.insuranceType === 'PRIVATE') {
    if (!patient.insuranceProvider?.trim() || !/^[A-Z0-9-]{6,24}$/i.test(number)) {
      return { ok: false, detail: 'Private policy number or insurer missing.' };
    }
    return { ok: true, detail: `${patient.insuranceProvider} ${number} — eligible on file.` };
  }
  return { ok: false, detail: 'Cash / no cover — bill the patient.' };
}

export function buildClaimPack(state: CareState, visitId: string) {
  const visit = state.visits.find((v) => v.id === visitId);
  const patient = visit ? state.patients.find((p) => p.id === visit.patientId) : undefined;
  const claim = state.claims.find((c) => c.visitId === visitId);
  const eligibility = patient ? verifyEligibility(state, patient.id) : { ok: false, detail: 'Unknown patient' };
  return {
    format: 'CMS-CLAIM-JSON-1',
    generatedAt: nowIso(),
    eligibility,
    claim: claim ?? null,
    patient: patient
      ? {
          hospitalNo: patient.hospitalNo,
          name: `${patient.firstName} ${patient.lastName}`,
          insuranceType: patient.insuranceType,
          insuranceProvider: patient.insuranceProvider,
          insuranceNumber: patient.insuranceNumber,
          ghanaCardNo: patient.ghanaCardNo,
          hinNumber: patient.hinNumber,
        }
      : null,
    visit: visit
      ? {
          id: visit.id,
          checkedInAt: visit.checkedInAt,
          diagnosis: visit.diagnosis,
          clinic: visit.clinic,
          orders: visit.orders
            .filter((o) => o.chargeable !== false)
            .map((o) => ({ name: o.name, department: o.department, amountGhs: o.priceGhs })),
        }
      : null,
  };
}

export function sendMessage(
  state: CareState,
  input: { fromId: string; body: string; toRole?: StaffRole; toId?: string },
): CareState {
  return {
    ...state,
    messages: [{ id: newId('msg'), at: nowIso(), ...input, body: input.body.trim() }, ...state.messages],
  };
}

export function addFamilyLink(
  state: CareState,
  input: { patientId: string; relatedPatientId: string; relationship: FamilyLinkRecordRelationship; recordedBy?: string },
): CareState {
  if (!canWriteClinicalChart(state, input.recordedBy)) return state;
  if (input.patientId === input.relatedPatientId) return state;
  return {
    ...state,
    familyLinks: [
      {
        id: newId('fam'),
        patientId: input.patientId,
        relatedPatientId: input.relatedPatientId,
        relationship: input.relationship,
      },
      ...state.familyLinks,
    ],
  };
}

type FamilyLinkRecordRelationship = CareState['familyLinks'][number]['relationship'];

export function occupancy(state: CareState): { ward: string; used: number; total: number }[] {
  const groups = ['WARD', 'ED', 'OT'] as const;
  return groups.map((ward) => {
    const beds = state.beds.filter((b) => b.ward === ward);
    return { ward, used: beds.filter((b) => b.status === 'OCCUPIED').length, total: beds.length };
  });
}

export function qualityMetrics(state: CareState) {
  const completed = state.visits.filter((v) => v.stage === 'COMPLETED');
  const readmit = completed.filter((v) =>
    state.visits.some(
      (other) =>
        other.patientId === v.patientId &&
        other.id !== v.id &&
        other.checkedInAt > v.completedAt! &&
        new Date(other.checkedInAt).getTime() - new Date(v.completedAt!).getTime() < 72 * 3600_000,
    ),
  ).length;
  const noShows = state.appointments.filter((a) => a.status === 'NO_SHOW').length;
  const criticals = state.notifications.filter((n) => n.kind === 'critical').length;
  return {
    visits: state.visits.length,
    completed: completed.length,
    readmit72h: readmit,
    noShows,
    criticalLabs: criticals,
    occupancy: occupancy(state),
  };
}

export function exportFhirPatient(state: CareState, patientId: string): object {
  const patient = state.patients.find((p) => p.id === patientId);
  if (!patient) return { resourceType: 'OperationOutcome', issue: [{ diagnostics: 'not found' }] };
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: nowIso(),
    entry: [
      {
        resource: {
          resourceType: 'Patient',
          id: patient.id,
          identifier: [{ system: 'urn:cms:mrn', value: patient.hospitalNo }],
          name: [{ family: patient.lastName, given: [patient.firstName] }],
          gender: patient.gender.toLowerCase(),
          birthDate: patient.dateOfBirth,
          telecom: [{ system: 'phone', value: patient.phone }],
        },
      },
      ...state.allergies
        .filter((a) => a.patientId === patientId)
        .map((a) => ({
          resource: {
            resourceType: 'AllergyIntolerance',
            id: a.id,
            code: { text: a.substance },
            reaction: [{ manifestation: [{ text: a.reaction }] }],
          },
        })),
    ],
  };
}

export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function arAging(state: CareState) {
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
  const stamp = Date.now();
  for (const visit of state.visits) {
    if (visit.billable === false || visit.stage === 'COMPLETED') continue;
    const unpaid = visit.orders.filter((o) => o.chargeable !== false && !o.paidAt);
    if (unpaid.length === 0) continue;
    const amount = unpaid.reduce((sum, o) => sum + o.priceGhs, 0);
    const ageDays = (stamp - new Date(visit.checkedInAt).getTime()) / 86400000;
    if (ageDays < 30) buckets.current += amount;
    else if (ageDays < 60) buckets.d30 += amount;
    else if (ageDays < 90) buckets.d60 += amount;
    else buckets.d90 += amount;
  }
  return buckets;
}

export function visitTaxAmount(visit: VisitRecord): number {
  const percent = visit.taxPercent ?? 0;
  if (!percent) return 0;
  const net = visit.orders.filter((o) => o.chargeable !== false).reduce((sum, o) => sum + o.priceGhs, 0);
  return Math.round(net * percent) / 100;
}

export function authenticatePatient(state: CareState, hospitalNo: string, pin: string): PatientRecord | null {
  const patient = findByHospitalNo(state.patients, hospitalNo);
  if (!patient || patient.mergedIntoId) return null;
  if (!patient.portalPin || patient.portalPin !== pin.trim()) return null;
  return patient;
}

export function purgePatientHis(state: CareState, patientId: string): CareState {
  const drop = <T extends { patientId?: string }>(rows: T[]) => rows.filter((row) => row.patientId !== patientId);
  return {
    ...state,
    allergies: drop(state.allergies),
    problems: drop(state.problems),
    medications: drop(state.medications),
    immunizations: drop(state.immunizations),
    carePlans: drop(state.carePlans),
    clinicalNotes: drop(state.clinicalNotes),
    familyLinks: state.familyLinks.filter((f) => f.patientId !== patientId && f.relatedPatientId !== patientId),
    appointments: drop(state.appointments),
    waitlist: drop(state.waitlist),
  };
}

export function recordLoginAttempt(ok: boolean): { locked: boolean; remaining: number } {
  const key = 'cms_login_guard';
  const raw = sessionStorage.getItem(key);
  const now = Date.now();
  let data = { fails: 0, windowStart: now };
  try {
    if (raw) data = JSON.parse(raw) as typeof data;
  } catch {
    data = { fails: 0, windowStart: now };
  }
  if (now - data.windowStart > LOGIN_WINDOW_MS) data = { fails: 0, windowStart: now };
  if (ok) {
    sessionStorage.removeItem(key);
    return { locked: false, remaining: LOGIN_MAX_FAILS };
  }
  data.fails += 1;
  sessionStorage.setItem(key, JSON.stringify(data));
  return { locked: data.fails >= LOGIN_MAX_FAILS, remaining: Math.max(0, LOGIN_MAX_FAILS - data.fails) };
}

export function isLoginLocked(): boolean {
  const raw = sessionStorage.getItem('cms_login_guard');
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as { fails: number; windowStart: number };
    return data.fails >= LOGIN_MAX_FAILS && Date.now() - data.windowStart < LOGIN_WINDOW_MS;
  } catch {
    return false;
  }
}
