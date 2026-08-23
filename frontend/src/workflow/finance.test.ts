import { describe, expect, it } from 'vitest';
import { createSeedState } from './seed';
import {
  agingSummary,
  canSeeClinicalFinance,
  financeDashboard,
  invoiceRows,
  periodIsLocked,
  profitAndLoss,
  requestFinanceAdjust,
  lockFinancePeriod,
  REFUND_APPROVAL_GHS,
} from './finance';
import { effectivePages } from './permissions';

describe('accountant finance books', () => {
  it('builds aging, dashboard alerts, and a P&L from live bills', () => {
    const state = createSeedState();
    const invoices = invoiceRows(state);
    expect(invoices.length).toBeGreaterThan(0);
    const aging = agingSummary(state);
    expect(aging['0-30'].amount + aging['31-60'].amount + aging['61-90'].amount + aging['90+'].amount).toBeGreaterThanOrEqual(0);
    const dash = financeDashboard(state);
    expect(dash.revenue.year).toBeGreaterThan(0);
    expect(dash.claims.denied).toBeGreaterThan(0);
    expect(dash.cash.bank).toBeGreaterThan(0);
    expect(profitAndLoss(state).income).toBeGreaterThanOrEqual(0);
  });

  it('keeps voids on an audit trail and does not hard-delete the visit', () => {
    const seeded = createSeedState();
    const next = requestFinanceAdjust(seeded, {
      visitId: 'vis-nina',
      kind: 'VOID',
      amountGhs: 20,
      reasonCode: 'ERROR',
      reason: 'Opened in error',
      staffId: 'staff-accountant',
      role: 'ACCOUNTANT',
    });
    expect(next.visits.find((item) => item.id === 'vis-nina')).toBeTruthy();
    expect(next.visits.find((item) => item.id === 'vis-nina')?.billable).toBe(false);
    expect(next.financeAdjustments[0]?.kind).toBe('VOID');
    expect(next.auditLog[0]?.action).toMatch(/void/i);
  });

  it('holds large refunds for admin approval and locks a closed period', () => {
    const seeded = createSeedState();
    const pending = requestFinanceAdjust(seeded, {
      visitId: 'vis-nina',
      kind: 'REFUND',
      amountGhs: REFUND_APPROVAL_GHS,
      reasonCode: 'ERROR',
      reason: 'Paid twice',
      staffId: 'staff-accountant',
      role: 'ACCOUNTANT',
    });
    expect(pending.financeAdjustments[0]?.status).toBe('PENDING');
    const locked = lockFinancePeriod(seeded, '2020-01', 'staff-accountant');
    expect(periodIsLocked(locked, '2020-01-15T00:00:00.000Z')).toBe(true);
  });

  it('hides the clinical chart from the accountant', () => {
    const pages = effectivePages({ role: 'ACCOUNTANT' });
    expect(pages).toContain('collections');
    expect(pages).not.toContain('clinical');
    expect(pages).not.toContain('chart');
    expect(canSeeClinicalFinance('ACCOUNTANT')).toBe(false);
    expect(canSeeClinicalFinance('DOCTOR')).toBe(true);
  });
});
