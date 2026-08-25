import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { listOutboundRequest, USE_SERVER } from '../lib/server';
import { DEPARTMENT_LABELS } from '../workflow/catalog';
import { formatMonthLabel, formatShiftHours, groupMonthShiftBlocks, monthIso, shiftsInMonth } from '../workflow/his';
import { type Department } from '../workflow/types';
import { btnSecondary, Field, inputClass } from './admin/adminUi';
import MonthShiftDesk from '../components/MonthShiftDesk';
import { DeskPage, PageHeader } from '../components/PageChrome';

const DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as Department[];

export default function ShiftsPage() {
  const { user } = useAuth();
  const { state } = useCare();
  const canSchedule = Boolean(user && (user.role === 'ADMIN' || user.inChargeOf || user.role === 'MATRON'));
  const lockedDept = user?.role === 'ADMIN' || user?.role === 'MATRON' ? undefined : user?.inChargeOf;
  const homeDept = lockedDept ?? (user?.department && DEPARTMENTS.includes(user.department) ? user.department : 'NURSING');
  const [department, setDepartment] = useState<Department>(homeDept);
  const [outbound, setOutbound] = useState<Array<{ id: string; channel: string; to_addr: string; subject?: string; body: string; status: string; created_at: string }>>([]);

  useEffect(() => {
    if (lockedDept && department !== lockedDept) setDepartment(lockedDept);
  }, [lockedDept, department]);

  const myBlocks = useMemo(() => {
    const mine = shiftsInMonth(state.shifts, monthIso()).filter((shift) => shift.staffId === user?.id);
    return groupMonthShiftBlocks(mine);
  }, [state.shifts, user?.id]);

  function refreshOutbound() {
    if (!USE_SERVER) return;
    void listOutboundRequest()
      .then((res) => setOutbound(res.messages))
      .catch(() => undefined);
  }

  useEffect(() => {
    refreshOutbound();
  }, []);

  return (
    <DeskPage>
      <PageHeader
        title="Shift schedule"
        hint={
          canSchedule
            ? 'In-charge rosters a worker for a full month. One email and SMS covers the month.'
            : 'Your assigned shifts this month. Ask your department in-charge to change the roster.'
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="desk-panel p-5">
          <h2 className="font-medium text-slate-900">
            {canSchedule ? 'Schedule a monthly roster' : DEPARTMENT_LABELS[department]}
          </h2>
          {canSchedule && (
            <div className="mt-4 max-w-sm">
              <Field label="Department">
                <select
                  className={inputClass}
                  value={department}
                  disabled={Boolean(lockedDept)}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                >
                  {(lockedDept ? [lockedDept] : DEPARTMENTS).map((dept) => (
                    <option key={dept} value={dept}>
                      {DEPARTMENT_LABELS[dept]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <div className="mt-4">
            <MonthShiftDesk department={department} />
          </div>
        </section>

        <section className="desk-panel p-5">
          <h2 className="font-medium text-slate-900">My shifts · {formatMonthLabel(monthIso())}</h2>
          {myBlocks.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">You have no shifts on this month’s roster.</p>
          ) : (
            <ul className="mt-3 text-sm">
              {myBlocks.map((block) => (
                <li key={block.key} className="border-t py-2">
                  {DEPARTMENT_LABELS[block.department]} · {formatShiftHours(block.startHour, block.endHour)} · {block.days.length}{' '}
                  day{block.days.length === 1 ? '' : 's'}
                  {block.note ? ` · ${block.note}` : ''}
                  <span className="block text-xs text-slate-500">
                    {block.days[0]}
                    {block.days.length > 1 ? ` – ${block.days[block.days.length - 1]}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {canSchedule && USE_SERVER && (
        <section className="mt-6 desk-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium text-slate-900">Mail and SMS log</h2>
            <button type="button" className={btnSecondary} onClick={refreshOutbound}>
              Refresh
            </button>
          </div>
          {outbound.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No outbound messages yet. Save a monthly roster, then refresh.</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {outbound.slice(0, 12).map((row) => (
                <li key={row.id} className="py-2">
                  <span className="font-medium uppercase text-slate-700">{row.channel}</span>
                  <span className="text-slate-500">
                    {' '}
                    · {row.status} · {row.to_addr}
                  </span>
                  {row.subject ? <span className="block text-xs text-slate-500">{row.subject}</span> : null}
                  <span className="block text-xs text-slate-600">{row.body}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </DeskPage>
  );
}
