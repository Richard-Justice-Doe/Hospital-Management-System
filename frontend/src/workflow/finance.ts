import { moneyBooks, moneyPeriod, payrollForPeriod, staffSalary } from './accounts';
import { collectionsSummary, inCollectionPeriod, unpaidOrders, visitBalance } from './billing';
import { CLINIC_LABELS, DEPARTMENT_LABELS } from './catalog';
import { appendAudit } from './his';
import { canAccessPage } from './permissions';
import { claimDeskStats, claimQueue, purchaseAmount } from './supportDesks';
import type {
  AgingBucket,
  CareState,
  ExpenseCategory,
  FinanceAdjustKind,
  FinanceReasonCode,
  PayMethod,
  StaffRole,
  VisitRecord,
} from './types';

export const REFUND_APPROVAL_GHS = 200;
export const BANK_OPENING_GHS = 45000;
export const VAT_RATE = 0.15;
export const REVENUE_DAY_TARGET = 2500;

export const REASON_LABELS: Record<FinanceReasonCode, string> = {
  STAFF: 'Staff / relative',
  HARDSHIP: 'Hardship',
  ERROR: 'Billing error',
  BAD_DEBT: 'Bad debt',
  DUPLICATE: 'Duplicate charge',
  OTHER: 'Other',
};

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  PHARMACY: 'Pharmacy stock',
  EQUIPMENT: 'Equipment',
  UTILITIES: 'Utilities',
  PAYROLL: 'Payroll',
  OTHER: 'Other',
};

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function canSeeClinicalFinance(role?: StaffRole | null): boolean {
  return Boolean(role && canAccessPage({ role }, 'clinical'));
}

export function canRecordPayment(role?: StaffRole | null, method: PayMethod = 'BANK'): boolean {
  if (role === 'CASHIER' || role === 'ADMIN') return true;
  if (role === 'ACCOUNTANT') return method !== 'CASH';
  return false;
}

export function canApproveLargeRefund(role?: StaffRole | null): boolean {
  return role === 'ADMIN';
}

export function periodOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return moneyPeriod();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function periodIsLocked(state: CareState, iso: string): boolean {
  return (state.periodLocks ?? []).some((row) => row.period === periodOf(iso));
}

export function invoiceTotal(visit: VisitRecord): number {
  return visit.orders.filter((order) => order.chargeable !== false).reduce((sum, order) => sum + order.priceGhs, 0);
}

export function invoicePaid(visit: VisitRecord): number {
  return visit.orders.filter((order) => order.chargeable !== false && order.paidAt).reduce((sum, order) => sum + order.priceGhs, 0);
}

export function invoiceStatus(visit: VisitRecord): 'Voided' | 'Not billed' | 'Paid' | 'Partial' | 'Open' {
  if (visit.billable === false) return 'Voided';
  if (!visit.billingDecidedAt && visit.orders.every((order) => order.chargeable === false)) return 'Not billed';
  const due = visitBalance(visit);
  const paid = invoicePaid(visit);
  if (due <= 0 && paid > 0) return 'Paid';
  if (paid > 0 && due > 0) return 'Partial';
  return 'Open';
}

