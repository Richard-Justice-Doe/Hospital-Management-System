import type { CareState, OtCaseRecord, OtStatus, StaffAccount } from './types';

export const OT_STATUS_LABEL: Record<OtStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_THEATRE: 'In theatre',
  RECOVERY: 'Recovery',
  DONE: 'Done',
};

export const OT_STATUSES: OtStatus[] = ['SCHEDULED', 'IN_THEATRE', 'RECOVERY', 'DONE'];

export const ASA_CLASSES = ['I', 'II', 'III', 'IV', 'E'];

export function preopComplete(row: OtCaseRecord): boolean {
  return Boolean(row.consentGiven && row.fastingOk && row.fitnessOk);
}

export function theatreStaff(staff: StaffAccount[]): StaffAccount[] {
  return staff.filter((person) => person.isActive && (person.department === 'THEATRE' || person.role === 'DOCTOR'));
}

export function theatreStats(state: CareState) {
  const rows = state.otCases ?? [];
  return {
    scheduled: rows.filter((row) => row.status === 'SCHEDULED').length,
    inTheatre: rows.filter((row) => row.status === 'IN_THEATRE').length,
    recovery: rows.filter((row) => row.status === 'RECOVERY').length,
    done: rows.filter((row) => row.status === 'DONE').length,
    blocked: rows.filter((row) => row.status === 'SCHEDULED' && !preopComplete(row)).length,
  };
}

export function casesForBoard(state: CareState, status?: OtStatus | ''): OtCaseRecord[] {
  return (state.otCases ?? [])
    .filter((row) => !status || row.status === status)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function staffName(staff: StaffAccount[], id?: string): string {
  const person = staff.find((item) => item.id === id);
  return person ? `${person.firstName} ${person.lastName}` : '';
}
