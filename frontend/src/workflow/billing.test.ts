import { describe, expect, it } from 'vitest';
import { collectionsSummary, paidAmount } from './billing';
import { createSeedState } from './seed';
import { removeCharge } from './store';
import { canControlDepartment } from './types';

describe('collections and department in-charge', () => {
  it('counts received amounts for today, this month, and this year', () => {
    const state = createSeedState();
    const now = new Date();
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

  it('lets admin and the matching in-charge control a department', () => {
    expect(canControlDepartment({ role: 'ADMIN' }, 'LAB')).toBe(true);
    expect(canControlDepartment({ role: 'LAB', inChargeOf: 'LAB' }, 'LAB')).toBe(true);
    expect(canControlDepartment({ role: 'LAB' }, 'LAB')).toBe(false);
    expect(canControlDepartment({ role: 'LAB', inChargeOf: 'LAB' }, 'PHARMACY')).toBe(false);
    expect(canControlDepartment({ role: 'CASHIER' }, 'LAB')).toBe(false);
  });
});
