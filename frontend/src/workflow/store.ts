import { hydrateHis } from './his';
import { createSeedState, ensureDemoStaff } from './seed';
import {
  ensureHospitalNumbers,
  findByHospitalNo,
  formatManualFolderNo,
  issueHospitalNo,
  loadPatientDatabase,
  mergePatientRecords,
  savePatientDatabase,
} from './patientDb';
import type {
  CareState,
  ClinicId,
  CopayerRecord,
  CopayerRelationship,
  Department,
  Gender,
  HospitalService,
  InsuranceType,
  LabLine,
  PatientRecord,
  ServiceOrder,
  StaffAccount,
  StaffRole,
  VisitDisposition,
  VisitRecord,
} from './types';
import { formatReceiptNo, getClinic } from './catalog';
import { ageFromDob } from './patientAdmin';
import { evaluateVitals, type VitalsInput } from './vitals';

export const CARE_STORAGE_KEY = 'cms_care_workflow_v6';
const LEGACY_CARE_KEYS = ['cms_care_workflow_v5', 'cms_care_workflow_v4'];

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function persistPatients(state: CareState): CareState {
  const ensured = ensureHospitalNumbers(state.patients, state.nextHospitalSeq || 1);
  const visits = state.visits.map((visit) => ({ ...visit, clinic: visit.clinic ?? 'GENERAL' }));
  const next: CareState = {
    ...state,
    patients: ensured.patients,
    visits,
    copayers: state.copayers ?? [],
    nextHospitalSeq: Math.max(state.nextHospitalSeq || 1, ensured.nextSeq),
    nextReceiptSeq: state.nextReceiptSeq || 1,
  };
  savePatientDatabase({ patients: next.patients, nextSeq: next.nextHospitalSeq });
  return next;
}

function readStoredCare(): string | null {
  const current = localStorage.getItem(CARE_STORAGE_KEY);
  if (current) return current;
  for (const key of LEGACY_CARE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) return raw;
  }
  return null;
}

export function loadCareState(): CareState {
  const seeded = createSeedState();
  const registry = loadPatientDatabase();
  try {
    const raw = readStoredCare();
    if (!raw) {
      const patients = registry ? mergePatientRecords(registry.patients, seeded.patients) : seeded.patients;
      return saveCareState({
        ...seeded,
        patients,
        nextHospitalSeq: Math.max(seeded.nextHospitalSeq, registry?.nextSeq ?? 1),
      });
    }
    const parsed = JSON.parse(raw) as CareState;
    if (
      !Array.isArray(parsed.patients) ||
      !Array.isArray(parsed.visits) ||
      !Array.isArray(parsed.staff) ||
      !Array.isArray(parsed.services)
    ) {
      return saveCareState(seeded);
    }
    const patients = registry ? mergePatientRecords(registry.patients, parsed.patients) : parsed.patients;
    return saveCareState(
      hydrateHis({
        ...seeded,
        ...parsed,
        staff: ensureDemoStaff(parsed.staff),
        patients,
        copayers: Array.isArray(parsed.copayers) && parsed.copayers.length > 0 ? parsed.copayers : seeded.copayers,
        nextHospitalSeq: Math.max(parsed.nextHospitalSeq || 1, registry?.nextSeq ?? 1),
      }),
    );
  } catch {
    return saveCareState(seeded);
  }
}

