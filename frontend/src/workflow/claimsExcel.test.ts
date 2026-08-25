import { describe, expect, it } from 'vitest';
import { accountantClaimPack, accountantClaimsExcelXml, accountantExcelFilename } from './claimsExcel';
import { upsertClaim } from './his';
import { createSeedState } from './seed';

describe('accountant claims Excel', () => {
  it('builds an Excel workbook of submitted claims for the accountant', () => {
    const submitted = upsertClaim(createSeedState(), { visitId: 'vis-amara', status: 'SUBMITTED' });
    const pack = accountantClaimPack(submitted);
    expect(pack.claims.length).toBeGreaterThan(0);
    expect(pack.claims.some((row) => row.scheme.includes('NHIS'))).toBe(true);
    expect(pack.claims.some((row) => row.ccCode === '20491')).toBe(true);
    expect(pack.totalGhs).toBeGreaterThan(0);
    expect(pack.lines.length).toBeGreaterThan(0);
    const xml = accountantClaimsExcelXml(submitted);
    expect(xml).toContain('CC code');
    expect(xml).toContain('Excel.Sheet');
    expect(xml).toContain('For accountant');
    expect(xml).toContain('Service lines');
    expect(xml).toContain('check this list before sending to NHIS');
    expect(accountantExcelFilename(new Date('2026-08-23T08:00:00Z'))).toBe('claims-for-accountant-2026-08-23.xls');
  });
});
