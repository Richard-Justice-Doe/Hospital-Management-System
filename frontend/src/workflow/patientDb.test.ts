import { describe, expect, it } from 'vitest';
import {
  findByHospitalNo,
  formatManualFolderNo,
  nextFolderNoForDate,
  nextFolderSeqForYear,
  parseFolderNo,
} from './patientDb';
import type { PatientRecord } from './types';

function patient(hospitalNo: string): PatientRecord {
  return {
    id: hospitalNo,
    hospitalNo,
    firstName: 'Test',
    lastName: hospitalNo,
    age: 20,
    gender: 'Female',
    phone: '0240000000',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('folder numbers A1/year to A10000/year', () => {
  it('parses A12/2026, 12, and older 2026/12 numbers', () => {
    expect(parseFolderNo('A12/2026')).toEqual({ seq: 12, year: 2026 });
    expect(parseFolderNo('a12-2026')).toEqual({ seq: 12, year: 2026 });
    expect(parseFolderNo('2026/12')).toEqual({ year: 2026, seq: 12 });
    expect(parseFolderNo('12')).toEqual({ seq: 12 });
    expect(formatManualFolderNo('12', '2026-08-20')).toBe('A12/2026');
    expect(formatManualFolderNo('2026/12', '2026-08-20')).toBe('A12/2026');
  });

  it('continues A1 to A10000 in the same year, then starts A1 in the next year', () => {
    const patients = [patient('A1/2026'), patient('A5/2026')];
    expect(nextFolderSeqForYear(patients, 2026)).toBe(6);
    expect(nextFolderNoForDate(patients, '2026-12-31')).toBe('A6/2026');
    expect(nextFolderNoForDate(patients, '2027-01-01')).toBe('A1/2027');
  });

  it('looks up a folder by A1, A1/2026, or an old CH number', () => {
    const patients = [patient('A1/2026'), patient('A2/2026')];
    expect(findByHospitalNo(patients, 'A1/2026')?.hospitalNo).toBe('A1/2026');
    expect(findByHospitalNo(patients, 'A2')?.hospitalNo).toBe('A2/2026');
    expect(findByHospitalNo(patients, 'CH-00001')?.hospitalNo).toBe('A1/2026');
  });
});
