import { createSeedState } from './seed';
import { describe, expect, it } from 'vitest';
import {
  afterLabResults,
  evaluateCds,
  findDuplicatePatients,
  grantBreakGlass,
  hasBreakGlass,
  mergePatients,
  qualityMetrics,
  scheduleShift,
  upsertClaim,
  verifyEligibility,
} from './his';

describe('HIS layer', () => {
  it('flags penicillin allergy against amoxicillin', () => {
    const state = createSeedState();
    const alerts = evaluateCds(state, 'pat-kwame', 'Amoxicillin 500mg TDS', ['rx-amox']);
    expect(alerts.some((a) => a.severity === 'critical')).toBe(true);
  });

  it('assigns accession numbers and hashes audit on critical HIV result', () => {
    const seeded = createSeedState();
    const visit = seeded.visits.find((v) => v.id === 'vis-kwame');
    expect(visit).toBeTruthy();
    const withOrder = {
      ...seeded,
      visits: seeded.visits.map((v) =>
        v.id === 'vis-kwame'
          ? {
              ...v,
              orders: [
                ...v.orders,
                {
                  id: 'ord-hiv',
                  serviceId: 'lab-hiv',
                  name: 'HIV screening',
                  department: 'LAB' as const,
                  priceGhs: 30,
                  status: 'DONE' as const,
                },
              ],
            }
          : v,
      ),
    };
    const next = afterLabResults(
      withOrder,
      'vis-kwame',
      [{ orderId: 'ord-hiv', labLines: [{ id: 'hiv', name: 'HIV screening', value: 'Reactive', unit: '', flag: 'H' }] }],
      'staff-lab',
    );
    expect(next.samples[0]?.accessionNo).toMatch(/^ACC-/);
    expect(next.notifications.some((n) => n.kind === 'critical')).toBe(true);
    expect(next.auditLog[0]?.hash).toBeTruthy();
    expect(next.auditLog[0]?.prevHash).toBe('genesis');
  });

  it('merges duplicate charts onto the surviving MRN', () => {
    const seeded = createSeedState();
    const clone = { ...seeded.patients[0], id: 'pat-amara-dup', hospitalNo: 'CH-00999' };
    const withDup = { ...seeded, patients: [clone, ...seeded.patients] };
    expect(findDuplicatePatients(withDup.patients, clone).some((p) => p.id === 'pat-amara')).toBe(true);
    const merged = mergePatients(withDup, 'pat-amara', 'pat-amara-dup', 'staff-reception');
    expect(merged.patients.find((p) => p.id === 'pat-amara-dup')?.mergedIntoId).toBe('pat-amara');
  });

  it('requires break-glass expiry in the future', () => {
    const next = grantBreakGlass(createSeedState(), {
      patientId: 'pat-kwame',
      staffId: 'staff-nurse',
      reason: 'Emergency review of psych note',
    });
    expect(hasBreakGlass(next, 'pat-kwame', 'staff-nurse')).toBe(true);
    expect(next.auditLog[0]?.action).toBe('break_glass');
  });

  it('lets in-charge schedule a department shift and notify the worker', () => {
    const result = scheduleShift(createSeedState(), {
      staffId: 'staff-lab',
      department: 'LAB',
      day: '2026-08-22',
      startHour: 7,
      endHour: 15,
      createdBy: 'staff-lab-head',
      note: 'Cover chemistry bench',
    });
    expect(result.error).toBeUndefined();
    expect(result.shift?.staffId).toBe('staff-lab');
    expect(result.state.shifts.some((sh) => sh.id === result.shift?.id && sh.department === 'LAB')).toBe(true);
    expect(result.state.notifications.some((n) => n.kind === 'shift' && n.staffId === 'staff-lab')).toBe(true);
  });

  it('builds a demo claim and NHIS eligibility stub', () => {
    const seeded = createSeedState();
    expect(verifyEligibility(seeded, 'pat-amara').ok).toBe(true);
    const claimed = upsertClaim(seeded, { visitId: 'vis-amara', status: 'SUBMITTED' });
    expect(claimed.claims[0]?.claimNo).toMatch(/^CLM-/);
    expect(qualityMetrics(claimed).visits).toBeGreaterThan(0);
  });
});
