import { linesFromOrder, linesFromValues, panelFor } from '../workflow/labPanels';
import { billLabel, workLabel } from './VisitChargeSummary';
import type { LabLine, ServiceOrder } from '../workflow/types';

const cell = 'border border-slate-800 px-2 py-1.5 text-sm';

export default function CombinedLabSheet({
  orders,
  valuesByOrder,
  onChange,
  onSendOne,
  editable = true,
}: {
  orders: ServiceOrder[];
  valuesByOrder?: Record<string, Record<string, string>>;
  onChange?: (orderId: string, id: string, value: string) => void;
  onSendOne?: (orderId: string) => void;
  editable?: boolean;
}) {
  const groups = orders.map((order) => {
    const defs = panelFor(order.serviceId, order.name);
    const pending = order.status === 'ORDERED';
    const values = pending ? (valuesByOrder?.[order.id] ?? {}) : Object.fromEntries((order.labLines ?? []).map((line) => [line.id, line.value]));
    const filled = pending ? linesFromValues(defs, values) : linesFromOrder(order);
    const lines: LabLine[] =
      filled.length > 0
        ? filled
        : [{ id: order.serviceId, name: order.name, value: order.result ?? '', unit: '', flag: '' }];
    return { order, defs, values, lines, pending };
  });

  if (groups.length === 0) {
    return <p className="text-sm text-slate-500">No lab checks on this visit.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className={`${cell} text-left font-semibold`}>Check</th>
            <th className={`${cell} text-left font-semibold`}>Test</th>
            <th className={`${cell} text-right font-semibold`}>Result</th>
            <th className={`${cell} w-12 text-center font-semibold`}> </th>
            <th className={`${cell} text-left font-semibold`}>Unit</th>
            <th className={`${cell} text-left font-semibold`}>Work</th>
            <th className={`${cell} text-left font-semibold`}>Bill</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ order, defs, values, lines, pending }) =>
            lines.map((line, index) => {
              const def = defs.find((item) => item.id === line.id);
              const value = pending && editable ? (values[line.id] ?? line.value) : line.value;
              const canEdit = Boolean(editable && pending);
              return (
                <tr key={`${order.id}-${line.id}`}>
                  {index === 0 && (
                    <td className={`${cell} align-top font-medium`} rowSpan={lines.length}>
                      {order.name}
                      {canEdit && onSendOne && groups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onSendOne(order.id)}
                          className="mt-1 block text-xs font-medium text-clinic-700 hover:underline"
                        >
                          Send this check
                        </button>
                      )}
                    </td>
                  )}
                  <td className={cell}>{line.name}</td>
                  <td className={`${cell} text-right`}>
                    {canEdit ? (
                      def?.type === 'choice' ? (
                        <select
                          value={value}
                          onChange={(event) => onChange?.(order.id, line.id, event.target.value)}
                          className="w-full bg-white text-right outline-none"
                        >
                          <option value=""> </option>
                          {def.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={value}
                          onChange={(event) => onChange?.(order.id, line.id, event.target.value)}
                          className="w-full bg-white text-right outline-none"
                          aria-label={`${order.name} ${line.name}`}
                        />
                      )
                    ) : (
                      value || '—'
                    )}
                  </td>
                  <td className={`${cell} text-center font-bold ${line.flag ? 'text-red-600' : 'text-slate-400'}`}>
                    {line.flag || ''}
                  </td>
                  <td className={`${cell} text-slate-600`}>{line.unit}</td>
                  {index === 0 && (
                    <td className={`${cell} align-top ${pending ? 'text-amber-800' : 'text-slate-600'}`} rowSpan={lines.length}>
                      {workLabel(order)}
                    </td>
                  )}
                  {index === 0 && (
                    <td className={`${cell} align-top`} rowSpan={lines.length}>
                      {billLabel(order)}
                    </td>
                  )}
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-slate-500">H = high · L = low · empty result rows are still being checked.</p>
    </div>
  );
}
