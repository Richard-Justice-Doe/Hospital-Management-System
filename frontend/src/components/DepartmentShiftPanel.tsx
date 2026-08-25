import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { DEPARTMENT_LABELS } from '../workflow/catalog';
import { monthIso, shiftsInMonth } from '../workflow/his';
import { type Department } from '../workflow/types';
import { btnPrimary, inputClass } from '../pages/admin/adminUi';
import MonthShiftDesk from './MonthShiftDesk';

export default function DepartmentShiftPanel({ department }: { department: Department }) {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const [open, setOpen] = useState(false);
  const [handover, setHandover] = useState('');
  const monthCount = shiftsInMonth(state.shifts, monthIso(), department).length;

  return (
    <section className="mt-4 rounded-xl border bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-slate-800">{DEPARTMENT_LABELS[department]} monthly roster</span>
        <span className="text-xs text-slate-500">
          {monthCount} shift{monthCount === 1 ? '' : 's'} this month · {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3">
          <MonthShiftDesk department={department} />
          <div className="mt-5 rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold">Shift hand-over</p>
            {(state.handovers ?? [])
              .filter((item) => item.department === department)
              .slice(0, 1)
              .map((item) => (
                <p key={item.id} className="mt-1 text-sm text-slate-600">
                  Last note: {item.note}
                </p>
              ))}
            <textarea
              value={handover}
              onChange={(e) => setHandover(e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="What the next worker must finish"
            />
            <button
              type="button"
              className={`${btnPrimary} mt-2`}
              onClick={() => {
                if (!handover.trim() || !user) return;
                updateCare((current) => ({
                  ...current,
                  handovers: [
                    { id: `ho-${Date.now()}`, department, note: handover.trim(), staffId: user.id, at: new Date().toISOString() },
                    ...(current.handovers ?? []),
                  ],
                }));
                setHandover('');
              }}
            >
              Save hand-over
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
