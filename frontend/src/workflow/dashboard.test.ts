import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot } from './dashboard';
import { createSeedState } from './seed';

describe('department dashboard', () => {
  it('counts visits, registrations, NHIS, private, and check-ins', () => {
    const snapshot = buildDashboardSnapshot(createSeedState(), 'all');
    expect(snapshot.hospital.visits).toBe(5);
    expect(snapshot.hospital.checkIns).toBe(5);
    expect(snapshot.hospital.registration).toBe(5);
    expect(snapshot.hospital.nhis).toBe(3);
    expect(snapshot.hospital.private).toBe(2);
    const general = snapshot.departments.find((row) => row.id === 'GENERAL');
    expect(general?.visits).toBeGreaterThan(0);
    const records = snapshot.departments.find((row) => row.id === 'RECORDS');
    expect(records?.registration).toBe(5);
    expect(snapshot.trend.length).toBeGreaterThan(0);
    expect(snapshot.trend.reduce((sum, point) => sum + point.visits, 0)).toBe(4);
  });
});
