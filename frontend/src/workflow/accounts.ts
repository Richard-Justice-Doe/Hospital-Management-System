import { inCollectionPeriod, paidAmount } from './billing';
import { purchaseAmount, purchasesForAccountant } from './supportDesks';
import type { BudgetRecord, CareState, PayrollRecord, StaffAccount, StaffRole } from './types';

export const ROLE_SALARY_GHS: Record<StaffRole, number> = {
  ADMIN: 4500,
  MATRON: 3800,
  DOCTOR: 4200,
  EYE_DOCTOR: 4200,
  ENT_DOCTOR: 4200,
  DENTIST: 4000,
  MIDWIFE: 2800,
  NURSE: 2200,
  EYE_NURSE: 2200,
  ENT_NURSE: 2200,
  PHARMACIST: 2600,
  LAB: 2400,
  RADIOLOGY: 2400,
  PHYSIO: 2400,
  RECEPTIONIST: 1800,
  CASHIER: 2000,
  ACCOUNTANT: 2200,
  CLAIMS: 1900,
  STOREKEEPER: 1800,
  PROCUREMENT: 2000,
  IT: 2100,
};

export function moneyPeriod(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function staffSalary(staff: Pick<StaffAccount, 'role' | 'salaryGhs'>): number {
  if (Number(staff.salaryGhs) > 0) return Number(staff.salaryGhs);
  return ROLE_SALARY_GHS[staff.role] ?? 1800;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function currentBudget(state: CareState, period = moneyPeriod()): BudgetRecord | undefined {
  return (state.budgets ?? []).find((row) => row.period === period);
}

export function payrollForPeriod(state: CareState, period = moneyPeriod()): PayrollRecord[] {
  return (state.payroll ?? []).filter((row) => row.period === period);
}

export function staffPaidThisPeriod(state: CareState, staffId: string, period = moneyPeriod()): PayrollRecord | undefined {
  return payrollForPeriod(state, period).find((row) => row.staffId === staffId);
}

export function setMonthAllocation(state: CareState, allocatedGhs: number, staffId: string, note?: string): CareState {
  const amount = Number(allocatedGhs);
  if (!Number.isFinite(amount) || amount < 0) return state;
  const period = moneyPeriod();
  const existing = currentBudget(state, period);
  const row: BudgetRecord = {
    id: existing?.id ?? newId('bud'),
    period,
    allocatedGhs: amount,
    note: note?.trim() || existing?.note,
    setBy: staffId,
    at: nowIso(),
  };
  return {
    ...state,
    budgets: existing ? (state.budgets ?? []).map((item) => (item.id === existing.id ? row : item)) : [row, ...(state.budgets ?? [])],
  };
}

export function setStaffSalary(state: CareState, staffId: string, salaryGhs: number): CareState {
  const amount = Number(salaryGhs);
  if (!Number.isFinite(amount) || amount < 0) return state;
  return {
    ...state,
    staff: state.staff.map((item) => (item.id === staffId ? { ...item, salaryGhs: amount } : item)),
  };
}

export function payStaff(state: CareState, staffId: string, paidBy: string, amountGhs?: number): CareState {
  const worker = state.staff.find((item) => item.id === staffId && item.isActive);
  if (!worker) return state;
  const period = moneyPeriod();
  if (staffPaidThisPeriod(state, staffId, period)) return state;
  const amount = Number(amountGhs) > 0 ? Number(amountGhs) : staffSalary(worker);
  if (amount <= 0) return state;
  const row: PayrollRecord = {
    id: newId('pay'),
    staffId,
    period,
    amountGhs: amount,
    paidAt: nowIso(),
    paidBy,
  };
  return { ...state, payroll: [row, ...(state.payroll ?? [])] };
}

export function payAllUnpaidStaff(state: CareState, paidBy: string): CareState {
  return state.staff
    .filter((item) => item.isActive && !staffPaidThisPeriod(state, item.id))
    .reduce((next, item) => payStaff(next, item.id, paidBy), state);
}

export function moneyBooks(state: CareState, now = new Date()) {
  const period = moneyPeriod(now);
  const allocated = currentBudget(state, period)?.allocatedGhs ?? 0;
  const receivedPatients = paidAmount(state, 'month', now);
  const receivedClaims = (state.claims ?? [])
    .filter((claim) => claim.accountsReceivedAt && inCollectionPeriod(claim.accountsReceivedAt, 'month', now))
    .reduce((sum, claim) => sum + claim.amountGhs, 0);
  const wagesPaid = payrollForPeriod(state, period).reduce((sum, row) => sum + row.amountGhs, 0);
  const unpaidStaff = state.staff.filter((item) => item.isActive && !staffPaidThisPeriod(state, item.id, period));
  const wagesDue = unpaidStaff.reduce((sum, item) => sum + staffSalary(item), 0);
  const purchasesSpent = purchasesForAccountant(state)
    .concat((state.purchaseOrders ?? []).filter((row) => row.status === 'RECEIVED'))
    .filter((row, index, list) => list.findIndex((item) => item.id === row.id) === index)
    .filter((row) => row.accountsReceivedAt && inCollectionPeriod(row.accountsReceivedAt, 'month', now))
    .reduce((sum, row) => sum + purchaseAmount(row), 0);
  const received = receivedPatients + receivedClaims;
  const spent = wagesPaid + purchasesSpent;
  return {
    period,
    allocated,
    spent,
    remaining: allocated - spent,
    received,
    receivedPatients,
    receivedClaims,
    wagesPaid,
    wagesDue,
    purchasesSpent,
    unpaidCount: unpaidStaff.length,
  };
}
