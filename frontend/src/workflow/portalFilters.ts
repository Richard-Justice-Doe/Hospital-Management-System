import { unpaidOrders } from './billing';
import type { AppointmentRecord, ClinicId, Department, NotificationRecord, VisitRecord } from './types';

export type PortalFilter =
  | 'ALL'
  | 'DOCTOR'
  | 'NURSE'
  | 'LAB'
  | 'PHARMACY'
  | 'RADIOLOGY'
  | 'BILLING'
  | 'APPOINTMENTS'
  | 'MESSAGES';

export const PORTAL_FILTERS: Array<{ id: PortalFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'DOCTOR', label: 'Doctor' },
  { id: 'NURSE', label: 'Nurse' },
  { id: 'LAB', label: 'Laboratory' },
  { id: 'PHARMACY', label: 'Pharmacy' },
  { id: 'RADIOLOGY', label: 'Imaging' },
  { id: 'BILLING', label: 'Billing' },
  { id: 'APPOINTMENTS', label: 'Appointments' },
  { id: 'MESSAGES', label: 'Messages' },
];

const CLINIC_ROLE: Record<ClinicId, PortalFilter> = {
  GENERAL: 'DOCTOR',
  REVIEW: 'DOCTOR',
  EMERGENCY: 'DOCTOR',
  SPECIALIST: 'DOCTOR',
  EYE: 'DOCTOR',
  ENT: 'DOCTOR',
  DENTAL: 'DOCTOR',
  PHYSIO: 'DOCTOR',
  MATERNITY: 'NURSE',
};

const DEPARTMENT_ROLE: Partial<Record<Department, PortalFilter>> = {
  CONSULTATION: 'DOCTOR',
  NURSING: 'NURSE',
  LAB: 'LAB',
  PHARMACY: 'PHARMACY',
  RADIOLOGY: 'RADIOLOGY',
  RECORDS: 'BILLING',
};

export function visitMatchesPortalFilter(visit: VisitRecord, filter: PortalFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'APPOINTMENTS' || filter === 'MESSAGES') return false;
  if (filter === 'BILLING') return unpaidOrders(visit).length > 0 || Boolean(visit.paidAt);
  if (filter === 'DOCTOR') {
    return CLINIC_ROLE[visit.clinic] === 'DOCTOR' || Boolean(visit.diagnosis) || Boolean(visit.withDoctorAt);
  }
  if (filter === 'NURSE') {
    return Boolean(visit.vitals) || visit.orders.some((order) => order.department === 'NURSING') || CLINIC_ROLE[visit.clinic] === 'NURSE';
  }
  return visit.orders.some((order) => DEPARTMENT_ROLE[order.department] === filter);
}

export function appointmentMatchesPortalFilter(appointment: AppointmentRecord, filter: PortalFilter): boolean {
  if (filter === 'ALL' || filter === 'APPOINTMENTS') return true;
  if (filter === 'MESSAGES' || filter === 'BILLING') return false;
  return CLINIC_ROLE[appointment.clinic] === filter;
}

export function messageMatchesPortalFilter(note: NotificationRecord, filter: PortalFilter): boolean {
  if (filter === 'ALL' || filter === 'MESSAGES') return true;
  if (filter === 'BILLING') return note.kind === 'billing';
  if (filter === 'LAB') return note.kind === 'lab' || note.kind === 'critical';
  if (filter === 'APPOINTMENTS') return note.kind === 'reminder';
  return false;
}

export function showPortalSection(
  section: 'appointments' | 'visits' | 'billing' | 'messages',
  filter: PortalFilter,
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'APPOINTMENTS') return section === 'appointments';
  if (filter === 'MESSAGES') return section === 'messages';
  if (filter === 'BILLING') return section === 'billing' || section === 'visits';
  return section === 'visits' || section === 'appointments';
}
