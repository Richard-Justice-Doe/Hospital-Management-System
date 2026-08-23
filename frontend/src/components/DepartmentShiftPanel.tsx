import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { DEPARTMENT_LABELS } from '../workflow/catalog';
import {
  SHIFT_PRESETS,
  cancelShift,
  formatShiftHours,
  scheduleShift,
  staffForDepartment,
} from '../workflow/his';
import { canControlDepartment, ROLE_LABELS, type Department } from '../workflow/types';
import { btnDanger, btnPrimary, Field, inputClass } from '../pages/admin/adminUi';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DepartmentShiftPanel({ department }: { department: Department }) {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const canSchedule = canControlDepartment(user, department);
  const [staffId, setStaffId] = useState('');
  const [day, setDay] = useState(todayIso());
  const [preset, setPreset] = useState(SHIFT_PRESETS[0].id);
  const [startHour, setStartHour] = useState(SHIFT_PRESETS[0].startHour);
  const [endHour, setEndHour] = useState(SHIFT_PRESETS[0].endHour);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [handover, setHandover] = useState('');

  const workers = staffForDepartment(state, department);
  const shifts = useMemo(
    () =>
      [...(state.shifts ?? [])]
        .filter((sh) => sh.department === department)
        .sort((a, b) => a.day.localeCompare(b.day) || a.startHour - b.startHour),
    [state.shifts, department],
  );

  function applyPreset(id: string) {
    setPreset(id);
    const found = SHIFT_PRESETS.find((p) => p.id === id);
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
    const result = scheduleShift(state, {
      staffId,
      department,
      day,
      startHour,
      endHour,
      note,
      createdBy: user.id,
    });
    if (result.error || !result.shift) {
      setError(result.error ?? 'Could not save that shift.');
      return;
    }
    updateCare(() => result.state);
    const worker = state.staff.find((s) => s.id === staffId);
    setMessage(`Shift saved. ${worker?.firstName} will get email (${worker?.email}) and SMS (${worker?.phone ?? 'no phone'}).`);
    setNote('');
  }

  return (
    <section className="mt-6 rounded-xl border bg-white p-5">
      <h2 className="font-medium text-slate-900">{DEPARTMENT_LABELS[department]} shift schedule</h2>
      <p className="mt-1 text-sm text-slate-600">
        {canSchedule
          ? 'Assign a worker, then save. They get email and SMS.'
          : 'Roster for this department.'}
      </p>

      {canSchedule && (
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleSchedule}>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2 xl:col-span-3">{error}</p>}
          {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 md:col-span-2 xl:col-span-3">{message}</p>}
          <Field label="Worker">
            <select required className={inputClass} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Select staff</option>
              {workers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} · {ROLE_LABELS[s.role]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input required type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Shift">
            <select className={inputClass} value={preset} onChange={(e) => applyPreset(e.target.value)}>
              {SHIFT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom hours</option>
            </select>
          </Field>
          {preset === 'custom' && (
            <>
              <Field label="Start hour">
                <input type="number" min={0} max={23} className={inputClass} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} />
              </Field>
              <Field label="End hour">
                <input type="number" min={0} max={23} className={inputClass} value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} />
              </Field>
            </>
          )}
          <Field label="Note">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note in the message" />
          </Field>
          <div className="flex items-end">
            <button type="submit" className={btnPrimary} disabled={!staffId || workers.length === 0}>
              Save shift and notify
            </button>
          </div>
          {workers.length === 0 && (
            <p className="text-sm text-slate-500 md:col-span-2">No active workers in this department yet. Add them under Admin → Staff.</p>
          )}
        </form>
      )}

      {shifts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No shifts on this roster yet.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border">
          {shifts.map((sh) => {
            const worker = state.staff.find((s) => s.id === sh.staffId);
            return (
              <li key={sh.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">
                    {worker?.firstName} {worker?.lastName}
                  </span>
                  <span className="text-slate-600">
                    {' '}
                    · {sh.day} {formatShiftHours(sh.startHour, sh.endHour)}
                  </span>
                  {sh.note ? <span className="block text-xs text-slate-500">{sh.note}</span> : null}
                  <span className="block text-xs text-slate-500">
                    {sh.emailSent ? 'Email sent' : canSchedule ? 'Email pending' : ''}
                    {canSchedule ? ' · ' : ''}
                    {sh.smsSent ? 'SMS sent' : canSchedule ? 'SMS pending' : ''}
                  </span>
                </span>
                {canSchedule && (
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => {
                      if (!user) return;
                      if (!window.confirm('Cancel this shift and notify the worker?')) return;
                      updateCare((s) => cancelShift(s, sh.id, user.id));
                    }}
                  >
                    Cancel
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
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
        <textarea value={handover} onChange={(e) => setHandover(e.target.value)} className={`${inputClass} mt-2`} placeholder="What the next worker must finish" />
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
    </section>
  );
}