export function saveCareState(state: CareState): CareState {
  const next = persistPatients(state);
  localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function resetCareState(): CareState {
  const seeded = createSeedState();
  const registry = loadPatientDatabase();
  const kept = registry ? mergePatientRecords(registry.patients, seeded.patients) : seeded.patients;
  return saveCareState({
    ...seeded,
    patients: kept,
    nextHospitalSeq: Math.max(seeded.nextHospitalSeq, registry?.nextSeq ?? 1),
  });
}

function orderFromService(
  service: HospitalService,
  status: ServiceOrder['status'] = 'ORDERED',
  chargeable = true,
): ServiceOrder {
  return {
    id: newId('ord'),
    serviceId: service.id,
    name: service.name,
    department: service.department,
    priceGhs: service.priceGhs,
    status,
    chargeable,
  };
}

function addServiceIfMissing(
  visit: VisitRecord,
  services: HospitalService[],
  serviceId: string,
  status: ServiceOrder['status'],
  chargeable = true,
): VisitRecord {
  if (visit.orders.some((o) => o.serviceId === serviceId)) return visit;
  const service = services.find((s) => s.id === serviceId && s.enabled);
  if (!service) return visit;
  return { ...visit, orders: [...visit.orders, orderFromService(service, status, chargeable)] };
}

function startVisit(
  state: CareState,
  patientId: string,
  reason: string,
  staffId: string,
  clinicId: ClinicId = 'GENERAL',
  copayerId?: string,
): VisitRecord {
  const clinic = getClinic(clinicId);
  let visit: VisitRecord = {
    id: newId('vis'),
    patientId,
    clinic: clinic.id,
    reason: reason.trim(),
    stage: clinic.flow === 'opd' ? 'CHECKED_IN' : 'AWAITING_SERVICES',
    checkedInAt: new Date().toISOString(),
    checkedInBy: staffId,
    orders: [],
    copayerId,
  };
  if (clinic.flow === 'clinic') {
    visit = addServiceIfMissing(visit, state.services, clinic.serviceId, 'ORDERED', false);
  }
  return visit;
}

function nextStageAfterOrders(visit: VisitRecord): VisitRecord['stage'] {
  const pendingLab = visit.orders.some((o) => o.department === 'LAB' && o.status === 'ORDERED');
  if (visit.orders.some((o) => o.needsDoctorReview) && !pendingLab) return 'WITH_DOCTOR';
  const pending = visit.orders.filter((o) => o.status === 'ORDERED');
  return pending.length > 0 ? 'AWAITING_SERVICES' : 'READY_TO_BILL';
}

export function unreviewedLabOrders(visit: VisitRecord) {
  return visit.orders.filter((o) => o.department === 'LAB' && o.status === 'DONE' && o.needsDoctorReview);
}

export function labResults(visit: VisitRecord) {
  return visit.orders.filter((o) => o.department === 'LAB' && o.status === 'DONE' && Boolean(o.result));
}

function isFolderOnlyVisit(visit: VisitRecord): boolean {
  return (
    visit.reason === 'New patient folder' ||
    visit.reason === 'Open patient folder' ||
    (visit.stage === 'READY_TO_BILL' && visit.orders.length > 0 && visit.orders.every((o) => o.department === 'RECORDS'))
  );
}

export type PatientAdminInput = {
  firstName: string;
  lastName: string;
  age?: number;
  dateOfBirth?: string;
  gender: Gender;
  phone: string;
  email?: string;
  address?: string;
  town?: string;
  insuranceType?: InsuranceType;
  insuranceProvider?: string;
  insuranceNumber?: string;
  hospitalNo?: string;
  folderDate?: string;
  portalPin?: string;
  relatedStaffId?: string;
  staffRelation?: CopayerRelationship | 'Self';
  staffId: string;
};

function patientFromInput(input: PatientAdminInput, hospitalNo: string, now: string): PatientRecord {
  const dateOfBirth = input.dateOfBirth?.trim() || undefined;
  const folderCreatedAt = input.folderDate ? new Date(`${input.folderDate}T08:00:00`).toISOString() : now;
  return {
    id: newId('pat'),
    hospitalNo,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    age: dateOfBirth ? ageFromDob(dateOfBirth) : Number(input.age) || 0,
    dateOfBirth,
    gender: input.gender,
    phone: input.phone.trim(),
    email: input.email?.trim() || undefined,
    address: input.address?.trim() || undefined,
    town: input.town?.trim() || undefined,
    insuranceType: input.insuranceType,
    insuranceProvider: input.insuranceType === 'CASH' ? undefined : input.insuranceProvider?.trim() || undefined,
    insuranceNumber: input.insuranceType === 'CASH' ? undefined : input.insuranceNumber?.trim() || undefined,
    relatedStaffId: input.relatedStaffId || undefined,
    staffRelation: input.relatedStaffId ? input.staffRelation : undefined,
    createdAt: now,
    folderCreatedAt: Number.isNaN(new Date(folderCreatedAt).getTime()) ? now : folderCreatedAt,
    folderCreatedBy: input.staffId,
  };
}

export type CreateFolderResult = { state: CareState; hospitalNo: string } | { state: CareState; error: string };

export function createPatientFolder(state: CareState, input: PatientAdminInput): CareState {
  return allocatePatientFolder(state, input).state;
}

export function allocatePatientFolder(state: CareState, input: PatientAdminInput): CreateFolderResult {
  const issued = input.hospitalNo?.trim()
    ? { hospitalNo: formatManualFolderNo(input.hospitalNo, input.folderDate), nextSeq: state.nextHospitalSeq }
    : issueHospitalNo(state.nextHospitalSeq, state.patients);
  if (!issued.hospitalNo) return { state, error: 'Enter a folder number.' };
  if (findByHospitalNo(state.patients, issued.hospitalNo)) {
    return { state, error: `Folder number ${issued.hospitalNo} is already allocated.` };
  }
  const now = new Date().toISOString();
  const patient = {
    ...patientFromInput(input, issued.hospitalNo, now),
    portalPin: input.portalPin?.trim() || newPortalPin(),
  };
  return {
    hospitalNo: issued.hospitalNo,
    state: {
      ...state,
      nextHospitalSeq: issued.nextSeq,
      patients: [patient, ...state.patients],
    },
  };
}

export function newPortalPin(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export function openPatientFolder(state: CareState, patientId: string, staffId: string): CareState {
  const patient = state.patients.find((p) => p.id === patientId);
  if (!patient || patient.folderCreatedAt) return state;
  const now = new Date().toISOString();
  return {
    ...state,
    patients: state.patients.map((p) =>
      p.id === patientId ? { ...p, folderCreatedAt: now, folderCreatedBy: staffId } : p,
    ),
  };
}

export function registerPatient(
  state: CareState,
  input: PatientAdminInput & { reason: string; clinic?: ClinicId; copayerId?: string },
): CareState {
  const withFolder = createPatientFolder(state, input);
  const patient = withFolder.patients[0];
  if (!patient) return withFolder;
  return checkInExisting(withFolder, patient.id, input.reason, input.staffId, input.clinic ?? 'GENERAL', input.copayerId);
}

export function checkInByHospitalNo(
  state: CareState,
  hospitalNo: string,
  reason: string,
  staffId: string,
  clinic: ClinicId = 'GENERAL',
  copayerId?: string,
): CareState {
  const patient = findByHospitalNo(state.patients, hospitalNo);
  if (!patient) return state;
  return checkInExisting(state, patient.id, reason, staffId, clinic, copayerId);
}

export function checkInExisting(
  state: CareState,
  patientId: string,
  reason: string,
  staffId: string,
  clinicId: ClinicId = 'GENERAL',
  copayerId?: string,
): CareState {
  const clinic = getClinic(clinicId);
  const active = state.visits.find((v) => v.patientId === patientId && v.stage !== 'COMPLETED');
  if (active) {
    if (!isFolderOnlyVisit(active) && active.clinic) {
      return {
        ...state,
        visits: state.visits.map((visit) =>
          visit.id === active.id ? { ...visit, copayerId: copayerId ?? visit.copayerId } : visit,
        ),
      };
    }
    let next: VisitRecord = {
      ...active,
      clinic: clinic.id,
      reason: reason.trim(),
      copayerId: copayerId ?? active.copayerId,
      stage: clinic.flow === 'opd' ? 'CHECKED_IN' : 'AWAITING_SERVICES',
    };
    if (clinic.flow === 'clinic') {
      next = addServiceIfMissing(next, state.services, clinic.serviceId, 'ORDERED', false);
    }
    return {
      ...state,
      visits: state.visits.map((visit) => (visit.id === active.id ? next : visit)),
    };
  }

  const patient = state.patients.find((p) => p.id === patientId);
  const visit = startVisit(state, patientId, reason, staffId, clinicId, copayerId);
  const patients =
    patient && !patient.folderCreatedAt
      ? state.patients.map((p) =>
          p.id === patientId ? { ...p, folderCreatedAt: visit.checkedInAt, folderCreatedBy: staffId } : p,
        )
      : state.patients;
  return { ...state, patients, visits: [visit, ...state.visits] };
}

export function recordVitals(state: CareState, visitId: string, vitals: VitalsInput, staffId: string): CareState {
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id !== visitId || visit.stage !== 'CHECKED_IN') return visit;
      return {
        ...visit,
        stage: 'VITALS_DONE',
        vitalsDoneAt: new Date().toISOString(),
        vitals: {
          ...vitals,
          abnormalFlags: evaluateVitals(vitals),
          recordedAt: new Date().toISOString(),
          recordedBy: staffId,
        },
      };
    }),
  };
}