export function agingBucket(iso: string, now = new Date()): AgingBucket {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export interface InvoiceRow {
  visit: VisitRecord;
  patientName: string;
  hospitalNo: string;
  payer: string;
  clinic: string;
  total: number;
  paid: number;
  due: number;
  status: ReturnType<typeof invoiceStatus>;
  date: string;
  bucket: AgingBucket;
}

export function invoiceRows(state: CareState, now = new Date()): InvoiceRow[] {
  return state.visits
    .map((visit) => {
      const patient = state.patients.find((item) => item.id === visit.patientId);
      return {
        visit,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
        hospitalNo: patient?.hospitalNo ?? '',
        payer: patient?.insuranceType === 'GOVERNMENT' ? 'NHIS' : patient?.insuranceType === 'PRIVATE' ? patient.insuranceProvider ?? 'Private' : 'Cash',
        clinic: CLINIC_LABELS[visit.clinic ?? 'GENERAL'],
        total: invoiceTotal(visit),
        paid: invoicePaid(visit),
        due: visitBalance(visit),
        status: invoiceStatus(visit),
        date: visit.billingDecidedAt ?? visit.checkedInAt,
        bucket: agingBucket(visit.billingDecidedAt ?? visit.checkedInAt, now),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function agingSummary(state: CareState, now = new Date()) {
  const empty: Record<AgingBucket, { count: number; amount: number }> = {
    '0-30': { count: 0, amount: 0 },
    '31-60': { count: 0, amount: 0 },
    '61-90': { count: 0, amount: 0 },
    '90+': { count: 0, amount: 0 },
  };
  for (const row of invoiceRows(state, now).filter((item) => item.due > 0 && item.status !== 'Voided')) {
    empty[row.bucket].count += 1;
    empty[row.bucket].amount += row.due;
  }
  return empty;
}

export function financeAlerts(state: CareState) {
  const aging = agingSummary(state);
  const books = moneyBooks(state);
  const denied = (state.claims ?? []).filter((item) => item.status === 'DENIED').length;
  const pendingRefunds = (state.financeAdjustments ?? []).filter((item) => item.kind === 'REFUND' && item.status === 'PENDING').length;
  const overdueInvoices = aging['90+'].count;
  return [
    overdueInvoices > 0 ? `${overdueInvoices} invoice${overdueInvoices === 1 ? '' : 's'} overdue 90+ days (${aging['90+'].amount.toFixed(2)} GHS)` : null,
    denied > 0 ? `${denied} denied claim${denied === 1 ? '' : 's'} need a query or resubmit` : null,
    pendingRefunds > 0 ? `${pendingRefunds} refund${pendingRefunds === 1 ? '' : 's'} waiting approval` : null,
    books.remaining < 0 ? `Budget overrun: spent ${books.spent.toFixed(2)} of ${books.allocated.toFixed(2)} GHS` : null,
    books.unpaidCount > 0 ? `${books.unpaidCount} worker${books.unpaidCount === 1 ? '' : 's'} unpaid this month` : null,
  ].filter((item): item is string => Boolean(item));
}

export function cashPosition(state: CareState) {
  const books = moneyBooks(state);
  const received = collectionsSummary(state);
  const bankIn = (state.bankTxns ?? []).filter((row) => row.direction === 'IN').reduce((sum, row) => sum + row.amountGhs, 0);
  const bankOut = (state.bankTxns ?? []).filter((row) => row.direction === 'OUT').reduce((sum, row) => sum + row.amountGhs, 0);
  const unmatched = (state.bankTxns ?? []).filter((row) => !row.matchedId).length;
  const drawer = received.day;
  const bank = BANK_OPENING_GHS + bankIn - bankOut + books.receivedClaims - books.purchasesSpent - books.wagesPaid;
  return { drawer, bank, unmatched, opening: BANK_OPENING_GHS };
}

export function financeDashboard(state: CareState) {
  const revenue = collectionsSummary(state);
  const books = moneyBooks(state);
  const aging = agingSummary(state);
  const claims = claimDeskStats(state);
  const cash = cashPosition(state);
  const outstanding = Object.values(aging).reduce((sum, row) => sum + row.amount, 0);
  return {
    revenue,
    targets: { day: REVENUE_DAY_TARGET, month: books.allocated || 120000, year: (books.allocated || 120000) * 12 },
    books,
    aging,
    outstanding,
    claims,
    cash,
    alerts: financeAlerts(state),
  };
}

export function revenueByDepartment(state: CareState) {
  const map = new Map<string, number>();
  for (const visit of state.visits) {
    for (const order of visit.orders.filter((item) => item.paidAt && item.chargeable !== false)) {
      const key = DEPARTMENT_LABELS[order.department];
      map.set(key, (map.get(key) ?? 0) + order.priceGhs);
    }
  }
  return [...map.entries()].map(([label, amountGhs]) => ({ label, amountGhs })).sort((a, b) => b.amountGhs - a.amountGhs);
}

export function profitAndLoss(state: CareState) {
  const income = moneyBooks(state);
  const vat = income.receivedPatients * (VAT_RATE / (1 + VAT_RATE));
  return {
    patientRevenue: income.receivedPatients,
    claimsRevenue: income.receivedClaims,
    income: income.received,
    wages: income.wagesPaid,
    purchases: income.purchasesSpent,
    vat,
    expenses: income.spent + vat,
    surplus: income.received - income.spent - vat,
  };
}

export function balanceSheet(state: CareState) {
  const cash = cashPosition(state);
  const ar = Object.values(agingSummary(state)).reduce((sum, row) => sum + row.amount, 0);
  const claimsDue = (state.claims ?? []).filter((item) => item.status === 'SUBMITTED').reduce((sum, item) => sum + item.amountGhs, 0);
  const ap = (state.vendorInvoices ?? []).filter((item) => item.status !== 'PAID').reduce((sum, item) => sum + item.amountGhs, 0);
  const wagesDue = moneyBooks(state).wagesDue;
  const assets = cash.bank + cash.drawer + ar + claimsDue;
  const liabilities = ap + wagesDue;
  return { cash: cash.bank + cash.drawer, ar, claimsDue, assets, ap, wagesDue, liabilities, equity: assets - liabilities };
}

export function cashFlow(state: CareState) {
  const books = moneyBooks(state);
  const cash = cashPosition(state);
  return {
    operatingIn: books.received,
    operatingOut: books.spent,
    net: books.received - books.spent,
    bank: cash.bank,
    drawer: cash.drawer,
  };
}

export function staffCostByDepartment(state: CareState) {
  const map = new Map<string, { paid: number; due: number }>();
  for (const staff of state.staff.filter((item) => item.isActive)) {
    const label = staff.department ? DEPARTMENT_LABELS[staff.department] : 'Administration';
    const cur = map.get(label) ?? { paid: 0, due: 0 };
    const paid = payrollForPeriod(state).find((row) => row.staffId === staff.id);
    if (paid) cur.paid += paid.amountGhs;
    else cur.due += staffSalary(staff);
    map.set(label, cur);
  }
  return [...map.entries()].map(([label, row]) => ({ label, ...row }));
}

export function payerReconciliation(state: CareState) {
  return claimQueue(state).reduce(
    (acc, row) => {
      const key = row.scheme;
      const cur = acc[key] ?? { billed: 0, submitted: 0, remitted: 0, denied: 0 };
      const amount = row.claim?.amountGhs ?? 0;
      cur.billed += amount;
      if (row.claim?.status === 'SUBMITTED') cur.submitted += amount;
      if (row.claim?.status === 'PAID') cur.remitted += amount;
      if (row.claim?.status === 'DENIED') cur.denied += amount;
      acc[key] = cur;
      return acc;
    },
    {} as Record<string, { billed: number; submitted: number; remitted: number; denied: number }>,
  );
}

export function threeWayMatch(state: CareState, invoiceId: string) {
  const invoice = (state.vendorInvoices ?? []).find((item) => item.id === invoiceId);
  const po = invoice?.poId ? (state.purchaseOrders ?? []).find((item) => item.id === invoice.poId) : undefined;
  const hasPo = Boolean(po);
  const goodsIn = po?.status === 'RECEIVED' || Boolean(po?.accountsReceivedAt);
  const amountOk = Boolean(invoice && po && Math.abs((po.amountGhs ?? invoice.amountGhs) - invoice.amountGhs) < 0.01);
  return { invoice, po, hasPo, goodsIn, amountOk, matched: hasPo && goodsIn && amountOk };
}

export function requestFinanceAdjust(
  state: CareState,
  input: {
    visitId: string;
    kind: FinanceAdjustKind;
    amountGhs: number;
    reasonCode: FinanceReasonCode;
    reason: string;
    staffId: string;
    role?: StaffRole;
  },
): CareState {
  const visit = state.visits.find((item) => item.id === input.visitId);
  if (!visit || periodIsLocked(state, visit.checkedInAt)) return state;
  const amount = Number(input.amountGhs);
  if (!Number.isFinite(amount) || amount <= 0) return state;
  const needsApproval = input.kind === 'REFUND' && amount >= REFUND_APPROVAL_GHS && !canApproveLargeRefund(input.role);
  const row = {
    id: newId('adj'),
    visitId: input.visitId,
    kind: input.kind,
    amountGhs: amount,
    reasonCode: input.reasonCode,
    reason: input.reason.trim() || REASON_LABELS[input.reasonCode],
    status: needsApproval ? ('PENDING' as const) : ('APPROVED' as const),
    requestedBy: input.staffId,
    requestedAt: nowIso(),
    approvedBy: needsApproval ? undefined : input.staffId,
    approvedAt: needsApproval ? undefined : nowIso(),
  };
  let next: CareState = { ...state, financeAdjustments: [row, ...(state.financeAdjustments ?? [])] };
  if (row.status === 'APPROVED') next = applyApprovedAdjust(next, row.id);
  return appendAudit(next, {
    staffId: input.staffId,
    action: `${input.kind.toLowerCase()}_${row.status.toLowerCase()}`,
    patientId: visit.patientId,
    entity: visit.id,
    reason: row.reason,
  });
}

export function decideFinanceAdjust(state: CareState, adjustId: string, approve: boolean, staffId: string): CareState {
  const row = (state.financeAdjustments ?? []).find((item) => item.id === adjustId);
  if (!row || row.status !== 'PENDING') return state;
  let next: CareState = {
    ...state,
    financeAdjustments: (state.financeAdjustments ?? []).map((item) =>
      item.id === adjustId
        ? { ...item, status: approve ? 'APPROVED' : 'DENIED', approvedBy: staffId, approvedAt: nowIso() }
        : item,
    ),
  };
  if (approve) next = applyApprovedAdjust(next, adjustId);
  return appendAudit(next, { staffId, action: approve ? 'adjust_approved' : 'adjust_denied', entity: adjustId });
}

function applyApprovedAdjust(state: CareState, adjustId: string): CareState {
  const row = (state.financeAdjustments ?? []).find((item) => item.id === adjustId);
  if (!row) return state;
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id !== row.visitId) return visit;
      if (row.kind === 'VOID') {
        return { ...visit, billable: false, waivedReason: row.reason };
      }
      if (row.kind === 'DISCOUNT' || row.kind === 'WRITE_OFF' || row.kind === 'REFUND') {
        let left = row.amountGhs;
        const orders = visit.orders.map((order) => {
          if (left <= 0 || order.chargeable === false) return order;
          if (row.kind === 'REFUND' && order.paidAt) {
            left -= order.priceGhs;
            return { ...order, paidAt: undefined, paidBy: undefined };
          }
          if (row.kind !== 'REFUND') {
            left -= order.priceGhs;
            return { ...order, chargeable: false };
          }
          return order;
        });
        return { ...visit, orders };
      }
      return visit;
    }),
  };
}

export function savePaymentPlan(state: CareState, visitId: string, instalments: number, note: string, staffId: string): CareState {
  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit || periodIsLocked(state, visit.checkedInAt)) return state;
  return appendAudit(
    {
      ...state,
      paymentPlans: [
        { id: newId('plan'), visitId, instalments: Math.max(2, Math.floor(instalments)), note: note.trim(), createdBy: staffId, createdAt: nowIso() },
        ...(state.paymentPlans ?? []).filter((item) => item.visitId !== visitId),
      ],
    },
    { staffId, action: 'payment_plan', patientId: visit.patientId, entity: visitId },
  );
}

