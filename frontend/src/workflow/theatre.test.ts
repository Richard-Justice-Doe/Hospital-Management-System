import { describe, expect, it } from 'vitest';
import { createSeedState } from './seed';
import { afterPlanCare, scheduleOt, updateOt } from './his';
import { planCare } from './store';
import { otBoardHtml, otConsentHtml, opNoteHtml } from './printReceipt';
import { preopComplete, theatreStats } from './theatre';

describe('Theatre / OT', () => {
  it('seeds a scheduled OT case and counts the board', () => {
    const state = createSeedState();
    const row = state.otCases.find((item) => item.id === 'ot-omar');
    expect(row?.status).toBe('SCHEDULED');
    expect(row?.procedure).toMatch(/drainage/i);
    expect(theatreStats(state).scheduled).toBeGreaterThan(0);
  });

  it('blocks a complete pre-op until consent, fasting, and fitness are ticked', () => {
    const seeded = createSeedState();
    const caseId = 'ot-omar';
    expect(preopComplete(seeded.otCases[0]!)).toBe(false);
    const ready = updateOt(seeded, caseId, { consentGiven: true, fastingOk: true, fitnessOk: true });
    expect(ready.otCases[0]?.preopDone).toBe(true);
    expect(preopComplete(ready.otCases[0]!)).toBe(true);
  });

  it('schedules from a doctor theatre order and completes the order when the case is done', () => {
    const seeded = createSeedState();
    const visitId = 'vis-kwame';
    const ordered = planCare(seeded, visitId, {
      diagnosis: 'Needs I&D',
      prescription: '',
      notes: '',
      disposition: 'DISCHARGED',
      serviceIds: ['th-minor'],
    });
    const booked = afterPlanCare(ordered, visitId, 'staff-doctor', '');
    const created = booked.otCases.find((row) => row.visitId === visitId);
    expect(created).toBeTruthy();
    expect(created?.surgeonStaffId).toBe('staff-doctor');
    const done = updateOt(booked, created!.id, { status: 'DONE' }, 'staff-theatre');
    expect(done.otCases.find((row) => row.id === created!.id)?.status).toBe('DONE');
    expect(done.auditLog[0]?.action).toBe('ot_done');
  });

  it('prints an OT list, consent, and op note', () => {
    const state = createSeedState();
    const row = state.otCases[0]!;
    const patient = state.patients.find((item) => item.id === row.patientId)!;
    expect(otBoardHtml(state.otCases, state.patients, state.staff)).toContain(row.procedure);
    expect(otConsentHtml(patient, row)).toContain(patient.hospitalNo);
    expect(opNoteHtml(patient, row, state.staff)).toContain('Operation note');
  });
});
