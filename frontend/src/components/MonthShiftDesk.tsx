import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { btnDanger, btnPrimary, btnSecondary, Field, inputClass } from '../pages/admin/adminUi';
import {
  SHIFT_PRESETS,
  cancelMonthShiftBlock,
  daysInMonthIso,
  formatMonthLabel,
  formatShiftHours,
  groupMonthShiftBlocks,
  monthIso,
  scheduleMonthShifts,
  shiftMonth,
  shiftsInMonth,
  staffForDepartment,
} from '../workflow/his';
import { canControlDepartment, ROLE_LABELS, type Department } from '../workflow/types';

export default function MonthShiftDesk({ department }: { department: Department }) {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const canSchedule = canControlDepartment(user, department);
  const [month, setMonth] = useState(monthIso());
  const [staffId, setStaffId] = useState('');
  const [preset, setPreset] = useState(SHIFT_PRESETS[0].id);
  const [startHour, setStartHour] = useState(SHIFT_PRESETS[0].startHour);
  const [endHour, setEndHour] = useState(SHIFT_PRESETS[0].endHour);
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const workers = staffForDepartment(state, department);
  const monthShifts = useMemo(
    () =>
      [...shiftsInMonth(state.shifts, month, department)].sort(
        (a, b) => a.day.localeCompare(b.day) || a.startHour - b.startHour,
      ),
    [state.shifts, month, department],
  );
  const blocks = useMemo(() => groupMonthShiftBlocks(monthShifts), [monthShifts]);
  const monthDays = daysInMonthIso(month, weekdaysOnly).length;

  function applyPreset(id: string) {
    setPreset(id);
    const found = SHIFT_PRESETS.find((row) => row.id === id);
    if (found) {
      setStartHour(found.startHour);
      setEndHour(found.endHour);
    }
  }

  function handleSchedule(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!user) return;
    const result = scheduleMonthShifts(state, {
      staffId,
      department,
      month,
      startHour,
      endHour,
      note,
      createdBy: user.id,
      weekdaysOnly,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    updateCare(() => result.state);
    const worker = state.staff.find((person) => person.id === staffId);
    const skipped = result.skipped ? ` ${result.skipped} day${result.skipped === 1 ? '' : 's'} already had a clash.` : '';
    setMessage(
      `${result.added} day${result.added === 1 ? '' : 's'} saved for ${worker?.firstName ?? 'the worker'} in ${formatMonthLabel(month)}.${skipped} Email and SMS are sent once for the month.`,
    );
    setNote('');
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {canSchedule
            ? `Roster the whole of ${formatMonthLabel(month)} in one save. The worker is notified once.`
            : `Roster for ${formatMonthLabel(month)}.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnSecondary} onClick={() => setMonth((current) => shiftMonth(current, -1))}>
            Previous
          </button>
          <input type="month" className={`${inputClass} w-40`} value={month} onChange={(e) => setMonth(e.target.value)} />
          <button type="button" className={btnSecondary} onClick={() => setMonth((current) => shiftMonth(current, 1))}>
            Next
          </button>
        </div>
      </div>

      {canSchedule && (
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleSchedule}>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2 xl:col-span-3">{error}</p>}
          {message && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 md:col-span-2 xl:col-span-3">{message}</p>
          )}
          <Field label="Worker">
            <select required className={inputClass} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Select staff</option>
              {workers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName} · {ROLE_LABELS[person.role]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shift">
            <select className={inputClass} value={preset} onChange={(e) => applyPreset(e.target.value)}>
              {SHIFT_PRESETS.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
              <option value="custom">Custom hours</option>
            </select>
          </Field>
          <Field label="Days this month">
            <select
              className={inputClass}
              value={weekdaysOnly ? 'weekdays' : 'all'}
              onChange={(e) => setWeekdaysOnly(e.target.value === 'weekdays')}
            >
              <option value="all">Every day ({daysInMonthIso(month).length} days)</option>
              <option value="weekdays">Weekdays only ({daysInMonthIso(month, true).length} days)</option>
            </select>
          </Field>
          {preset === 'custom' && (
            <>
              <Field label="Start hour">
                <input
                  type="number"
                  min={0}
                  max={23}
                  className={inputClass}
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                />
              </Field>
              <Field label="End hour">
                <input
                  type="number"
                  min={0}
                  max={23}
                  className={inputClass}
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                />
              </Field>
            </>
          )}
          <Field label="Note" hint="Included once in the month email and SMS.">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
          </Field>
          <div className="flex items-end">
            <button type="submit" className={btnPrimary} disabled={!staffId || workers.length === 0}>
              Save {monthDays}-day roster and notify
            </button>
          </div>
          {workers.length === 0 && (
            <p className="text-sm text-slate-500 md:col-span-2">No active workers in this department yet. Add them under Admin → Staff.</p>
          )}
        </form>
      )}

      {blocks.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No shifts on this month’s roster yet.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border">
          {blocks.map((block) => {
            const worker = state.staff.find((person) => person.id === block.staffId);
            return (
              <li key={block.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">
                    {worker?.firstName} {worker?.lastName}
                  </span>
                  <span className="text-slate-600">
                    {' '}
                    · {formatShiftHours(block.startHour, block.endHour)} · {block.days.length} day
                    {block.days.length === 1 ? '' : 's'} in {formatMonthLabel(month)}
                  </span>
                  {block.note ? <span className="block text-xs text-slate-500">{block.note}</span> : null}
                  <span className="block text-xs text-slate-500">
                    {block.days[0]}
                    {block.days.length > 1 ? ` – ${block.days[block.days.length - 1]}` : ''}
                  </span>
                </span>
                {canSchedule && user && (
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => {
                      if (!window.confirm(`Cancel this ${formatMonthLabel(month)} roster and notify the worker?`)) return;
                      updateCare((current) =>
                        cancelMonthShiftBlock(current, {
                          staffId: block.staffId,
                          department,
                          month,
                          startHour: block.startHour,
                          endHour: block.endHour,
                          cancelledBy: user.id,
                        }),
                      );
                    }}
                  >
                    Cancel month
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
