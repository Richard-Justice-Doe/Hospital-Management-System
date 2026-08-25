import type {
  CareState,
  Department,
  ExternalReceiptRecord,
  PatientDepositRecord,
  PayMethod,
  ServiceOrder,
  StaffRole,
  VisitRecord,
} from './types';
import { ROLE_BILLABLE_DEPARTMENTS, matronDepartments } from './types';
import { formatReceiptNo } from './catalog';

export function canReceivePayment(role?: StaffRole | null): boolean {
  return role === 'CASHIER';
}

export function canRemoveBill(
  user?: { role: StaffRole; inChargeOf?: Department } | null,
  department?: Department,
): boolean {
  if (!user || user.role === 'CASHIER') return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'MATRON') return !department || matronDepartments().includes(department);
  if (!user.inChargeOf) return false;
  return !department || user.inChargeOf === department;
}

export type CollectionPeriod = 'day' | 'month' | 'year' | 'all';

export function orderIsPaid(order: ServiceOrder): boolean {
  return Boolean(order.paidAt);
}

export function billableDepartmentsFor(role: StaffRole): Department[] | 'ALL' {
  return ROLE_BILLABLE_DEPARTMENTS[role];
}

export function unpaidOrders(visit: VisitRecord, departments: Department[] | 'ALL' = 'ALL'): ServiceOrder[] {
  if (visit.billable === false) return [];
  return visit.orders.filter((order) => {
    if (order.chargeable === false) return false;
    if (orderIsPaid(order)) return false;
    if (departments === 'ALL') return true;
    return departments.includes(order.department);
  });
}

export function unpaidTotal(orders: Pick<ServiceOrder, 'priceGhs' | 'paidAt'>[]): number {
  return orders.filter((order) => !order.paidAt).reduce((sum, order) => sum + order.priceGhs, 0);
}

export function visitBalance(visit: VisitRecord, departments: Department[] | 'ALL' = 'ALL'): number {
  return unpaidOrders(visit, departments).reduce((sum, order) => sum + order.priceGhs, 0);
}

export function isInpatientVisit(visit: VisitRecord): boolean {
  return visit.disposition === 'ADMITTED' || Boolean(visit.bedId);
}

export function billLineQty(order: Pick<ServiceOrder, 'qty'>): number {
  return Math.max(1, Math.floor(order.qty ?? 1));
}

export function billLineUnitPrice(order: Pick<ServiceOrder, 'priceGhs' | 'qty' | 'unitPriceGhs'>): number {
  if (typeof order.unitPriceGhs === 'number' && Number.isFinite(order.unitPriceGhs)) return order.unitPriceGhs;
  return Math.round((order.priceGhs / billLineQty(order)) * 100) / 100;
}

export function inCollectionPeriod(iso: string, period: CollectionPeriod, now = new Date()): boolean {
  const paid = new Date(iso);
  if (Number.isNaN(paid.getTime())) return false;
  if (period === 'all') return true;
  if (period === 'day') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return paid >= start;
  }
  if (period === 'month') {
    return paid.getFullYear() === now.getFullYear() && paid.getMonth() === now.getMonth();
  }
  return paid.getFullYear() === now.getFullYear();
}

export function paidAmount(state: CareState, period: CollectionPeriod, now = new Date()): number {
  const visits = state.visits.reduce((sum, visit) => {
    return (
      sum +
      visit.orders
        .filter((order) => order.paidAt && order.chargeable !== false && inCollectionPeriod(order.paidAt, period, now))
        .reduce((inner, order) => inner + order.priceGhs, 0)
    );
  }, 0);
  const deposits = (state.patientDeposits ?? [])
    .filter((row) => inCollectionPeriod(row.receivedAt, period, now))
    .reduce((sum, row) => sum + row.amountGhs, 0);
  const external = (state.externalReceipts ?? [])
    .filter((row) => inCollectionPeriod(row.receivedAt, period, now))
    .reduce((sum, row) => sum + row.amountGhs, 0);
  return visits + deposits + external;
}

export function collectionsSummary(state: CareState, now = new Date()) {
  return {
    day: paidAmount(state, 'day', now),
    month: paidAmount(state, 'month', now),
    year: paidAmount(state, 'year', now),
  };
}

function newCashId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function staffDisplayName(state: CareState, staffId?: string): string {
  const person = state.staff.find((item) => item.id === staffId);
  return person ? `${person.firstName} ${person.lastName}` : 'Cashier';
}

export function patientDepositBalance(state: CareState, patientId: string): number {
  return (state.patientDeposits ?? [])
    .filter((row) => row.patientId === patientId)
    .reduce((sum, row) => sum + row.amountGhs, 0);
}

