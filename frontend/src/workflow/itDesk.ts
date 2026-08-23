import { appendAudit } from './his';
import type {
  AssetRecord,
  CareState,
  FailedLoginRecord,
  ItAssetKind,
  ItAssetStatus,
  ItTicketCategory,
  ItTicketPriority,
  ItTicketRecord,
  ItTicketStatus,
  StaffAccount,
  VisitRecord,
} from './types';

export const TICKET_STATUS_LABEL: Record<ItTicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting',
  RESOLVED: 'Resolved',
};

export const TICKET_PRIORITY_LABEL: Record<ItTicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const TICKET_CATEGORY_LABEL: Record<ItTicketCategory, string> = {
  LOGIN: 'Login',
  PRINTER: 'Printer',
  NETWORK: 'Network',
  HIS: 'HIS error',
  HARDWARE: 'Hardware',
  OTHER: 'Other',
};

export const ASSET_KIND_LABEL: Record<ItAssetKind, string> = {
  PC: 'PC',
  PRINTER: 'Printer',
  PHONE: 'Phone',
  LICENSE: 'License',
  OTHER: 'Other',
};

export const ASSET_STATUS_LABEL: Record<ItAssetStatus, string> = {
  IN_USE: 'In use',
  SPARE: 'Spare',
  REPAIR: 'Repair',
  RETIRED: 'Retired',
};

const FAIL_SESSION_KEY = 'cms_it_failed_logins';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nextQueueNo(visits: VisitRecord[], at: string): number {
  const day = at.slice(0, 10);
  let max = 0;
  for (const visit of visits) {
    if (visit.checkedInAt.slice(0, 10) !== day) continue;
    if ((visit.queueNo ?? 0) > max) max = visit.queueNo ?? 0;
  }
  return max + 1;
}

export function assignMissingQueueNumbers(visits: VisitRecord[]): VisitRecord[] {
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

export function inferAssetKind(name: string): ItAssetKind {
  const n = name.toLowerCase();
  if (/\b(pc|computer|laptop|desktop)\b/.test(n)) return 'PC';
  if (/\b(print|printer)\b/.test(n)) return 'PRINTER';
  if (/\b(phone|handset|mobile)\b/.test(n)) return 'PHONE';
  if (/\b(license|windows|office|microsoft)\b/.test(n)) return 'LICENSE';
  return 'OTHER';
}

export function normalizeAsset(asset: AssetRecord): AssetRecord {
  return {
    ...asset,
    kind: asset.kind ?? inferAssetKind(asset.name),
    status: asset.status ?? 'IN_USE',
  };
}

export function itStaff(staff: StaffAccount[]): StaffAccount[] {
  return staff.filter((person) => person.role === 'IT' && person.isActive);
}

export function openTicket(
  state: CareState,
  input: {
    openedByStaffId: string;
    category: ItTicketCategory;
    priority: ItTicketPriority;
    title: string;
    detail: string;
    location?: string;
  },
): CareState {
  const title = input.title.trim();
  if (!title) return state;
  const ticket: ItTicketRecord = {
    id: newId('tkt'),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    openedByStaffId: input.openedByStaffId,
    category: input.category,
    priority: input.priority,
    status: 'OPEN',
    title,
    detail: input.detail.trim(),
    location: input.location?.trim() || undefined,
  };
  const next: CareState = { ...state, itTickets: [ticket, ...state.itTickets] };
  return appendAudit(next, {
    staffId: input.openedByStaffId,
    action: 'it_ticket_open',
    entity: ticket.title,
  });
}

export function updateTicket(
  state: CareState,
  ticketId: string,
  patch: Partial<Pick<ItTicketRecord, 'status' | 'assignedToStaffId' | 'resolution' | 'priority'>>,
  staffId: string,
): CareState {
  const current = state.itTickets.find((row) => row.id === ticketId);
  if (!current) return state;
  const ticket: ItTicketRecord = {
    ...current,
    ...patch,
    assignedToStaffId: patch.assignedToStaffId === '' ? undefined : (patch.assignedToStaffId ?? current.assignedToStaffId),
    updatedAt: nowIso(),
  };
  const next: CareState = {
    ...state,
    itTickets: state.itTickets.map((row) => (row.id === ticketId ? ticket : row)),
  };
  return appendAudit(next, {
    staffId,
    action: patch.status ? `it_ticket_${patch.status.toLowerCase()}` : 'it_ticket_update',
    entity: ticket.title,
    reason: ticket.resolution,
  });
}

export function upsertAsset(state: CareState, asset: AssetRecord, staffId: string): CareState {
  const row = normalizeAsset({
    ...asset,
    id: asset.id || newId('ast'),
    name: asset.name.trim(),
    location: asset.location.trim(),
  });
  if (!row.name || !row.location) return state;
  const exists = state.assets.some((item) => item.id === row.id);
  const next: CareState = {
    ...state,
    assets: exists ? state.assets.map((item) => (item.id === row.id ? row : item)) : [row, ...state.assets],
  };
  return appendAudit(next, {
    staffId,
    action: exists ? 'it_asset_update' : 'it_asset_create',
    entity: `${row.name} @ ${row.location}`,
  });
}

export function appendFailedLogin(state: CareState, login: string, reason: string): CareState {
  const record: FailedLoginRecord = {
    id: newId('fail'),
    at: nowIso(),
    login: login.trim().slice(0, 80) || '(blank)',
    reason,
  };
  return { ...state, failedLogins: [record, ...(state.failedLogins ?? [])].slice(0, 80) };
}

export function rememberFailedLogin(record: FailedLoginRecord): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(FAIL_SESSION_KEY, JSON.stringify([record, ...recentSessionFails()].slice(0, 40)));
}

