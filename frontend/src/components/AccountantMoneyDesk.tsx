import { useMemo, useState } from 'react';
import { formatGhs } from '../workflow/catalog';
import {
  moneyBooks,
  moneyPeriod,
  payAllUnpaidStaff,
  payStaff,
  setMonthAllocation,
  setStaffSalary,
  staffPaidThisPeriod,
  staffSalary,
} from '../workflow/accounts';
import { ROLE_LABELS, type CareState } from '../workflow/types';
import { btnPrimary, btnSecondary, Field, inputClass } from '../pages/admin/adminUi';

export default function AccountantMoneyDesk({
  state,
  staffId,
  onChange,
}: {
  state: CareState;
  staffId: string;
  onChange: (update: (current: CareState) => CareState) => void;
}) {
  const books = useMemo(() => moneyBooks(state), [state]);
  const [allocation, setAllocation] = useState(String(books.allocated || 120000));
  const [salaries, setSalaries] = useState<Record<string, string>>({});

  const workers = useMemo(
    () =>
      state.staff
        .filter((item) => item.isActive)
        .slice()
        .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)),
    [state.staff],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border-2 border-clinic-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Money this month ({books.period})</h2>
        <p className="mt-1 text-sm text-slate-500">
          Allocated is the month’s budget. Spent is wages paid plus purchases taken onto the books. Remaining is what is left of the allocation.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MoneyCard label="Allocated" amount={books.allocated} />
          <MoneyCard label="Spent" amount={books.spent} />
          <MoneyCard label="Remaining" amount={books.remaining} warn={books.remaining < 0} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <MoneyCard label="Received from patients" amount={books.receivedPatients} />
          <MoneyCard label="Received from claims" amount={books.receivedClaims} />
          <MoneyCard label="Wages still to pay" amount={books.wagesDue} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Spent breakdown: wages {formatGhs(books.wagesPaid)} · purchases {formatGhs(books.purchasesSpent)}. {books.unpaidCount} worker
          {books.unpaidCount === 1 ? '' : 's'} unpaid this month.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="Set this month’s allocation (GHS)">
            <input className={inputClass} inputMode="decimal" value={allocation} onChange={(e) => setAllocation(e.target.value)} />
          </Field>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => onChange((current) => setMonthAllocation(current, Number(allocation), staffId))}
          >
            Save allocation
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pay workers</h2>
            <p className="mt-1 text-sm text-slate-500">Pay monthly salaries into the books for {moneyPeriod()}.</p>
          </div>
          <button type="button" className={btnSecondary} onClick={() => onChange((current) => payAllUnpaidStaff(current, staffId))}>
            Pay all unpaid
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border border-slate-200 px-3 py-2 font-semibold">Worker</th>
                <th className="border border-slate-200 px-3 py-2 font-semibold">Role</th>
                <th className="border border-slate-200 px-3 py-2 font-semibold">Monthly pay</th>
                <th className="border border-slate-200 px-3 py-2 font-semibold">Status</th>
                <th className="border border-slate-200 px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => {
                const paid = staffPaidThisPeriod(state, worker.id);
                const value = salaries[worker.id] ?? String(staffSalary(worker));
                return (
                  <tr key={worker.id}>
                    <td className="border border-slate-200 px-3 py-2">
                      {worker.firstName} {worker.lastName}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">{ROLE_LABELS[worker.role]}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      <input
                        className={`${inputClass} max-w-[8rem]`}
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => setSalaries((cur) => ({ ...cur, [worker.id]: e.target.value }))}
                        onBlur={() => onChange((current) => setStaffSalary(current, worker.id, Number(value)))}
                      />
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {paid ? <span className="font-semibold text-emerald-800">Paid {formatGhs(paid.amountGhs)}</span> : 'Unpaid'}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {paid ? (
                        <span className="text-xs text-slate-500">This month</span>
                      ) : (
                        <button
                          type="button"
                          className={btnPrimary}
                          onClick={() =>
                            onChange((current) => payStaff(setStaffSalary(current, worker.id, Number(value)), worker.id, staffId, Number(value)))
                          }
                        >
                          Pay {formatGhs(Number(value) || staffSalary(worker))}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MoneyCard({ label, amount, warn }: { label: string; amount: number; warn?: boolean }) {
  return (
    <article className={`rounded-xl border p-4 ${warn ? 'border-red-200 bg-red-50' : 'bg-slate-50'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${warn ? 'text-red-800' : 'text-clinic-900'}`}>{formatGhs(amount)}</p>
    </article>
  );
}