export function sendToDoctor(state: CareState, visitId: string): CareState {
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id !== visitId || visit.stage !== 'VITALS_DONE') return visit;
      const clinic = getClinic(visit.clinic);
      const now = new Date().toISOString();
      if (clinic.flow === 'clinic') {
        return addServiceIfMissing(
          { ...visit, stage: 'AWAITING_SERVICES', withDoctorAt: now },
          state.services,
          clinic.serviceId,
          'ORDERED',
          false,
        );
      }
      return { ...visit, stage: 'WITH_DOCTOR', withDoctorAt: now };
    }),
  };
}

export function planCare(
  state: CareState,
  visitId: string,
  input: {
    diagnosis: string;
    prescription: string;
    notes: string;
    disposition: VisitDisposition;
    referredTo?: string;
    serviceIds: string[];
    soapSubjective?: string;
    soapObjective?: string;
    soapAssessment?: string;
    soapPlan?: string;
    taxPercent?: number;
    cdsOverride?: boolean;
  },
): CareState {
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id !== visitId || visit.stage !== 'WITH_DOCTOR') return visit;
      const extra = input.serviceIds
        .map((id) => state.services.find((s) => s.id === id && s.enabled))
        .filter((s): s is HospitalService => Boolean(s))
        .filter((s) => !visit.orders.some((o) => o.serviceId === s.id))
        .map((s) => orderFromService(s, 'ORDERED'));
      let next: VisitRecord = {
        ...visit,
        diagnosis: input.diagnosis.trim(),
        prescription: input.prescription.trim(),
        notes: input.notes.trim(),
        soapSubjective: input.soapSubjective?.trim() || undefined,
        soapObjective: input.soapObjective?.trim() || undefined,
        soapAssessment: input.soapAssessment?.trim() || visit.diagnosis,
        soapPlan: input.soapPlan?.trim() || undefined,
        taxPercent: input.taxPercent,
        disposition: input.disposition,
        referredTo: input.disposition === 'REFERRED' ? input.referredTo?.trim() : undefined,
        orders: [...visit.orders, ...extra].map((order) =>
          order.needsDoctorReview ? { ...order, needsDoctorReview: false } : order,
        ),
      };
      if (input.prescription.trim() && !next.orders.some((o) => o.serviceId === 'rx-dispense')) {
        next = addServiceIfMissing(next, state.services, 'rx-dispense', 'ORDERED');
      }
      next = { ...next, stage: nextStageAfterOrders(next) };
      return next;
    }),
  };
}

