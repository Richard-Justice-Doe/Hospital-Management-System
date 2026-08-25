import { itemsNeedingRestock, suggestedRestockQty } from './pharmacyStock';
import type {
  CareState,
  ClaimRecord,
  ClaimScheme,
  ClaimStatus,
  Department,
  PatientRecord,
  PurchaseOrderRecord,
  StaffRole,
  SupplyItemRecord,
  VisitRecord,
} from './types';

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function claimSchemeOf(
  patient?: Pick<PatientRecord, 'insuranceType'> | null,
  visit?: Pick<VisitRecord, 'coverAsPrivate'> | null,
): ClaimScheme | undefined {
  if (visit?.coverAsPrivate) return undefined;
  if (patient?.insuranceType === 'GOVERNMENT') return 'NHIS';
  if (patient?.insuranceType === 'PRIVATE') return 'PRIVATE';
  return undefined;
}

export function visitClaimAmount(visit: VisitRecord): number {
  return visit.orders.filter((order) => order.chargeable !== false).reduce((sum, order) => sum + order.priceGhs, 0);
}

export interface ClaimQueueRow {
  visit: VisitRecord;
  patient?: PatientRecord;
  claim?: ClaimRecord;
  scheme: ClaimScheme;
}

export function claimQueue(state: CareState): ClaimQueueRow[] {
  const rows: ClaimQueueRow[] = [];
  for (const visit of state.visits) {
    const patient = state.patients.find((item) => item.id === visit.patientId);
    const claim = state.claims.find((item) => item.visitId === visit.id);
    const scheme = claim?.scheme ?? claimSchemeOf(patient, visit);
    if (!scheme) continue;
    rows.push({ visit, patient, claim, scheme });
  }
  return rows.sort((a, b) => new Date(b.visit.checkedInAt).getTime() - new Date(a.visit.checkedInAt).getTime());
}

export type ClaimsTab = 'nhis' | 'private' | 'denied' | 'remittance';

export function filterClaimQueue(rows: ClaimQueueRow[], tab: ClaimsTab, query = ''): ClaimQueueRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    const status = row.claim?.status ?? 'DRAFT';
    if (tab === 'nhis' && (row.scheme !== 'NHIS' || status === 'DENIED' || status === 'PAID')) return false;
    if (tab === 'private' && (row.scheme !== 'PRIVATE' || status === 'DENIED' || status === 'PAID')) return false;
    if (tab === 'denied' && status !== 'DENIED') return false;
    if (tab === 'remittance' && status !== 'SUBMITTED' && status !== 'PAID') return false;
    if (!needle) return true;
    const hay = `${row.patient?.firstName ?? ''} ${row.patient?.lastName ?? ''} ${row.patient?.hospitalNo ?? ''} ${row.patient?.insuranceProvider ?? ''} ${row.claim?.claimNo ?? ''}`.toLowerCase();
    return hay.includes(needle);
  });
}

export function claimDeskStats(state: CareState) {
  const rows = claimQueue(state);
  return {
    nhis: rows.filter((row) => row.scheme === 'NHIS' && row.claim?.status !== 'DENIED' && row.claim?.status !== 'PAID').length,
    private: rows.filter((row) => row.scheme === 'PRIVATE' && row.claim?.status !== 'DENIED' && row.claim?.status !== 'PAID').length,
    denied: rows.filter((row) => row.claim?.status === 'DENIED').length,
    waitingPay: rows.filter((row) => row.claim?.status === 'SUBMITTED').length,
    paid: rows.filter((row) => row.claim?.status === 'PAID').length,
  };
}

export function isLowSupply(item: SupplyItemRecord): boolean {
  return item.quantity <= item.reorderAt;
}

export function storeStats(state: CareState) {
  const supplies = state.supplies ?? [];
  return {
    items: supplies.length,
    low: supplies.filter(isLowSupply).length,
    issues: (state.storeIssues ?? []).length,
    openOrders: (state.purchaseOrders ?? []).filter((row) => row.status === 'REQUESTED' || row.status === 'ORDERED').length,
  };
}

export function addStoreItem(
  state: CareState,
  input: { name: string; quantity: number; reorderAt: number; vendorId: string },
): CareState {
  const name = input.name.trim();
  if (!name) return state;
  return {
    ...state,
    supplies: [
      {
        id: newId('sup'),
        name,
        quantity: Math.max(0, Math.floor(input.quantity)),
        reorderAt: Math.max(0, Math.floor(input.reorderAt)),
        vendorId: input.vendorId,
      },
      ...state.supplies,
    ],
  };
}

export function receiveStoreStock(state: CareState, supplyId: string, quantity: number): CareState {
  const qty = Math.floor(quantity);
  if (qty <= 0) return state;
  return {
    ...state,
    supplies: state.supplies.map((item) => (item.id === supplyId ? { ...item, quantity: item.quantity + qty } : item)),
  };
}

