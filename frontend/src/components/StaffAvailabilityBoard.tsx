import { useEffect, useMemo, useState } from 'react';
import { availabilitySummary, buildStaffAvailability, onDutyRows, type DutyStatus } from '../workflow/staffAvailability';
import type { CareState, Department } from '../workflow/types';

const STATUS_CLASS: Record<Extract<DutyStatus, 'at_desk' | 'on_duty'>, string> = {
  at_desk: 'bg-emerald-100 text-emerald-800',
  on_duty: 'bg-clinic-100 text-clinic-700',
};

function timeLabel(iso?: string): string {
  if (!iso) return 'No recent activity';
  return `Last seen ${new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function StaffAvailabilityBoard({
  state,
  department,
}: {
  state: CareState;
  department?: Department;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    const all = onDutyRows(buildStaffAvailability(state, now));
    return department ? all.filter((row) => row.departmentId === department) : all;
  }, [state, now, department]);
  const summary = availabilitySummary(rows);

  return (
    <section className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-900">On duty now</h2>
          <p className="text-sm text-slate-500">
            {department ? 'This department' : 'Hospital'} · {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-clinic-50 px-2.5 py-1 text-clinic-700">{summary.onDuty} on duty</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{summary.atDesk} at desk</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No workers are on duty right now.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Staff</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Shift</th>
                <th className="px-3 py-2 font-medium">Activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.staffId} className="border-t">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                  <td className="px-3 py-2 text-slate-600">{row.role}</td>
                  <td className="px-3 py-2 text-slate-600">{row.department}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}>
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.hours ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{timeLabel(row.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