export function addCharges(
  state: CareState,
  visitId: string,
  serviceIds: string[],
  status: ServiceOrder['status'] = 'DONE',
): CareState {
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id !== visitId || visit.stage === 'COMPLETED') return visit;
      let next = visit;
      for (const id of serviceIds) {
        next = addServiceIfMissing(next, state.services, id, status);
      }
      if (next.stage === 'READY_TO_BILL' && next.orders.some((o) => o.status === 'ORDERED')) {
        next = { ...next, stage: 'AWAITING_SERVICES' };
      }
      return next;
    }),
  };
}

export function completeOrder(
  state: CareState,
  visitId: string,
  orderId: string,
  result?: string,
  labLines?: LabLine[],
): CareState {
  const now = new Date().toISOString();
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id !== visitId) return visit;
      const orders = visit.orders.map((o) =>
        o.id === orderId && o.status === 'ORDERED'
          ? {
              ...o,
              status: 'DONE' as const,
              result: result?.trim() || o.result,
              labLines: labLines ?? o.labLines,
              completedAt: now,
              needsDoctorReview: o.department === 'LAB' ? true : o.needsDoctorReview,
            }
          : o,
      );
      const next = { ...visit, orders };
      const staged =
        visit.stage === 'AWAITING_SERVICES' || visit.stage === 'WITH_DOCTOR'
          ? { ...next, stage: nextStageAfterOrders(next) }
          : next;
      const payer = staged.orders.find((o) => o.paidBy)?.paidBy ?? '';
      return settleVisitAfterPayment(staged, payer, now);
    }),
  };
}