export function issueSupply(
  state: CareState,
  input: { supplyId: string; quantity: number; toDepartment: Department; issuedBy: string; note?: string },
): CareState {
  const qty = Math.floor(input.quantity);
  const item = state.supplies.find((row) => row.id === input.supplyId);
  if (!item || qty <= 0 || item.quantity < qty) return state;
  return {
    ...state,
    supplies: state.supplies.map((row) => (row.id === item.id ? { ...row, quantity: row.quantity - qty } : row)),
    storeIssues: [
      {
        id: newId('iss'),
        supplyId: item.id,
        quantity: qty,
        toDepartment: input.toDepartment,
        issuedBy: input.issuedBy,
        at: nowIso(),
        note: input.note?.trim() || undefined,
      },
      ...(state.storeIssues ?? []),
    ],
  };
}

function notifyRole(state: CareState, fromId: string, toRole: StaffRole, body: string): CareState {
  return {
    ...state,
    messages: [
      {
        id: newId('msg'),
        at: nowIso(),
        fromId,
        toRole,
        body,
      },
      ...(state.messages ?? []),
    ],
  };
}

export function requestPurchase(
  state: CareState,
  input: {
    itemName: string;
    quantity: number;
    vendorId: string;
    department: Department;
    requestedBy: string;
    note?: string;
    stockId?: string;
    amountGhs?: number;
    notifyAccountant?: boolean;
  },
): CareState {
  const itemName = input.itemName.trim();
  const quantity = Math.floor(input.quantity);
  if (!itemName || quantity <= 0) return state;
  const seq = state.nextPoSeq || 1;
  const amountGhs = Number(input.amountGhs);
  const row: PurchaseOrderRecord = {
    id: newId('po'),
    poNo: `PO-${String(seq).padStart(4, '0')}`,
    itemName,
    quantity,
    vendorId: input.vendorId,
    department: input.department,
    status: 'REQUESTED',
    requestedBy: input.requestedBy,
    requestedAt: nowIso(),
    note: input.note?.trim() || undefined,
    stockId: input.stockId,
    amountGhs: Number.isFinite(amountGhs) && amountGhs > 0 ? amountGhs : undefined,
  };
  let next: CareState = {
    ...state,
    nextPoSeq: seq + 1,
    purchaseOrders: [row, ...(state.purchaseOrders ?? [])],
  };
  if (input.notifyAccountant !== false) {
    const cost = row.amountGhs ? ` · GH₵ ${row.amountGhs.toFixed(2)}` : '';
    next = notifyRole(
      next,
      input.requestedBy,
      'ACCOUNTANT',
      `Procurement needs this purchased: ${row.poNo} · ${row.itemName} × ${row.quantity}${cost}.`,
    );
  }
  return next;
}

export function hasOpenPharmacyRestock(state: CareState, itemName: string): boolean {
  const needle = itemName.trim().toLowerCase();
  return (state.purchaseOrders ?? []).some(
    (row) =>
      row.department === 'PHARMACY' &&
      row.itemName.toLowerCase() === needle &&
      (row.status === 'REQUESTED' || row.status === 'ORDERED'),
  );
}

export function pharmacyRestockOrders(state: CareState) {
  return (state.purchaseOrders ?? []).filter(
    (row) => row.department === 'PHARMACY' && (row.status === 'REQUESTED' || row.status === 'ORDERED'),
  );
}

export function sendPharmacyRestockToProcurement(
  state: CareState,
  input: { requestedBy: string },
): CareState {
  const items = itemsNeedingRestock(state.drugStock);
  const vendorId = state.vendors[0]?.id ?? 'ven-med';
  let next = state;
  const created: string[] = [];
  for (const item of items) {
    if (hasOpenPharmacyRestock(next, item.name)) continue;
    next = requestPurchase(next, {
      itemName: item.name,
      quantity: suggestedRestockQty(item),
      vendorId,
      department: 'PHARMACY',
      requestedBy: input.requestedBy,
      stockId: item.id,
      notifyAccountant: false,
      note:
        item.quantity <= 0
          ? `Pharmacy: 0 on shelf · reorder at ${item.reorderAt}`
          : `Pharmacy: ${item.quantity} left · reorder at ${item.reorderAt}`,
    });
    created.push(item.name);
  }
  if (created.length === 0) return next;
  const names = created.join(', ');
  next = notifyRole(next, input.requestedBy, 'PROCUREMENT', `Pharmacy needs these medicines ordered: ${names}.`);
  next = notifyRole(next, input.requestedBy, 'ACCOUNTANT', `Pharmacy sent medicines to purchase: ${names}.`);
  const officers = next.staff.filter((staff) => staff.role === 'PROCUREMENT' && staff.isActive);
  const targets = officers.length > 0 ? officers.map((staff) => staff.id) : [undefined];
  return targets.reduce(
    (acc, staffId) => ({
      ...acc,
      notifications: [
        {
          id: newId('ntf'),
          at: nowIso(),
          audience: 'staff' as const,
          staffId,
          title: 'Pharmacy restock request',
          body: names,
          kind: 'stock' as const,
        },
        ...(acc.notifications ?? []),
      ].slice(0, 200),
    }),
    next,
  );
}

