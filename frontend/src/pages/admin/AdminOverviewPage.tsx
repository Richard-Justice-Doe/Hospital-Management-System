import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCare } from '../../context/CareContext';
import { CLINIC_LABELS, CLINICS } from '../../workflow/catalog';
import { occupancy } from '../../workflow/his';
import { ROLE_LABELS, type ClinicId, type StaffRole } from '../../workflow/types';

const DOCTOR_ROLES: StaffRole[] = ['DOCTOR', 'EYE_DOCTOR', 'ENT_DOCTOR', 'DENTIST'];
const IN_BLUE = '#0369a1';
const OUT_BLUE = '#7dd3fc';

export default function AdminOverviewPage() {
  const { state } = useCare();
  const [range, setRange] = useState<'month' | 'all'>('all');

  const stats = useMemo(() => {
    const from = range === 'month' ? Date.now() - 30 * 24 * 3600_000 : 0;
    const inRange = (iso?: string) => !iso || new Date(iso).getTime() >= from;
    const appointments = state.appointments.filter((a) => inRange(a.startsAt));
    const pending = appointments.filter((a) => a.status === 'BOOKED' || a.status === 'CONFIRMED').length;
    const fresh = appointments.filter((a) => a.status === 'CHECKED_IN' || a.status === 'BOOKED').length;
    const inpatients = new Set(state.beds.filter((b) => b.status === 'OCCUPIED' && b.patientId).map((b) => b.patientId)).size;
    const patients = state.patients.filter((p) => !p.mergedIntoId);
    const doctors = state.staff.filter((s) => s.isActive && DOCTOR_ROLES.includes(s.role)).length;
    const others = state.staff.filter((s) => s.isActive && !DOCTOR_ROLES.includes(s.role)).length;
    const occ = occupancy(state);
    const ward = occ.find((o) => o.ward === 'WARD');
    const ed = occ.find((o) => o.ward === 'ED');
    const clinicBars = CLINICS.map((clinic) => {
      const visits = state.visits.filter((v) => (v.clinic ?? 'GENERAL') === clinic.id && inRange(v.checkedInAt));
      return {
        id: clinic.id,
        label: clinic.label.replace(' / follow-up', '').replace(' / ANC', ''),
        inpatients: visits.filter((v) => v.disposition === 'ADMITTED' || Boolean(v.bedId)).length,
        outpatients: visits.filter((v) => v.disposition !== 'ADMITTED' && !v.bedId).length,
      };
    });
    return {
      appointments: { total: appointments.length, pending, fresh },
      patients: { total: patients.length, inpatients, outpatients: Math.max(0, patients.length - inpatients) },
      staff: { total: doctors + others, doctors, others },
      wards: {
        total: (ward?.total ?? 0) + (ed?.total ?? 0),
        icu: ed?.total ?? 0,
        general: ward?.total ?? 0,
      },
      clinicBars,
    };
  }, [state, range]);

  const records = useMemo(() => {
    return state.patients
      .filter((p) => !p.mergedIntoId)
      .slice(0, 6)
      .map((patient) => {
        const visit = state.visits.find((v) => v.patientId === patient.id);
        const urgent = (visit?.esiScore && visit.esiScore <= 2) || (visit?.vitals?.abnormalFlags.length ?? 0) > 0;
        return {
          patient,
          clinic: CLINIC_LABELS[(visit?.clinic ?? 'GENERAL') as ClinicId],
          status: urgent ? 'Urgent' : visit ? 'Active' : 'Registered',
          urgent,
        };
      });
  }, [state.patients, state.visits]);

  const schedule = useMemo(() => {
    return [...state.appointments]
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 8);
  }, [state.appointments]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Appointments"
          value={stats.appointments.total}
          detail={`New ${stats.appointments.fresh} | Pending ${stats.appointments.pending}`}
          icon="cal"
        />
        <MetricCard
          title="Patients"
          value={stats.patients.total}
          detail={`Inpatients ${stats.patients.inpatients} | Outpatients ${stats.patients.outpatients}`}
          icon="people"
        />
        <MetricCard
          title="Staffs"
          value={stats.staff.total}
          detail={`Doctors ${stats.staff.doctors} | Other staffs ${stats.staff.others}`}
          icon="badge"
        />
        <MetricCard
          title="Wards"
          value={stats.wards.total}
          detail={`ICU / ED ${stats.wards.icu} | General wards ${stats.wards.general}`}
          icon="bed"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Patients by clinic</h2>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
              value={range}
              onChange={(e) => setRange(e.target.value as 'month' | 'all')}
              aria-label="Chart range"
            >
              <option value="month">Last month</option>
              <option value="all">All time</option>
            </select>
          </div>
          <GroupedClinicChart rows={stats.clinicBars} />
          <ul className="mt-4 flex gap-5 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: IN_BLUE }} />
              Inpatients
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: OUT_BLUE }} />
              Outpatients
            </li>
          </ul>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Patient records</h2>
            <Link to="/care/admin/patients" className="text-sm font-semibold text-clinic-700 hover:underline">
              See all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Patient ID</th>
                  <th className="px-4 py-2.5 font-medium">Specialization</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row, index) => (
                  <tr key={row.patient.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <Avatar name={`${row.patient.firstName} ${row.patient.lastName}`} />
                        {row.patient.firstName} {row.patient.lastName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{row.patient.hospitalNo.replace(/\D/g, '') || row.patient.hospitalNo}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.clinic}</td>
                    <td className={`px-4 py-2.5 font-medium ${row.urgent ? 'text-red-600' : 'text-slate-700'}`}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Appointment schedule</h2>
          <Link
            to="/care/appointments"
            className="rounded-lg bg-clinic-600 px-4 py-2 text-sm font-semibold text-white hover:bg-clinic-700"
          >
            Create new +
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-2.5 font-medium">Doctor name</th>
                <th className="px-4 py-2.5 font-medium">Specialization</th>
                <th className="px-4 py-2.5 font-medium">Patient name</th>
                <th className="px-4 py-2.5 font-medium">Appointment date & time</th>
                <th className="px-4 py-2.5 font-medium">Appointment status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No bookings yet. Create one from Appointments.
                  </td>
                </tr>
              )}
              {schedule.map((apt, index) => {
                const doctor = state.staff.find((s) => s.id === apt.providerId);
                const patient = state.patients.find((p) => p.id === apt.patientId);
                const doctorName = doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Unassigned';
                return (
                  <tr key={apt.id} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <Avatar name={doctorName} />
                        {doctor?.role === 'DOCTOR' || doctor?.role?.includes('DOCTOR') ? `Dr. ${doctorName}` : doctorName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{doctor ? ROLE_LABELS[doctor.role] : CLINIC_LABELS[apt.clinic]}</td>
                    <td className="px-4 py-3">{patient ? `${patient.firstName} ${patient.lastName}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(apt.startsAt).toLocaleString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700">{apt.status.toLowerCase().replace('_', ' ')}</td>
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

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: number;
  detail: string;
  icon: 'cal' | 'people' | 'badge' | 'bed';
}) {
  return (
    <article className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-clinic-50 text-clinic-700">
        <MetricIcon name={icon} />
      </span>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value.toLocaleString()}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </article>
  );
}

function MetricIcon({ name }: { name: 'cal' | 'people' | 'badge' | 'bed' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'cal') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    );
  }
  if (name === 'people') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M21 19c0-2.2-1.8-4-4.2-4" />
      </svg>
    );
  }
  if (name === 'badge') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M6 20v-1c0-2.8 2.7-5 6-5s6 2.2 6 5v1" />
        <path d="M12 13v3" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...common}>
      <path d="M4 10h16v10H4zM7 10V7a5 5 0 0 1 10 0v3" />
    </svg>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clinic-100 text-[11px] font-semibold text-clinic-800">
      {initials || '?'}
    </span>
  );
}

function GroupedClinicChart({
  rows,
}: {
  rows: Array<{ id: string; label: string; inpatients: number; outpatients: number }>;
}) {
  const width = 720;
  const height = 260;
  const pad = { top: 12, right: 12, bottom: 52, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.inpatients, r.outpatients)));
  const group = innerW / Math.max(rows.length, 1);
  const barW = Math.min(16, group / 3);

  return (
    <svg role="img" aria-label="Patients by clinic, inpatients versus outpatients" viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
      <title>Patients by clinic</title>
      {[0, 0.5, 1].map((tick) => {
        const y = pad.top + innerH - tick * innerH;
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e2e8f0" />
            <text x={4} y={y + 4} className="fill-slate-400" fontSize="10">
              {Math.round(max * tick)}
            </text>
          </g>
        );
      })}
      {rows.map((row, index) => {
        const x = pad.left + index * group + group / 2;
        const inH = (row.inpatients / max) * innerH;
        const outH = (row.outpatients / max) * innerH;
        return (
          <g key={row.id}>
            <rect x={x - barW - 2} y={pad.top + innerH - inH} width={barW} height={inH} rx="3" fill={IN_BLUE} />
            <rect x={x + 2} y={pad.top + innerH - outH} width={barW} height={outH} rx="3" fill={OUT_BLUE} />
            <text
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="10"
              transform={`rotate(-28 ${x} ${height - 18})`}
            >
              {row.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