export function completeOrders(
  state: CareState,
  visitId: string,
  updates: Array<{ orderId: string; result?: string; labLines?: LabLine[] }>,
): CareState {
  return updates.reduce(
    (next, update) => completeOrder(next, visitId, update.orderId, update.result, update.labLines),
    state,
  );
}

function settleVisitAfterPayment(visit: VisitRecord, staffId: string, now: string): VisitRecord {
  const allDone = visit.orders.every((o) => o.status === 'DONE');
  const payable = visit.billable === false ? [] : visit.orders.filter((o) => o.chargeable !== false);
  const allPaid = payable.every((o) => o.paidAt);
  const waitingForBillingDecision = visit.billable === undefined && payable.length === 0;
  if (waitingForBillingDecision) return visit;
  if (visit.orders.some((o) => o.needsDoctorReview) && visit.stage !== 'COMPLETED') {
    const pendingLab = visit.orders.some((o) => o.department === 'LAB' && o.status === 'ORDERED');
    if (!pendingLab) return { ...visit, stage: 'WITH_DOCTOR' };
  }
  if (allDone && allPaid && (visit.stage === 'AWAITING_SERVICES' || visit.stage === 'READY_TO_BILL')) {
    return { ...visit, stage: 'COMPLETED', completedAt: now, paidAt: now, paidBy: staffId };
  }
  if (allDone && visit.stage === 'AWAITING_SERVICES') {
    return { ...visit, stage: 'READY_TO_BILL' };
  }
  return visit;
}

export function removeCharge(state: CareState, visitId: string, orderId: string): CareState {
  const now = new Date().toISOString();
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id !== visitId) return visit;
      const orders = visit.orders.map((order) =>
        order.id === orderId && !order.paidAt ? { ...order, chargeable: false } : order,
      );
      return settleVisitAfterPayment({ ...visit, orders }, visit.paidBy ?? '', now);
    }),
  };
}

export function applyVisitBilling(
  state: CareState,
  visitId: string,
  input: { billable: boolean; serviceIds: string[]; waivedReason?: string; staffId: string },
): CareState {
  const now = new Date().toISOString();
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id !== visitId || visit.stage === 'COMPLETED') return visit;
      if (!input.billable) {
        return settleVisitAfterPayment(
          {
            ...visit,
            billable: false,
            waivedReason: input.waivedReason?.trim() || 'Not billed',
            billingDecidedAt: now,
            billingDecidedBy: input.staffId,
            orders: visit.orders.map((order) => ({ ...order, chargeable: false })),
          },
          input.staffId,
          now,
        );
      }
      let next: VisitRecord = {
        ...visit,
        billable: true,
        waivedReason: undefined,
        billingDecidedAt: now,
        billingDecidedBy: input.staffId,
        orders: visit.orders.map((order) => ({
          ...order,
          chargeable: input.serviceIds.includes(order.serviceId),
        })),
      };
      for (const id of input.serviceIds) {
        next = addServiceIfMissing(next, state.services, id, 'DONE', true);
        next = {
          ...next,
          orders: next.orders.map((order) =>
            order.serviceId === id ? { ...order, chargeable: true } : order,
          ),
        };
      }
      return next;
    }),
  };
}