export function saveVendorInvoice(
  state: CareState,
  input: { invoiceNo: string; vendorId: string; poId?: string; amountGhs: number; category: ExpenseCategory; note?: string; staffId: string },
): CareState {
  if (periodIsLocked(state, nowIso())) return state;
  const amount = Number(input.amountGhs);
  if (!input.invoiceNo.trim() || !Number.isFinite(amount) || amount <= 0) return state;
  const row = {
    id: newId('vinv'),
    invoiceNo: input.invoiceNo.trim(),
    vendorId: input.vendorId,
    poId: input.poId || undefined,
    amountGhs: amount,
    category: input.category,
    status: 'DRAFT' as const,
    at: nowIso(),
    note: input.note?.trim(),
  };
  return appendAudit({ ...state, vendorInvoices: [row, ...(state.vendorInvoices ?? [])] }, { staffId: input.staffId, action: 'vendor_invoice', entity: row.id });
}

export function progressVendorInvoice(state: CareState, invoiceId: string, staffId: string, status: 'MATCHED' | 'APPROVED' | 'PAID'): CareState {
  const invoice = (state.vendorInvoices ?? []).find((item) => item.id === invoiceId);
  if (!invoice || periodIsLocked(state, invoice.at)) return state;
  if (status === 'MATCHED' && !threeWayMatch(state, invoiceId).matched) return state;
  return appendAudit(
    {
      ...state,
      vendorInvoices: (state.vendorInvoices ?? []).map((item) =>
        item.id === invoiceId
          ? {
              ...item,
              status,
              receivedAt: item.receivedAt ?? nowIso(),
              approvedBy: status === 'APPROVED' || status === 'PAID' ? staffId : item.approvedBy,
              paidAt: status === 'PAID' ? nowIso() : item.paidAt,
              paidBy: status === 'PAID' ? staffId : item.paidBy,
            }
          : item,
      ),
    },
    { staffId, action: `vendor_${status.toLowerCase()}`, entity: invoiceId },
  );
}

