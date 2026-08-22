import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { listOutboundRequest, USE_SERVER } from '../lib/server';
import { DEPARTMENT_LABELS } from '../workflow/catalog';
import {
  SHIFT_PRESETS,
  cancelShift,
  formatShiftHours,
  scheduleShift,
  staffForDepartment,
} from '../workflow/his';
import { canControlDepartment, ROLE_LABELS, type Department } from '../workflow/types';
import { btnDanger, btnPrimary, btnSecondary, Field, inputClass } from './admin/adminUi';

const DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as Department[];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ShiftsPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const canSchedule = Boolean(user && (user.role === 'ADMIN' || user.inChargeOf));
  const lockedDept = user?.role === 'ADMIN' ? undefined : user?.inChargeOf;
  const homeDept = lockedDept ?? (user?.department && DEPARTMENTS.includes(user.department) ? user.department : 'NURSING');
  const [department, setDepartment] = useState<Department>(homeDept);
  const [staffId, setStaffId] = useState('');
  const [day, setDay] = useState(todayIso());
  const [preset, setPreset] = useState(SHIFT_PRESETS[0].id);
  const [startHour, setStartHour] = useState(7);
  const [endHour, setEndHour] = useState(15);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [outbound, setOutbound] = useState<Array<{ id: string; channel: string; to_addr: string; subject?: string; body: string; status: string; created_at: string }>>([]);
  const workers = staffForDepartment(state, department);

  useEffect(() => {
    if (lockedDept && department !== lockedDept) setDepartment(lockedDept);
  }, [lockedDept, department]);

  const departmentShifts = useMemo(
    () =>
      [...(state.shifts ?? [])]
        .filter((sh) => sh.department === department)
        .sort((a, b) => a.day.localeCompare(b.day) || a.startHour - b.startHour),
    [state.shifts, department],
  );
  const myShifts = useMemo(
    () =>
      [...(state.shifts ?? [])]
        .filter((sh) => sh.staffId === user?.id)
        .sort((a, b) => a.day.localeCompare(b.day) || a.startHour - b.startHour),
    [state.shifts, user?.id],
  );

  function applyPreset(id: string) {
    setPreset(id);
    const found = SHIFT_PRESETS.find((p) => p.id === id);
    if (found) {
      setStartHour(found.startHour);
      setEndHour(found.endHour);
    }
  }

  function refreshOutbound() {
    if (!USE_SERVER) return;
    void listOutboundRequest()
      .then((res) => setOutbound(res.messages))
      .catch(() => undefined);
  }

  useEffect(() => {
    refreshOutbound();
  }, []);

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
    setMessage(
      `Shift saved for ${worker?.firstName} ${worker?.lastName}. Email and SMS are sent to ${worker?.email} and ${worker?.phone ?? 'their phone'}.`,
    );
    setNote('');
    window.setTimeout(refreshOutbound, 800);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">Shift schedule</h1>
      <p className="mt-1 text-sm text-slate-600">
        {canSchedule
          ? 'In-charge can roster workers by department. Each new shift emails and SMSs the worker.'
          : 'Your assigned shifts. Ask your department in-charge to change the roster.'}
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {canSchedule && (
          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-medium text-slate-900">Schedule a department shift</h2>
            <form className="mt-4 space-y-3" onSubmit={handleSchedule}>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
              <Field label="Department">
                <select
                  className={inputClass}
                  value={department}
                  disabled={Boolean(lockedDept)}
                  onChange={(e) => {
                    setDepartment(e.target.value as Department);
                    setStaffId('');
                  }}
                >
                  {(lockedDept ? [lockedDept] : DEPARTMENTS).map((dept) => (
                    <option key={dept} value={dept}>
                      {DEPARTMENT_LABELS[dept]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Worker">
                <select required className={inputClass} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">Select staff</option>
                  {workers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} · {ROLE_LABELS[s.role]} · {s.phone ?? 'no phone'}
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
                <div className="grid grid-cols-2 gap-3">
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
                </div>
              )}
              <Field label="Note to worker" hint="Included in the email and SMS.">
                <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cover OPD, report to records" />
              </Field>
              <button type="submit" className={btnPrimary} disabled={!staffId}>
                Save shift and notify
              </button>
            </form>
          </section>
        )}

        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-medium text-slate-900">{DEPARTMENT_LABELS[department]} roster</h2>
          {departmentShifts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No shifts on this department yet.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {departmentShifts.map((sh) => {
                const worker = state.staff.find((s) => s.id === sh.staffId);
                return (
                  <li key={sh.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-medium text-slate-900">
                        {worker?.firstName} {worker?.lastName}
                      </span>
                      <span className="text-slate-600">
                        {' '}
                        · {sh.day} {formatShiftHours(sh.startHour, sh.endHour)}
                      </span>
                      {sh.note ? <span className="block text-xs text-slate-500">{sh.note}</span> : null}
                      <span className="block text-xs text-slate-500">
                        {sh.emailSent ? 'Email sent' : 'Email pending'} · {sh.smsSent ? 'SMS sent' : 'SMS pending'}
                        {worker?.email ? ` · ${worker.email}` : ''}
                        {worker?.phone ? ` · ${worker.phone}` : ''}
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
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="font-medium text-slate-900">My shifts</h2>
        {myShifts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">You have no shifts on the roster.</p>
        ) : (
          <ul className="mt-3 text-sm">
            {myShifts.map((sh) => (
              <li key={sh.id} className="border-t py-2">
                {sh.day} · {DEPARTMENT_LABELS[sh.department]} · {formatShiftHours(sh.startHour, sh.endHour)}
                {sh.note ? ` · ${sh.note}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canSchedule && USE_SERVER && (
        <section className="mt-6 rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium text-slate-900">Mail and SMS log</h2>
            <button type="button" className={btnSecondary} onClick={refreshOutbound}>
              Refresh
            </button>
          </div>
          {outbound.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No outbound messages yet. Schedule a shift, then refresh.</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {outbound.slice(0, 12).map((row) => (
                <li key={row.id} className="py-2">
                  <span className="font-medium uppercase text-slate-700">{row.channel}</span>
                  <span className="text-slate-500"> · {row.status} · {row.to_addr}</span>
                  {row.subject ? <span className="block text-xs text-slate-500">{row.subject}</span> : null}
                  <span className="block text-xs text-slate-600">{row.body}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