export function payOrders(state: CareState, visitId: string, orderIds: string[], staffId: string): CareState {
  const now = new Date().toISOString();
  const idSet = new Set(orderIds);
  let seq = state.nextReceiptSeq || 1;
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id !== visitId || visit.stage === 'COMPLETED') return visit;
      const orders = visit.orders.map((o) =>
        idSet.has(o.id) && !o.paidAt ? { ...o, paidAt: now, paidBy: staffId } : o,
      );
      const newlyPaid = orders.some((o) => idSet.has(o.id) && o.paidAt && !visit.orders.find((prev) => prev.id === o.id)?.paidAt);
      let next: VisitRecord = { ...visit, orders };
      if (newlyPaid && !next.receiptNo) {
        next = { ...next, receiptNo: formatReceiptNo(seq) };
        seq += 1;
      }
      return settleVisitAfterPayment(next, staffId, now);
    }),
    nextReceiptSeq: seq,
  };
}

export function payBill(state: CareState, visitId: string, staffId: string): CareState {
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit || visit.stage === 'COMPLETED') return state;
  return payOrders(
    state,
    visitId,
    visit.orders.filter((o) => !o.paidAt).map((o) => o.id),
    staffId,
  );
}

export function collectAndCompleteOrder(
  state: CareState,
  visitId: string,
  orderId: string,
  staffId: string,
  result?: string,
): CareState {
  return payOrders(completeOrder(state, visitId, orderId, result), visitId, [orderId], staffId);
}

export function setServiceEnabled(state: CareState, serviceId: string, enabled: boolean): CareState {
  return {
    ...state,
    services: state.services.map((s) => (s.id === serviceId ? { ...s, enabled } : s)),
  };
}

export function setServicePrice(state: CareState, serviceId: string, priceGhs: number): CareState {
  return {
    ...state,
    services: state.services.map((s) => (s.id === serviceId ? { ...s, priceGhs } : s)),
  };
}

export function ordersForDepartment(visits: VisitRecord[], department: Department) {
  return visits.flatMap((visit) =>
    visit.orders
      .filter((o) => o.department === department && o.status === 'ORDERED')
      .map((order) => ({ visit, order })),
  );
}

export function groupOrdersByVisit(items: Array<{ visit: VisitRecord; order: ServiceOrder }>) {
  const groups: Array<{ visit: VisitRecord; orders: ServiceOrder[] }> = [];
  for (const item of items) {
    const existing = groups.find((group) => group.visit.id === item.visit.id);
    if (existing) existing.orders.push(item.order);
    else groups.push({ visit: item.visit, orders: [item.order] });
  }
  return groups;
}

export function completeVisit(
  state: CareState,
  visitId: string,
  input: {
    diagnosis: string;
    prescription: string;
    notes: string;
    disposition: VisitDisposition;
    referredTo?: string;
  },
): CareState {
  return planCare(state, visitId, { ...input, serviceIds: [] });
}

export function upsertPatient(state: CareState, patient: PatientRecord): CareState {
  const exists = state.patients.some((p) => p.id === patient.id);
  return {
    ...state,
    patients: exists
      ? state.patients.map((p) => (p.id === patient.id ? patient : p))
      : [patient, ...state.patients],
  };
}

export function deletePatient(state: CareState, patientId: string): CareState {
  return {
    ...state,
    patients: state.patients.filter((p) => p.id !== patientId),
    visits: state.visits.filter((v) => v.patientId !== patientId),
    copayers: (state.copayers ?? []).filter((c) => c.patientId !== patientId),
  };
}

export function upsertCopayer(
  state: CareState,
  input: {
    id?: string;
    patientId: string;
    firstName: string;
    lastName: string;
    relationship: CopayerRelationship;
    phone: string;
    address?: string;
    isPrimary?: boolean;
  },
): CareState {
  const now = new Date().toISOString();
  const copayers = state.copayers ?? [];
  const id = input.id ?? newId('pay');
  const record: CopayerRecord = {
    id,
    patientId: input.patientId,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    relationship: input.relationship,
    phone: input.phone.trim(),
    address: input.address?.trim() || undefined,
    isPrimary: Boolean(input.isPrimary),
    createdAt: copayers.find((c) => c.id === id)?.createdAt ?? now,
  };
  const others = copayers.filter((c) => c.id !== id);
  const next = record.isPrimary
    ? others.map((c) => (c.patientId === record.patientId ? { ...c, isPrimary: false } : c))
    : others;
  return { ...state, copayers: [record, ...next] };
}

