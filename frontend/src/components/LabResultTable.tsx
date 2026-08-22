import type { LabAnalyteDef } from '../workflow/labPanels';
import type { LabLine } from '../workflow/types';

const tableClass = 'w-full border-collapse text-sm';
const cell = 'border border-slate-800 px-2 py-1.5';

export default function LabResultTable({
  lines,
  defs,
  values,
  onChange,
  editable = false,
  showLegend = true,
}: {
  lines: LabLine[];
  defs?: LabAnalyteDef[];
  values?: Record<string, string>;
  onChange?: (id: string, value: string) => void;
  editable?: boolean;
  showLegend?: boolean;
}) {
  const rows = lines.length > 0 ? lines : [];
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No lab lines on this report yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr className="bg-slate-50">
            <th className={`${cell} text-left font-semibold`}>Test</th>
            <th className={`${cell} text-right font-semibold`}>Result</th>
            <th className={`${cell} w-12 text-center font-semibold`}> </th>
            <th className={`${cell} text-left font-semibold`}>Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line) => {
            const def = defs?.find((item) => item.id === line.id);
            const value = editable ? (values?.[line.id] ?? line.value) : line.value;
            const flag = line.flag;
            return (
              <tr key={line.id}>
                <td className={cell}>{line.name}</td>
                <td className={`${cell} text-right`}>
                  {editable ? (
                    def?.type === 'choice' ? (
                      <select
                        value={value}
                        onChange={(event) => onChange?.(line.id, event.target.value)}
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
                        onChange={(event) => onChange?.(line.id, event.target.value)}
                        className="w-full bg-white text-right outline-none"
                        aria-label={line.name}
                      />
                    )
                  ) : (
                    value || '—'
                  )}
                </td>
                <td className={`${cell} text-center font-bold ${flag ? 'text-red-600' : 'text-slate-400'}`}>
                  {flag || ''}
                </td>
                <td className={`${cell} text-slate-600`}>{line.unit}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {showLegend && (
        <p className="mt-1 text-xs text-slate-500">H = high · L = low · red flag means the doctor should look at that row.</p>
      )}
    </div>
  );
}