export function postPatientDeposit(
  state: CareState,
  input: { patientId: string; amountGhs: number; staffId: string; method?: PayMethod; note?: string },
): CareState {
  const amount = Number(input.amountGhs);
  if (!state.patients.some((patient) => patient.id === input.patientId) || !Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  const seq = state.nextReceiptSeq || 1;
  const row: PatientDepositRecord = {
    id: newCashId('dep'),
    patientId: input.patientId,
    amountGhs: Math.round(amount * 100) / 100,
    receivedBy: input.staffId,
    receivedAt: new Date().toISOString(),
    receiptNo: formatReceiptNo(seq),
    method: input.method ?? 'CASH',
    note: input.note?.trim() || undefined,
  };
  return { ...state, patientDeposits: [row, ...(state.patientDeposits ?? [])], nextReceiptSeq: seq + 1 };
}

export function postExternalReceipt(
  state: CareState,
  input: {
    payerName: string;
    amountGhs: number;
    description: string;
    staffId: string;
    patientId?: string;
    method?: PayMethod;
  },
): CareState {
  const amount = Number(input.amountGhs);
  const payerName = input.payerName.trim();
  const description = input.description.trim();
  if (!payerName || !description || !Number.isFinite(amount) || amount <= 0) return state;
  const seq = state.nextReceiptSeq || 1;
  const row: ExternalReceiptRecord = {
    id: newCashId('ext'),
    payerName,
    patientId: input.patientId,
    amountGhs: Math.round(amount * 100) / 100,
    description,
    receivedBy: input.staffId,
    receivedAt: new Date().toISOString(),
    receiptNo: formatReceiptNo(seq),
    method: input.method ?? 'CASH',
  };
  return { ...state, externalReceipts: [row, ...(state.externalReceipts ?? [])], nextReceiptSeq: seq + 1 };
}

export function salesSummaryByUser(state: CareState, period: CollectionPeriod = 'day', now = new Date()) {
  const rows = new Map<string, { staffId: string; bills: number; amount: number }>();
  function add(staffId: string, amount: number) {
    const current = rows.get(staffId) ?? { staffId, bills: 0, amount: 0 };
    current.bills += 1;
    current.amount += amount;
    rows.set(staffId, current);
  }
  for (const visit of state.visits) {
    for (const order of visit.orders) {
      if (!order.paidAt || order.chargeable === false || !inCollectionPeriod(order.paidAt, period, now)) continue;
      add(order.paidBy ?? visit.paidBy ?? 'unknown', order.priceGhs);
    }
  }
  for (const row of state.patientDeposits ?? []) {
    if (!inCollectionPeriod(row.receivedAt, period, now)) continue;
    add(row.receivedBy, row.amountGhs);
  }
  for (const row of state.externalReceipts ?? []) {
    if (!inCollectionPeriod(row.receivedAt, period, now)) continue;
    add(row.receivedBy, row.amountGhs);
  }
  return [...rows.values()].sort((a, b) => b.amount - a.amount);
}

export function receiptsTakenByUser(state: CareState, staffId: string, period: CollectionPeriod = 'day') {
  const name = staffDisplayName(state, staffId);
  return {
    visitReceipts: paidReceiptsForPeriod(state, period).filter((copy) => copy.receivedBy === name),
    deposits: (state.patientDeposits ?? []).filter(
      (row) => row.receivedBy === staffId && inCollectionPeriod(row.receivedAt, period),
    ),
    external: (state.externalReceipts ?? []).filter(
      (row) => row.receivedBy === staffId && inCollectionPeriod(row.receivedAt, period),
    ),
  };
}

function paidReceiptsForPeriod(state: CareState, period: CollectionPeriod) {
  const now = new Date();
  return state.visits
    .map((visit) => {
      const patient = state.patients.find((item) => item.id === visit.patientId);
      const paid = visit.orders.filter((order) => order.paidAt && order.chargeable !== false);
      if (!patient || paid.length === 0) return null;
      const paidAt = visit.paidAt ?? paid[0]?.paidAt ?? visit.checkedInAt;
      if (!inCollectionPeriod(paidAt, period, now)) return null;
      return {
        visitId: visit.id,
        receiptNo: visit.receiptNo ?? '—',
        hospitalNo: patient.hospitalNo,
        patientName: `${patient.firstName} ${patient.lastName}`,
        receivedBy: staffDisplayName(state, visit.paidBy ?? paid.find((order) => order.paidBy)?.paidBy),
        paidAt,
        paidTotal: paid.reduce((sum, order) => sum + order.priceGhs, 0),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}
