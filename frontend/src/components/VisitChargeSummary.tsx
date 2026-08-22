import { useState } from 'react';
import { DEPARTMENT_LABELS, formatGhs } from '../workflow/catalog';
import { unpaidOrders, visitBalance } from '../workflow/billing';
import { linesFromOrder } from '../workflow/labPanels';
import type { Department, HospitalService, ServiceOrder, VisitRecord } from '../workflow/types';

export function billLabel(order: ServiceOrder) {
  if (order.chargeable === false) return 'not billed';
  return order.paidAt ? 'paid' : 'unpaid';
}

export function workLabel(order: ServiceOrder) {
  if (order.status === 'DONE') return 'Done';
  if (order.department === 'LAB') return 'Checking';
  return 'Waiting';
}

export function resultPreview(order: ServiceOrder) {
  if (order.department !== 'LAB') return '—';
  if (order.status === 'DONE') {
    const lines = linesFromOrder(order).filter((line) => line.value);
    if (lines.length > 0) return lines.map((line) => `${line.name} ${line.value}`).join(', ');
    return order.result || 'Sent';
  }
  return 'Checking';
}

const cell = 'border border-slate-300 px-2 py-1.5 text-sm';

export default function VisitChargeSummary({
  visit,
  showResults = false,
  managedDepartment,
  onRemoveCharge,
}: {
  visit: VisitRecord;
  showResults?: boolean;
  managedDepartment?: Department;
  onRemoveCharge?: (orderId: string) => void;
}) {
  if (visit.billable === false) {
    return (
      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Not billed{visit.waivedReason ? ` — ${visit.waivedReason}` : ''}.
      </div>
    );
  }
  if (visit.orders.length === 0) {
    return (
      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        No checks on this visit yet. Open billing to add tests.
      </div>
    );
  }
  const unpaid = unpaidOrders(visit);
  const charged = visit.orders.filter((order) => order.chargeable !== false);
  const total = visitBalance(visit);
  const checking = visit.orders.filter((order) => order.department === 'LAB' && order.status === 'ORDERED').length;

  return (
    <div className="mt-3 overflow-x-auto">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-600">
        All checks on this visit
        {checking > 0 ? ` · ${checking} still being checked` : ''}
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className={`${cell} font-semibold`}>Check</th>
            {showResults && <th className={`${cell} font-semibold`}>Work</th>}
            {showResults && <th className={`${cell} font-semibold`}>Result</th>}
            <th className={`${cell} font-semibold`}>Bill</th>
            <th className={`${cell} text-right font-semibold`}>Amount</th>
            {onRemoveCharge && <th className={`${cell} font-semibold`}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {visit.orders.map((order) => (
            <tr key={order.id}>
              <td className={cell}>{order.name}</td>
              {showResults && (
                <td className={`${cell} ${order.status === 'ORDERED' && order.department === 'LAB' ? 'text-amber-800' : 'text-slate-600'}`}>
                  {workLabel(order)}
                </td>
              )}
              {showResults && <td className={`${cell} text-slate-700`}>{resultPreview(order)}</td>}
              <td className={`${cell} ${order.paidAt ? 'text-slate-500' : 'text-amber-800'}`}>{billLabel(order)}</td>
              <td className={`${cell} text-right`}>{order.chargeable === false ? '—' : formatGhs(order.priceGhs)}</td>
              {onRemoveCharge && (
                <td className={cell}>
                  {order.chargeable !== false &&
                  !order.paidAt &&
                  (!managedDepartment || order.department === managedDepartment) ? (
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      onClick={() => onRemoveCharge(order.id)}
                    >
                      Remove bill
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {charged.length > 0 && (
        <p className="mt-1 text-right text-sm font-semibold">
          {unpaid.length > 0 ? `Send to Accounts to pay ${formatGhs(total)}` : `Paid ${formatGhs(charged.reduce((sum, order) => sum + order.priceGhs, 0))}`}
        </p>
      )}
    </div>
  );
}

export function AddChargesPanel({
  visit,
  department,
  services,
  onAdd,
}: {
  visit: VisitRecord;
  department: Department;
  services: HospitalService[];
  onAdd: (visitId: string, serviceIds: string[]) => void;
}) {
  const extras = services.filter(
    (s) => s.enabled && s.department === department && !visit.orders.some((o) => o.serviceId === s.id),
  );
  const [selected, setSelected] = useState<string[]>([]);
  if (extras.length === 0) return null;

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-100 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-clinic-700">
        Bill extra {DEPARTMENT_LABELS[department].toLowerCase()}
      </p>
      <ul className="mt-2 space-y-1">
        {extras.map((s) => (
          <li key={s.id}>
            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                {s.name}
              </span>
              <span className="text-slate-500">{formatGhs(s.priceGhs)}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => {
          onAdd(visit.id, selected);
          setSelected([]);
        }}
        className="mt-2 rounded-lg bg-clinic-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Add to bill
      </button>
    </div>
  );
}
