import { DEPARTMENT_LABELS } from './catalog';
import type { CareState, Department, ShiftRecord, StaffAccount } from './types';
import { ROLE_LABELS } from './types';
import { formatShiftHours } from './his';

export type DutyStatus = 'on_duty' | 'at_desk' | 'later' | 'off_duty';

export interface StaffAvailabilityRow {
  staffId: string;
  name: string;
  role: string;
  department: string;
  departmentId?: Department;
  status: DutyStatus;
  statusLabel: string;
  hours?: string;
  lastSeen?: string;
}

export const DESK_ACTIVE_MS = 15 * 60 * 1000;

function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function shiftCoversAt(shift: ShiftRecord, at: Date): boolean {
  const today = localDay(at);
  const yesterday = localDay(new Date(at.getTime() - 24 * 60 * 60 * 1000));
  const minutes = minutesOfDay(at);
  const overnight = shift.endHour <= shift.startHour;

  if (shift.day === today) {
    if (!overnight) return minutes >= shift.startHour * 60 && minutes < shift.endHour * 60;
    return minutes >= shift.startHour * 60;
  }
  if (overnight && shift.day === yesterday) {
    return minutes < shift.endHour * 60;
  }
  return false;
}

export function shiftLaterToday(shift: ShiftRecord, at: Date): boolean {
  if (shift.day !== localDay(at)) return false;
  return minutesOfDay(at) < shift.startHour * 60;
}

export function lastStaffActivity(state: CareState, staffId: string): string | undefined {
  const times: number[] = [];
  for (const event of state.auditLog) {
    if (event.staffId === staffId) times.push(new Date(event.at).getTime());
  }
  for (const visit of state.visits) {
    if (visit.checkedInBy === staffId) times.push(new Date(visit.checkedInAt).getTime());
    if (visit.paidBy === staffId && visit.paidAt) times.push(new Date(visit.paidAt).getTime());
    if (visit.vitals?.recordedBy === staffId) times.push(new Date(visit.vitals.recordedAt).getTime());
  }
  if (times.length === 0) return undefined;
  return new Date(Math.max(...times)).toISOString();
}

const STATUS_LABEL: Record<DutyStatus, string> = {
  on_duty: 'On duty',
  at_desk: 'At desk now',
  later: 'Scheduled later',
  off_duty: 'Off duty',
};

function rowForStaff(state: CareState, staff: StaffAccount, at: Date): StaffAvailabilityRow {
  const shifts = (state.shifts ?? []).filter((shift) => shift.staffId === staff.id);
  const current = shifts.find((shift) => shiftCoversAt(shift, at));
  const upcoming = shifts.find((shift) => shiftLaterToday(shift, at));
  const lastSeen = lastStaffActivity(state, staff.id);
  const recent = lastSeen ? at.getTime() - new Date(lastSeen).getTime() < DESK_ACTIVE_MS && at.getTime() >= new Date(lastSeen).getTime() : false;
  let status: DutyStatus = 'off_duty';
  if (current && recent) status = 'at_desk';
  else if (current) status = 'on_duty';
  else if (upcoming) status = 'later';
  const shown = current ?? upcoming;
  return {
    staffId: staff.id,
    name: `${staff.firstName} ${staff.lastName}`,
    role: ROLE_LABELS[staff.role],
    department: staff.department ? DEPARTMENT_LABELS[staff.department] : 'Hospital',
    departmentId: staff.department,
    status,
    statusLabel: STATUS_LABEL[status],
    hours: shown ? formatShiftHours(shown.startHour, shown.endHour) : undefined,
    lastSeen,
  };
}

export function buildStaffAvailability(state: CareState, at: Date = new Date()): StaffAvailabilityRow[] {
  const order: Record<DutyStatus, number> = { at_desk: 0, on_duty: 1, later: 2, off_duty: 3 };
  return state.staff
    .filter((staff) => staff.isActive)
    .map((staff) => rowForStaff(state, staff, at))
    .sort((a, b) => order[a.status] - order[b.status] || a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
}

export function isOnDuty(row: StaffAvailabilityRow): row is StaffAvailabilityRow & { status: 'on_duty' | 'at_desk' } {
  return row.status === 'on_duty' || row.status === 'at_desk';
}

export function onDutyRows(rows: StaffAvailabilityRow[]) {
  return rows.filter(isOnDuty);
}

export function availabilitySummary(rows: StaffAvailabilityRow[]) {
  return {
    onDuty: rows.filter(isOnDuty).length,
    atDesk: rows.filter((row) => row.status === 'at_desk').length,
    later: rows.filter((row) => row.status === 'later').length,
    offDuty: rows.filter((row) => row.status === 'off_duty').length,
  };
}
