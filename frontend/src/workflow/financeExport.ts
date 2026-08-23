import { moneyBooks, moneyPeriod, payrollForPeriod, staffSalary } from './accounts';
import { DEPARTMENT_LABELS, formatGhs } from './catalog';
import { downloadText } from './his';
import {
  invoiceRows,
  profitAndLoss,
  revenueByDepartment,
  staffCostByDepartment,
} from './finance';
import type { CareState } from './types';

function csv(rows: Array<Array<string | number>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell);
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(','),
    )
    .join('\n');
}

export function downloadInvoicesCsv(state: CareState): void {
  const rows = [
    ['Invoice', 'Date', 'Patient', 'Folder', 'Payer', 'Clinic', 'Total', 'Paid', 'Due', 'Status'],
    ...invoiceRows(state).map((row) => [
      row.visit.receiptNo ?? row.visit.id,
      row.date.slice(0, 10),
      row.patientName,
      row.hospitalNo,
      row.payer,
      row.clinic,
      row.total.toFixed(2),
      row.paid.toFixed(2),
      row.due.toFixed(2),
      row.status,
    ]),
  ];
  downloadText(`invoices-${moneyPeriod()}.csv`, csv(rows), 'text/csv');
}

export function downloadPayrollCsv(state: CareState): void {
  const period = moneyPeriod();
  const paid = payrollForPeriod(state, period);
  const rows = [
    ['Period', 'Worker', 'Role', 'Department', 'Salary', 'Paid'],
    ...state.staff
      .filter((item) => item.isActive)
      .map((item) => [
        period,
        `${item.firstName} ${item.lastName}`,
        item.role,
        item.department ? DEPARTMENT_LABELS[item.department] : 'Administration',
        staffSalary(item).toFixed(2),
        paid.find((row) => row.staffId === item.id)?.amountGhs.toFixed(2) ?? '0.00',
      ]),
  ];
  downloadText(`payroll-${period}.csv`, csv(rows), 'text/csv');
}

export function downloadFinancePackCsv(state: CareState): void {
  const pnl = profitAndLoss(state);
  const books = moneyBooks(state);
  const rows = [
    ['Statement', 'Amount GHS'],
    ['Patient revenue', pnl.patientRevenue.toFixed(2)],
    ['Claims remittance', pnl.claimsRevenue.toFixed(2)],
    ['Wages', pnl.wages.toFixed(2)],
    ['Purchases', pnl.purchases.toFixed(2)],
    ['VAT estimate 15%', pnl.vat.toFixed(2)],
    ['Surplus', pnl.surplus.toFixed(2)],
    ['Allocated', books.allocated.toFixed(2)],
    ['Spent', books.spent.toFixed(2)],
    ['Remaining', books.remaining.toFixed(2)],
    ...revenueByDepartment(state).map((row) => [`Revenue · ${row.label}`, row.amountGhs.toFixed(2)]),
    ...staffCostByDepartment(state).map((row) => [`Staff cost · ${row.label}`, (row.paid + row.due).toFixed(2)]),
  ];
  downloadText(`finance-pack-${moneyPeriod()}.csv`, csv(rows), 'text/csv');
}

export function financePackSummary(state: CareState): string {
  const pnl = profitAndLoss(state);
  return `P&L surplus ${formatGhs(pnl.surplus)} · income ${formatGhs(pnl.income)}`;
}
