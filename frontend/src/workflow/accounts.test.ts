import { describe, expect, it } from 'vitest';
import {
  moneyBooks,
  moneyPeriod,
  payAllUnpaidStaff,
  payStaff,
  setMonthAllocation,
  staffPaidThisPeriod,
  staffSalary,
} from './accounts';
import { receivePurchaseForAccounts } from './supportDesks';
import { createSeedState } from './seed';

describe('accountant money books', () => {
  it('shows allocated, spent, remaining, and pays workers', () => {
    const seeded = createSeedState();
    const start = moneyBooks(seeded);
    expect(start.period).toBe(moneyPeriod());
    expect(start.allocated).toBe(120000);
    expect(start.spent).toBe(0);
    expect(start.remaining).toBe(120000);
    expect(staffSalary(seeded.staff.find((item) => item.id === 'staff-nurse')!)).toBeGreaterThan(0);

    const paidOne = payStaff(seeded, 'staff-nurse', 'staff-accountant');
    expect(staffPaidThisPeriod(paidOne, 'staff-nurse')?.amountGhs).toBe(staffSalary(paidOne.staff.find((item) => item.id === 'staff-nurse')!));
    expect(payStaff(paidOne, 'staff-nurse', 'staff-accountant').payroll).toHaveLength(paidOne.payroll.length);

    const bought = receivePurchaseForAccounts(paidOne, 'po-gauze', 'staff-accountant');
    const afterBuy = moneyBooks(bought);
    expect(afterBuy.purchasesSpent).toBe(95);
    expect(afterBuy.spent).toBe(afterBuy.wagesPaid + 95);
    expect(afterBuy.remaining).toBe(120000 - afterBuy.spent);

    const raised = setMonthAllocation(bought, 150000, 'staff-accountant');
    expect(moneyBooks(raised).allocated).toBe(150000);
    expect(moneyBooks(raised).remaining).toBe(150000 - moneyBooks(raised).spent);

    const allPaid = payAllUnpaidStaff(seeded, 'staff-accountant');
    expect(moneyBooks(allPaid).unpaidCount).toBe(0);
    expect(moneyBooks(allPaid).wagesPaid).toBeGreaterThan(0);
  });
});
