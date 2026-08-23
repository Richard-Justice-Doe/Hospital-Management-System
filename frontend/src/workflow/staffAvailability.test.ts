import { describe, expect, it } from 'vitest';
import { createSeedState } from './seed';
import { availabilitySummary, buildStaffAvailability, onDutyRows, shiftCoversAt } from './staffAvailability';

describe('staff availability', () => {
  it('marks a mid-shift nurse as on duty', () => {
    const state = createSeedState();
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    const nurseShift = state.shifts.find((shift) => shift.staffId === 'staff-nurse');
    expect(nurseShift).toBeDefined();
    expect(shiftCoversAt(nurseShift!, noon)).toBe(true);
    const rows = buildStaffAvailability(state, noon);
    expect(rows.find((row) => row.staffId === 'staff-nurse')?.status).toMatch(/on_duty|at_desk/);
    expect(availabilitySummary(rows).onDuty).toBeGreaterThan(0);
    expect(onDutyRows(rows).every((row) => row.status === 'on_duty' || row.status === 'at_desk')).toBe(true);
  });

  it('marks staff as off duty when they have no shift covering now', () => {
    const state = createSeedState();
    const night = new Date();
    night.setHours(2, 0, 0, 0);
    const rows = buildStaffAvailability(state, night);
    expect(rows.find((row) => row.staffId === 'staff-dentist')?.status).toBe('off_duty');
  });
});
