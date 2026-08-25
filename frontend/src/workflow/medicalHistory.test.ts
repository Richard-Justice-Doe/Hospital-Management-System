import { describe, expect, it } from 'vitest';
import { patientHistoryRows } from './medicalHistory';
import { createSeedState } from './seed';

describe('patient medical history', () => {
  it('lists OPD vital signs and complaints for a visit', () => {
    const state = createSeedState();
    const rows = patientHistoryRows(state, 'pat-lisa', 'opd');
    expect(rows.some((row) => row.description === 'Vital Signs' && row.details.includes('Blood Pressure'))).toBe(true);
    expect(rows.some((row) => row.description === 'Complaints')).toBe(true);
  });
});