export function addBankTxn(state: CareState, input: { amountGhs: number; direction: 'IN' | 'OUT'; reference: string; staffId: string }): CareState {
  const amount = Number(input.amountGhs);
  if (!Number.isFinite(amount) || amount <= 0 || !input.reference.trim()) return state;
  const row = { id: newId('bnk'), at: nowIso(), amountGhs: amount, direction: input.direction, reference: input.reference.trim() };
  return appendAudit({ ...state, bankTxns: [row, ...(state.bankTxns ?? [])] }, { staffId: input.staffId, action: 'bank_txn', entity: row.id });
}

export function matchBankTxn(state: CareState, txnId: string, matchedId: string, matchedKind: BankTxnRecordKind, staffId: string): CareState {
  return appendAudit(
    {
      ...state,
      bankTxns: (state.bankTxns ?? []).map((item) => (item.id === txnId ? { ...item, matchedId, matchedKind } : item)),
    },
    { staffId, action: 'bank_match', entity: txnId },
  );
}

type BankTxnRecordKind = 'RECEIPT' | 'CLAIM' | 'VENDOR' | 'PAYROLL';

export function lockFinancePeriod(state: CareState, period: string, staffId: string): CareState {
  if ((state.periodLocks ?? []).some((row) => row.period === period)) return state;
  return appendAudit(
    { ...state, periodLocks: [{ id: newId('lock'), period, lockedBy: staffId, lockedAt: nowIso() }, ...(state.periodLocks ?? [])] },
    { staffId, action: 'period_lock', entity: period },
  );
}