export function setPurchaseStatus(state: CareState, poId: string, status: PurchaseOrderRecord['status'], staffId?: string): CareState {
  const current = (state.purchaseOrders ?? []).find((row) => row.id === poId);
  if (!current || current.status === 'CANCELLED' || current.status === 'RECEIVED') return state;
  if (status === 'RECEIVED') return receivePurchase(state, poId, staffId ?? current.requestedBy);
  return {
    ...state,
    purchaseOrders: (state.purchaseOrders ?? []).map((row) =>
      row.id === poId
        ? {
            ...row,
            status,
            orderedAt: status === 'ORDERED' ? nowIso() : row.orderedAt,
          }
        : row,
    ),
  };
}

export function receivePurchase(state: CareState, poId: string, staffId: string): CareState {
  const order = (state.purchaseOrders ?? []).find((row) => row.id === poId);
  if (!order || order.status === 'RECEIVED' || order.status === 'CANCELLED') return state;
  const closed = (state.purchaseOrders ?? []).map((row) =>
    row.id === poId ? { ...row, status: 'RECEIVED' as const, receivedAt: nowIso(), receivedBy: staffId } : row,
  );
  if (order.department === 'PHARMACY') {
    const drug =
      state.drugStock.find((item) => item.id === order.stockId) ??
      state.drugStock.find((item) => item.name.toLowerCase() === order.itemName.toLowerCase());
    if (drug) {
      return {
        ...state,
        drugStock: state.drugStock.map((item) =>
          item.id === drug.id ? { ...item, quantity: item.quantity + order.quantity } : item,
        ),
        purchaseOrders: closed,
      };
    }
  }
  const match = state.supplies.find((item) => item.name.toLowerCase() === order.itemName.toLowerCase());
  const supplies = match
    ? state.supplies.map((item) => (item.id === match.id ? { ...item, quantity: item.quantity + order.quantity } : item))
    : [
        {
          id: newId('sup'),
          name: order.itemName,
          quantity: order.quantity,
          reorderAt: Math.max(2, Math.floor(order.quantity / 4)),
          vendorId: order.vendorId,
        },
        ...state.supplies,
      ];
  return {
    ...state,
    supplies,
    purchaseOrders: closed,
  };
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  DRAFT: 'Not started',
  ELIGIBLE: 'Eligible',
  SUBMITTED: 'Submitted',
  PAID: 'Remitted',
  DENIED: 'Denied / query',
};

export function purchaseAmount(order: Pick<PurchaseOrderRecord, 'amountGhs'>): number {
  return Number(order.amountGhs) > 0 ? Number(order.amountGhs) : 0;
}

export function purchasesForAccountant(state: CareState) {
  return (state.purchaseOrders ?? []).filter((row) => row.status === 'REQUESTED' || row.status === 'ORDERED');
}

export function claimsForAccountantCash(state: CareState): ClaimQueueRow[] {
  return claimQueue(state).filter((row) => {
    const status = row.claim?.status ?? 'DRAFT';
    return status === 'SUBMITTED' || status === 'PAID';
  });
}

export function receiveClaimRemittance(state: CareState, visitId: string, staffId: string): CareState {
  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) return state;
  const existing = state.claims.find((item) => item.visitId === visitId);
  if (!existing || existing.status === 'DENIED') return state;
  if (existing.accountsReceivedAt) return state;
  const now = nowIso();
  return {
    ...state,
    claims: state.claims.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            status: 'PAID',
            accountsReceivedAt: now,
            accountsReceivedBy: staffId,
            updatedAt: now,
          }
        : item,
    ),
  };
}

export function receivePurchaseForAccounts(state: CareState, poId: string, staffId: string): CareState {
  const order = (state.purchaseOrders ?? []).find((row) => row.id === poId);
  if (!order || order.status === 'CANCELLED' || order.accountsReceivedAt) return state;
  return {
    ...state,
    purchaseOrders: (state.purchaseOrders ?? []).map((row) =>
      row.id === poId ? { ...row, accountsReceivedAt: nowIso(), accountsReceivedBy: staffId } : row,
    ),
  };
}

export function accountantInboxTotals(state: CareState) {
  const claims = claimsForAccountantCash(state);
  const purchases = purchasesForAccountant(state);
  const remittanceWaiting = claims.filter((row) => !row.claim?.accountsReceivedAt);
  const remittanceReceived = claims.filter((row) => row.claim?.accountsReceivedAt);
  const toBuy = purchases.filter((row) => !row.accountsReceivedAt);
  return {
    remittanceWaiting: remittanceWaiting.reduce((sum, row) => sum + (row.claim?.amountGhs ?? visitClaimAmount(row.visit)), 0),
    remittanceReceived: remittanceReceived.reduce((sum, row) => sum + (row.claim?.amountGhs ?? 0), 0),
    purchasesWaiting: toBuy.reduce((sum, row) => sum + purchaseAmount(row), 0),
    purchasesCount: toBuy.length,
  };
}
