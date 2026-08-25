import { describe, expect, it } from 'vitest';
import { HIS_CLINIC_LABELS, serviceHisCode } from './catalog';
import { expiryTone, expiredCoverAsPrivateMessage, lastVisitDate, nhisCoverExpired, visitMissingRequiredCc } from './patientAdmin';

describe('HIS check-in helpers', () => {
  it('maps clinics and service codes used on the check-in list', () => {
    expect(HIS_CLINIC_LABELS.GENERAL).toBe('GENERAL CONSULTATION');
    expect(HIS_CLINIC_LABELS.EYE).toBe('EYE CLINIC');
    expect(serviceHisCode('opd-general')).toBe('OPDC05A');
    expect(serviceHisCode('opd-review')).toBe('OPDC06A');
  });

  it('finds the previous visit date and colours a valid card expiry', () => {
    expect(
      lastVisitDate(
        [
          { id: 'v1', patientId: 'p1', checkedInAt: '2026-08-22T09:00:00.000Z' },
          { id: 'v2', patientId: 'p1', checkedInAt: '2026-04-01T09:00:00.000Z' },
        ],
        'p1',
        'v1',
      ),
    ).toBe('2026-04-01');
    expect(expiryTone('2027-04-15', new Date('2026-08-24'))).toBe('ok');
    expect(expiryTone('2025-01-01', new Date('2026-08-24'))).toBe('expired');
  });

  it('treats expired NHIS / HIN / Ghana Card cover as private for this visit', () => {
    expect(
      nhisCoverExpired(
        { insuranceType: 'GOVERNMENT', preferredPayment: 'NHIS', nhisExpires: '2025-01-01', nhisStatus: 'ACTIVE' },
        new Date('2026-08-24'),
      ),
    ).toBe(true);
    expect(
      nhisCoverExpired(
        { insuranceType: 'GOVERNMENT', preferredPayment: 'NHIS', nhisExpires: '2027-04-15', nhisStatus: 'ACTIVE' },
        new Date('2026-08-24'),
      ),
    ).toBe(false);
    expect(
      nhisCoverExpired(
        { insuranceType: 'GOVERNMENT', preferredPayment: 'NHIS', nhisStatus: 'EXPIRED' },
        new Date('2026-08-24'),
      ),
    ).toBe(true);
    expect(
      nhisCoverExpired({ insuranceType: 'CASH', preferredPayment: 'CASH', nhisExpires: '2025-01-01' }, new Date('2026-08-24')),
    ).toBe(false);
    expect(expiredCoverAsPrivateMessage({ firstName: 'Amara', lastName: 'Owusu', gender: 'Female' })).toMatch(
      /will be checked in as Private/,
    );
    expect(
      visitMissingRequiredCc(
        { insuranceType: 'GOVERNMENT', preferredPayment: 'NHIS' },
        { nhisCcCode: '', coverAsPrivate: true },
      ),
    ).toBe(false);
  });
});