export function savePreAuth(state: CareState, input: { visitId: string; payer: string; ref: string; status: 'PENDING' | 'APPROVED' | 'DENIED'; staffId: string }): CareState {
  const visit = state.visits.find((item) => item.id === input.visitId);
  if (!visit) return state;
  const row = { id: newId('auth'), visitId: input.visitId, payer: input.payer.trim(), ref: input.ref.trim(), status: input.status, at: nowIso() };
  return appendAudit({ ...state, preAuths: [row, ...(state.preAuths ?? [])] }, { staffId: input.staffId, action: 'preauth', patientId: visit.patientId, entity: visit.id });
}

export function saveEob(state: CareState, input: { claimId: string; amountGhs: number; paidGhs: number; ref: string; staffId: string }): CareState {
  const claim = (state.claims ?? []).find((item) => item.id === input.claimId);
  if (!claim) return state;
  const row = { id: newId('eob'), claimId: input.claimId, amountGhs: Number(input.amountGhs) || 0, paidGhs: Number(input.paidGhs) || 0, ref: input.ref.trim(), at: nowIso() };
  return appendAudit({ ...state, eobRecords: [row, ...(state.eobRecords ?? [])] }, { staffId: input.staffId, action: 'eob_match', entity: claim.id });
}

export function resubmitClaim(state: CareState, visitId: string, staffId: string): CareState {
  const claim = (state.claims ?? []).find((item) => item.visitId === visitId);
  if (!claim || claim.status !== 'DENIED') return state;
  return appendAudit(
    {
      ...state,
      claims: state.claims.map((item) => (item.id === claim.id ? { ...item, status: 'ELIGIBLE', denialReason: undefined, updatedAt: nowIso() } : item)),
    },
    { staffId, action: 'claim_resubmit', entity: claim.id },
  );
}

export { inCollectionPeriod };
