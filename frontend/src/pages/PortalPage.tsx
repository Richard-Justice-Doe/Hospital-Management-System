import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { loadCareState } from '../workflow/store';
import { authenticatePatient } from '../workflow/his';
import { CLINIC_LABELS, formatGhs } from '../workflow/catalog';
import { unpaidOrders } from '../workflow/billing';
import type { AppointmentRecord, NotificationRecord, PatientRecord, VisitRecord } from '../workflow/types';
import {
  PORTAL_FILTERS,
  appointmentMatchesPortalFilter,
  messageMatchesPortalFilter,
  showPortalSection,
  visitMatchesPortalFilter,
  type PortalFilter,
} from '../workflow/portalFilters';
import PageDateBox from '../components/PageDateBox';
import HospitalMark from '../components/HospitalMark';
import { btnPrimary, inputClass } from './admin/adminUi';
import { portalLoginRequest, portalLogoutRequest, portalMeRequest, USE_SERVER } from '../lib/server';
import { AuthError } from '../lib/api';

export default function PortalPage() {
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [appts, setAppts] = useState<AppointmentRecord[]>([]);
  const [notes, setNotes] = useState<NotificationRecord[]>([]);
  const [hospitalNo, setHospitalNo] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(USE_SERVER);
  const [filter, setFilter] = useState<PortalFilter>('ALL');

  useEffect(() => {
    if (!USE_SERVER) return;
    void portalMeRequest()
      .then((res) => {
        setPatient(res.patient);
        setVisits(res.state.visits);
        setAppts(res.state.appointments);
        setNotes(res.state.notifications);
      })
      .catch(() => setPatient(null))
      .finally(() => setLoading(false));
  }, []);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (USE_SERVER) {
      try {
        const res = await portalLoginRequest(hospitalNo, pin);
        setPatient(res.patient);
        setVisits(res.state.visits);
        setAppts(res.state.appointments);
        setNotes(res.state.notifications);
      } catch (err) {
        setError(err instanceof AuthError ? err.message : 'Invalid folder number or PIN.');
      }
      return;
    }
    const found = authenticatePatient(loadCareState(), hospitalNo, pin);
    if (!found) {
      setError('Invalid folder number or PIN.');
      return;
    }
    const state = loadCareState();
    setPatient(found);
    setVisits(state.visits.filter((v) => v.patientId === found.id));
    setAppts(state.appointments.filter((a) => a.patientId === found.id));
    setNotes(state.notifications.filter((n) => n.patientId === found.id));
  }

  const due = visits.flatMap((v) => unpaidOrders(v));
  const visibleVisits = useMemo(() => visits.filter((visit) => visitMatchesPortalFilter(visit, filter)), [visits, filter]);
  const visibleAppts = useMemo(
    () => appts.filter((appointment) => appointmentMatchesPortalFilter(appointment, filter)),
    [appts, filter],
  );
  const visibleNotes = useMemo(() => notes.filter((note) => messageMatchesPortalFilter(note, filter)), [notes, filter]);

  if (loading) {
    return <p className="p-8 text-sm text-slate-500">Opening portal…</p>;
  }

  if (!patient) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-100">
        <header className="bg-clinic-900 px-4 py-4 text-white">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <HospitalMark size="sm" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clinic-100">Municipal hospital</p>
              <p className="text-sm font-semibold">Patient portal</p>
            </div>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={(e) => void signIn(e)} className="w-full max-w-md space-y-3 desk-panel p-8">
          <div className="flex justify-end">
            <PageDateBox />
          </div>
          <h1 className="desk-title">Open your record</h1>
          <p className="text-sm text-slate-600">Appointments, results, and amounts due.</p>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <input className={inputClass} placeholder="Folder number e.g. A1/2026" value={hospitalNo} onChange={(e) => setHospitalNo(e.target.value)} />
          <input className={inputClass} placeholder="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
          <button className={`${btnPrimary} w-full`} type="submit">
            Open my record
          </button>
          <Link className="block text-center text-sm font-semibold text-clinic-700 hover:underline" to="/login">
            Staff sign-in
          </Link>
        </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start justify-between desk-panel p-5">
          <div>
            <h1 className="desk-title">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="text-sm text-slate-500">{patient.hospitalNo}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PageDateBox />
          <button
            type="button"
            className="text-sm text-slate-600"
            onClick={() => {
              void portalLogoutRequest().catch(() => undefined);
              setPatient(null);
            }}
          >
            Sign out
          </button>
          </div>
        </div>
        <section className="desk-panel p-5">
          <h2 className="font-medium">Filter by role</h2>
          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Portal role filters">
            {PORTAL_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  filter === item.id ? 'bg-clinic-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
        {showPortalSection('appointments', filter) && (
        <section className="desk-panel p-5">
          <h2 className="font-medium">Appointments</h2>
          <ul className="mt-2 text-sm">
            {visibleAppts.length === 0 && <li>No upcoming bookings.</li>}
            {visibleAppts.map((a) => (
              <li key={a.id}>
                {new Date(a.startsAt).toLocaleString()} · {CLINIC_LABELS[a.clinic]} · {a.status}
              </li>
            ))}
          </ul>
        </section>
        )}
        {showPortalSection('visits', filter) && (
        <section className="desk-panel p-5">
          <h2 className="font-medium">Results & visits</h2>
          <ul className="mt-2 text-sm">
            {visibleVisits.length === 0 && <li className="text-slate-500">No visits for this role.</li>}
            {visibleVisits.map((v) => (
              <li key={v.id} className="border-t py-2">
                {new Date(v.checkedInAt).toLocaleDateString()} · {v.diagnosis ?? v.reason}
                {v.orders
                  .filter((o) => o.result)
                  .map((o) => (
                    <p key={o.id} className="text-slate-600">
                      {o.name}: {o.result}
                    </p>
                  ))}
              </li>
            ))}
          </ul>
        </section>
        )}
        {showPortalSection('billing', filter) && (
        <section className="desk-panel p-5">
          <h2 className="font-medium">Amount due</h2>
          <p className="text-sm">{due.length ? formatGhs(due.reduce((s, o) => s + o.priceGhs, 0)) : 'Nothing outstanding.'}</p>
        </section>
        )}
        {showPortalSection('messages', filter) && (
        <section className="desk-panel p-5">
          <h2 className="font-medium">Messages</h2>
          <ul className="mt-2 text-sm">
            {visibleNotes.map((n) => (
              <li key={n.id}>
                {n.title}: {n.body}
              </li>
            ))}
            {visibleNotes.length === 0 && <li className="text-slate-500">No messages.</li>}
          </ul>
        </section>
        )}
      </div>
    </div>
  );
}