function recentSessionFails(): FailedLoginRecord[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(FAIL_SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as FailedLoginRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recentFailedLogins(state: CareState): FailedLoginRecord[] {
  const merged = new Map<string, FailedLoginRecord>();
  for (const row of [...recentSessionFails(), ...(state.failedLogins ?? [])]) {
    if (!merged.has(row.id)) merged.set(row.id, row);
  }
  return [...merged.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}

export function ticketQueue(state: CareState, status?: ItTicketStatus | ''): ItTicketRecord[] {
  return state.itTickets
    .filter((row) => !status || row.status === status)
    .sort((a, b) => {
      const pri: Record<ItTicketPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
      if (a.status !== b.status) {
        const order: Record<ItTicketStatus, number> = { OPEN: 0, IN_PROGRESS: 1, WAITING: 2, RESOLVED: 3 };
        return order[a.status] - order[b.status];
      }
      if (pri[a.priority] !== pri[b.priority]) return pri[a.priority] - pri[b.priority];
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function itDeskStats(state: CareState) {
  const tickets = state.itTickets ?? [];
  return {
    open: tickets.filter((row) => row.status === 'OPEN').length,
    inProgress: tickets.filter((row) => row.status === 'IN_PROGRESS').length,
    waiting: tickets.filter((row) => row.status === 'WAITING').length,
    resolved: tickets.filter((row) => row.status === 'RESOLVED').length,
    locked: state.staff.filter((staff) => !staff.isActive).length,
    active: state.staff.filter((staff) => staff.isActive).length,
    assets: state.assets.length,
    failedLogins: recentFailedLogins(state).length,
  };
}

export function systemHealth(state: CareState): {
  lastSavedAt?: string;
  lockedAccounts: StaffAccount[];
  failedLogins: FailedLoginRecord[];
  openTickets: number;
  auditRows: number;
} {
  return {
    lastSavedAt: state.lastSavedAt,
    lockedAccounts: state.staff.filter((staff) => !staff.isActive),
    failedLogins: recentFailedLogins(state),
    openTickets: (state.itTickets ?? []).filter((row) => row.status !== 'RESOLVED').length,
    auditRows: (state.auditLog ?? []).length,
  };
}

export function ensureSampleLabel(
  state: CareState,
  visitId: string,
  orderId: string,
  staffId: string,
): CareState {
  const visit = state.visits.find((row) => row.id === visitId);
  const order = visit?.orders.find((row) => row.id === orderId);
  if (!visit || !order) return state;
  const existing = (state.samples ?? []).find((row) => row.orderId === orderId);
  if (order.accessionNo && existing) return state;
  const seq = state.nextAccessionSeq || 1;
  const accessionNo = order.accessionNo ?? `ACC-${String(seq).padStart(5, '0')}`;
  return {
    ...state,
    nextAccessionSeq: order.accessionNo ? seq : seq + 1,
    visits: state.visits.map((row) =>
      row.id !== visitId
        ? row
        : { ...row, orders: row.orders.map((item) => (item.id === orderId ? { ...item, accessionNo } : item)) },
    ),
    samples: existing
      ? state.samples
      : [
          {
            id: newId('smp'),
            visitId,
            orderId,
            accessionNo,
            collectedAt: nowIso(),
            collectedBy: staffId,
          },
          ...state.samples,
        ],
  };
}
