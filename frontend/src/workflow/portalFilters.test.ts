import { describe, expect, it } from 'vitest';
import {
  appointmentMatchesPortalFilter,
  messageMatchesPortalFilter,
  showPortalSection,
  visitMatchesPortalFilter,
} from './portalFilters';
import type { AppointmentRecord, NotificationRecord, VisitRecord } from './types';

const visit = {
  id: 'v1',
  patientId: 'p1',
  clinic: 'GENERAL',
  reason: 'Fever',
  stage: 'WITH_DOCTOR',
  checkedInAt: '2026-08-22T08:00:00.000Z',
  checkedInBy: 'staff-reception',
  diagnosis: 'Malaria',
  withDoctorAt: '2026-08-22T08:30:00.000Z',
  vitals: {
    systolicBp: 110,
    diastolicBp: 70,
    temperatureC: 37,
    pulseBpm: 80,
    weightKg: 60,
    heightCm: 160,
    spo2: 98,
    abnormalFlags: [],
    recordedAt: '2026-08-22T08:10:00.000Z',
    recordedBy: 'staff-nurse',
  },
  orders: [
    {
      id: 'o1',
      serviceId: 'lab-rdt',
      name: 'Malaria RDT',
      department: 'LAB',
      priceGhs: 25,
      status: 'DONE',
      result: 'Positive',
    },
  ],
} as VisitRecord;

const appointment = {
  id: 'a1',
  patientId: 'p1',
  clinic: 'GENERAL',
  startsAt: '2026-08-23T09:00:00.000Z',
  status: 'BOOKED',
} as AppointmentRecord;

const note = {
  id: 'n1',
  audience: 'patient',
  kind: 'lab',
  title: 'Lab ready',
  body: 'Result posted',
  at: '2026-08-22T10:00:00.000Z',
} as NotificationRecord;

describe('portal role filters', () => {
  it('keeps doctor and nurse visits on those filters', () => {
    expect(visitMatchesPortalFilter(visit, 'DOCTOR')).toBe(true);
    expect(visitMatchesPortalFilter(visit, 'NURSE')).toBe(true);
    expect(visitMatchesPortalFilter(visit, 'LAB')).toBe(true);
    expect(visitMatchesPortalFilter(visit, 'PHARMACY')).toBe(false);
  });

  it('shows only the matching portal sections', () => {
    expect(showPortalSection('appointments', 'APPOINTMENTS')).toBe(true);
    expect(showPortalSection('visits', 'APPOINTMENTS')).toBe(false);
    expect(showPortalSection('billing', 'BILLING')).toBe(true);
    expect(appointmentMatchesPortalFilter(appointment, 'DOCTOR')).toBe(true);
    expect(messageMatchesPortalFilter(note, 'LAB')).toBe(true);
    expect(messageMatchesPortalFilter(note, 'BILLING')).toBe(false);
  });
});