export function deleteCopayer(state: CareState, copayerId: string): CareState {
  return {
    ...state,
    copayers: (state.copayers ?? []).filter((c) => c.id !== copayerId),
    visits: state.visits.map((visit) => (visit.copayerId === copayerId ? { ...visit, copayerId: undefined } : visit)),
  };
}

export function copayersForPatient(copayers: CopayerRecord[] | undefined, patientId: string): CopayerRecord[] {
  return (copayers ?? []).filter((c) => c.patientId === patientId);
}

export function upsertStaff(state: CareState, staff: StaffAccount): CareState {
  const exists = state.staff.some((s) => s.id === staff.id);
  return {
    ...state,
    staff: exists ? state.staff.map((s) => (s.id === staff.id ? staff : s)) : [...state.staff, staff],
  };
}

export function createStaff(
  state: CareState,
  input: {
    email: string;
    firstName: string;
    lastName: string;
    role: StaffRole;
    password: string;
    inChargeOf?: Department;
    department?: Department;
    phone?: string;
    permissions?: StaffAccount['permissions'];
  },
): CareState {
  const email = input.email.trim().toLowerCase();
  if (state.staff.some((s) => s.email === email)) return state;
  const staff: StaffAccount = {
    id: newId('staff'),
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role: input.role,
    password: input.password,
    isActive: true,
    createdAt: new Date().toISOString(),
    department: input.department,
    inChargeOf: input.inChargeOf,
    phone: input.phone?.trim() || undefined,
    permissions: input.permissions,
  };
  return { ...state, staff: [...state.staff, staff] };
}

export function authenticateStaff(
  state: CareState,
  email: string,
  password: string,
): StaffAccount | 'invalid' | null {
  const staff = state.staff.find((s) => s.email === email.trim().toLowerCase() && s.isActive);
  if (!staff) return null;
  if (staff.password !== password) return 'invalid';
  return staff;
}

export function deleteStaff(state: CareState, staffId: string): CareState {
  if (staffId === 'staff-admin') return state;
  return { ...state, staff: state.staff.filter((s) => s.id !== staffId) };
}

export function visitsToday(visits: VisitRecord[]): VisitRecord[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return visits.filter((v) => new Date(v.checkedInAt) >= start);
}

export function averageWaitMinutes(visits: VisitRecord[]): number | null {
  const completed = visitsToday(visits).filter((v) => v.completedAt);
  if (completed.length === 0) return null;
  const total = completed.reduce((sum, v) => {
    const start = new Date(v.checkedInAt).getTime();
    const end = new Date(v.completedAt!).getTime();
    return sum + (end - start);
  }, 0);
  return Math.round(total / completed.length / 60_000);
}

export function staffActivity(state: CareState): { staffId: string; name: string; actions: number }[] {
  return state.staff.map((staff) => {
    const checkIns = state.visits.filter((v) => v.checkedInBy === staff.id).length;
    const vitals = state.visits.filter((v) => v.vitals?.recordedBy === staff.id).length;
    const consults = state.visits.filter(
      (v) => v.stage === 'COMPLETED' && staff.role === 'DOCTOR' && v.completedAt,
    ).length;
    const actions =
      staff.role === 'RECEPTIONIST'
        ? checkIns
        : staff.role === 'NURSE'
          ? vitals
          : staff.role === 'DOCTOR'
            ? consults
            : checkIns + vitals + consults;
    return {
      staffId: staff.id,
      name: `${staff.firstName} ${staff.lastName}`,
      actions,
    };
  });
}

export function searchPatients(patients: PatientRecord[], query: string): PatientRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return patients;
  const exact = findByHospitalNo(patients, query);
  const matches = patients.filter(
    (p) =>
      p.hospitalNo.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.phone.includes(q),
  );
  if (exact && !matches.some((p) => p.id === exact.id)) return [exact, ...matches];
  if (exact) return [exact, ...matches.filter((p) => p.id !== exact.id)];
  return matches;
}

export function patientName(patients: PatientRecord[], patientId: string): string {
  const p = patients.find((x) => x.id === patientId);
  return p ? `${p.firstName} ${p.lastName} (${p.hospitalNo})` : 'Unknown patient';
}
