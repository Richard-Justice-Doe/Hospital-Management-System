import { describe, expect, it } from 'vitest';
import {
  canReceivePayment,
  canRemoveBill,
  collectionsSummary,
  paidAmount,
  patientDepositBalance,
  postExternalReceipt,
  postPatientDeposit,
  salesSummaryByUser,
} from './billing';
import { createSeedState } from './seed';
import { payAmountTowardBill, payBill, removeCharge, voidVisitPayment } from './store';
import { hasGhanaNhiss, patientAgeLabel, previousVisitCcCode, visitMissingRequiredCc } from './patientAdmin';
import { canControlDepartment } from './types';

describe('collections and department in-charge', () => {
  it('counts received amounts for today, this month, and this year', () => {
    const state = createSeedState();
    const latestPaid = state.visits
      .flatMap((visit) => visit.orders)
      .map((order) => order.paidAt)
      .filter((paidAt): paidAt is string => Boolean(paidAt))
      .sort()
      .at(-1);
    const now = latestPaid ? new Date(latestPaid) : new Date();
    const today = paidAmount(state, 'day', now);
    const month = paidAmount(state, 'month', now);
    const year = paidAmount(state, 'year', now);
    const totals = collectionsSummary(state, now);
    expect(today).toBeGreaterThan(0);
    expect(month).toBeGreaterThanOrEqual(today);
    expect(year).toBeGreaterThanOrEqual(month);
    expect(totals.day).toBe(today);
    expect(totals.year).toBe(year);
  });

  it('lets an in-charge remove an unpaid department bill', () => {
    const state = createSeedState();
    const visit = state.visits.find((item) => item.id === 'vis-lisa');
    const order = visit?.orders.find((item) => item.department === 'CONSULTATION');
    expect(order?.chargeable).not.toBe(false);
    const next = removeCharge(state, 'vis-lisa', order!.id);
    const updated = next.visits.find((item) => item.id === 'vis-lisa')?.orders.find((item) => item.id === order!.id);
    expect(updated?.chargeable).toBe(false);
  });

  it('does not reverse a paid bill', () => {
    const state = createSeedState();
    const visit = state.visits.find((item) => item.id === 'vis-omar');
    const paid = visit?.orders.find((item) => item.paidAt);
    const next = removeCharge(state, 'vis-omar', paid!.id);
    const updated = next.visits.find((item) => item.id === 'vis-omar')?.orders.find((item) => item.id === paid!.id);
    expect(updated?.paidAt).toBeTruthy();
    expect(updated?.chargeable).not.toBe(false);
  });

  it('records Ghana Card and HIN as NHIS cover', () => {
    const state = createSeedState();
    const patient = state.patients.find((item) => item.id === 'pat-amara');
    const visit = state.visits.find((item) => item.id === 'vis-amara');
    expect(hasGhanaNhiss(patient)).toBe(true);
    expect(visitMissingRequiredCc(patient, visit)).toBe(false);
    expect(visitMissingRequiredCc(patient, { nhisCcCode: undefined })).toBe(true);
    expect(visitMissingRequiredCc(patient, { nhisCcCode: undefined }, '20491')).toBe(false);
    expect(visitMissingRequiredCc(patient, { nhisCcCode: undefined }, '204918')).toBe(true);
    expect(visitMissingRequiredCc(patient, { nhisCcCode: undefined }, '2049')).toBe(true);
    expect(visitMissingRequiredCc(state.patients.find((item) => item.id === 'pat-lisa'), { nhisCcCode: undefined })).toBe(false);
    expect(hasGhanaNhiss({ insuranceType: 'GOVERNMENT' })).toBe(true);
    expect(hasGhanaNhiss({ hinNumber: 'HIN-2049183' })).toBe(true);
    expect(hasGhanaNhiss({ ghanaCardNo: 'GHA-123456789-1' })).toBe(true);
    expect(visitMissingRequiredCc({ insuranceType: 'GOVERNMENT', hinNumber: 'HIN-1' }, { nhisCcCode: undefined })).toBe(true);
    expect(hasGhanaNhiss({ insuranceType: 'CASH', ghanaCardNo: 'GHA-123456789-1' })).toBe(false);
    expect(hasGhanaNhiss({ insuranceType: 'PRIVATE', insuranceNumber: 'AH-1' })).toBe(false);
    expect(previousVisitCcCode(state.visits, 'pat-amara')).toBe('20491');
    expect(previousVisitCcCode(state.visits, 'pat-amara', 'vis-amara')).toBeUndefined();
  });

  it('prints age as years and months for generate bill', () => {
    expect(patientAgeLabel({ age: 28, dateOfBirth: '1998-07-24' }, new Date('2026-08-24'))).toBe('28 years, 1 month');
    expect(patientAgeLabel({ age: 7 }, new Date('2026-08-24'))).toBe('7 years');
  });

  it('can take part of a bill now and leave the rest', () => {
    const next = payAmountTowardBill(createSeedState(), 'vis-nina', 20, 'staff-cashier', 'MOMO');
    const visit = next.visits.find((item) => item.id === 'vis-nina');
    expect(visit?.orders[0]?.paidAt).toBeTruthy();
    expect(visit?.paymentMethod).toBe('MOMO');
  });

  it('can undo a payment marked by mistake', () => {
    const paid = payBill(createSeedState(), 'vis-nina', 'staff-cashier');
    expect(paid.visits.find((item) => item.id === 'vis-nina')?.orders[0]?.paidAt).toBeTruthy();
    const undone = voidVisitPayment(paid, 'vis-nina');
    const visit = undone.visits.find((item) => item.id === 'vis-nina');
    expect(visit?.orders[0]?.paidAt).toBeUndefined();
    expect(visit?.stage).toBe('CHECKED_IN');
  });

  it('lets only the cashier receive money, and never lets the cashier remove a bill', () => {
    expect(canReceivePayment('CASHIER')).toBe(true);
    expect(canReceivePayment('ADMIN')).toBe(false);
    expect(canReceivePayment('ACCOUNTANT')).toBe(false);
    expect(canReceivePayment('RECEPTIONIST')).toBe(false);
    expect(canRemoveBill({ role: 'ADMIN' })).toBe(true);
    expect(canRemoveBill({ role: 'ADMIN' }, 'LAB')).toBe(true);
    expect(canRemoveBill({ role: 'CASHIER' })).toBe(false);
    expect(canRemoveBill({ role: 'NURSE', inChargeOf: 'NURSING' }, 'NURSING')).toBe(true);
    expect(canRemoveBill({ role: 'NURSE', inChargeOf: 'NURSING' }, 'LAB')).toBe(false);
    expect(canRemoveBill({ role: 'NURSE', inChargeOf: 'NURSING' }, 'PHARMACY')).toBe(false);
    expect(canRemoveBill({ role: 'LAB', inChargeOf: 'LAB' }, 'LAB')).toBe(true);
    expect(canRemoveBill({ role: 'LAB', inChargeOf: 'LAB' }, 'CONSULTATION')).toBe(false);
    expect(canRemoveBill({ role: 'RECEPTIONIST', inChargeOf: 'RECORDS' }, 'RECORDS')).toBe(true);
    expect(canRemoveBill({ role: 'RECEPTIONIST', inChargeOf: 'RECORDS' }, 'CONSULTATION')).toBe(false);
    expect(canRemoveBill({ role: 'NURSE' }, 'NURSING')).toBe(false);
  });

  it('lets admin and the matching in-charge control a department', () => {
    expect(canControlDepartment({ role: 'ADMIN' }, 'LAB')).toBe(true);
    expect(canControlDepartment({ role: 'LAB', inChargeOf: 'LAB' }, 'LAB')).toBe(true);
    expect(canControlDepartment({ role: 'LAB' }, 'LAB')).toBe(false);
    expect(canControlDepartment({ role: 'LAB', inChargeOf: 'LAB' }, 'PHARMACY')).toBe(false);
    expect(canControlDepartment({ role: 'CASHIER' }, 'LAB')).toBe(false);
    expect(canControlDepartment({ role: 'MATRON' }, 'NURSING')).toBe(true);
    expect(canControlDepartment({ role: 'MATRON' }, 'WARD')).toBe(true);
    expect(canControlDepartment({ role: 'MATRON' }, 'MATERNITY')).toBe(true);
    expect(canControlDepartment({ role: 'MATRON' }, 'LAB')).toBe(false);
  });

  it('posts a patient deposit onto the folder and counts it in sales', () => {
    const seed = createSeedState();
    const before = paidAmount(seed, 'day');
    const next = postPatientDeposit(seed, { patientId: 'pat-amara', amountGhs: 80, staffId: 'staff-cashier', method: 'CASH' });
    expect(patientDepositBalance(next, 'pat-amara')).toBe(80);
    expect(next.patientDeposits[0]?.receiptNo).toMatch(/^RCP-/);
    expect(paidAmount(next, 'day')).toBe(before + 80);
    const sales = salesSummaryByUser(next, 'day');
    const cashier = sales.find((row) => row.staffId === 'staff-cashier');
    expect(cashier?.amount).toBeGreaterThanOrEqual(80);
  });

  it('prints an external receipt take without changing a visit bill', () => {
    const seed = createSeedState();
    const nina = seed.visits.find((item) => item.id === 'vis-nina');
    const due = nina?.orders.reduce((sum, order) => sum + (order.paidAt ? 0 : order.priceGhs), 0) ?? 0;
    const next = postExternalReceipt(seed, {
      payerName: 'Kwame Mensah',
      amountGhs: 25,
      description: 'Folder copy fee',
      staffId: 'staff-cashier',
    });
    expect(next.externalReceipts[0]?.receiptNo).toMatch(/^RCP-/);
    expect(next.externalReceipts[0]?.payerName).toBe('Kwame Mensah');
    expect(next.visits.find((item) => item.id === 'vis-nina')?.orders[0]?.paidAt).toBeFalsy();
    const stillDue = next.visits.find((item) => item.id === 'vis-nina')?.orders.reduce((sum, order) => sum + (order.paidAt ? 0 : order.priceGhs), 0);
    expect(stillDue).toBe(due);
  });
});
