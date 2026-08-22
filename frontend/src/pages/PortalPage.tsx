import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { loadCareState } from '../workflow/store';
import { authenticatePatient } from '../workflow/his';
import { CLINIC_LABELS, formatGhs } from '../workflow/catalog';
import { unpaidOrders } from '../workflow/billing';
import type { AppointmentRecord, NotificationRecord, PatientRecord, VisitRecord } from '../workflow/types';
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

  if (loading) {
    return <p className="p-8 text-sm text-slate-500">Opening portal…</p>;
  }

  if (!patient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-clinic-50 px-4">
        <form onSubmit={(e) => void signIn(e)} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-8">
          <h1 className="text-xl font-semibold text-clinic-900">Patient portal</h1>
          <p className="text-sm text-slate-600">Appointments, results, and amounts due.</p>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <input className={inputClass} placeholder="Folder number e.g. CH-00001" value={hospitalNo} onChange={(e) => setHospitalNo(e.target.value)} />
          <input className={inputClass} placeholder="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
          <button className={`${btnPrimary} w-full`} type="submit">
            Open my record
          </button>
          <Link className="block text-center text-sm text-clinic-700" to="/login">
            Staff sign-in
          </Link>
        </form>
      </div>
    );
  }

  const due = visits.flatMap((v) => unpaidOrders(v));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="text-sm text-slate-500">{patient.hospitalNo}</p>
          </div>
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
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-medium">Appointments</h2>
          <ul className="mt-2 text-sm">
            {appts.length === 0 && <li>No upcoming bookings.</li>}
            {appts.map((a) => (
              <li key={a.id}>
                {new Date(a.startsAt).toLocaleString()} · {CLINIC_LABELS[a.clinic]} · {a.status}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-medium">Results & visits</h2>
          <ul className="mt-2 text-sm">
            {visits.map((v) => (
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
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-medium">Amount due</h2>
          <p className="text-sm">{due.length ? formatGhs(due.reduce((s, o) => s + o.priceGhs, 0)) : 'Nothing outstanding.'}</p>
        </section>
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-medium">Messages</h2>
          <ul className="mt-2 text-sm">
            {notes.map((n) => (
              <li key={n.id}>
                {n.title}: {n.body}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
