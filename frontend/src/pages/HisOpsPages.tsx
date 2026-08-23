import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import PatientIdentity from '../components/PatientIdentity';
import VisitChargeSummary from '../components/VisitChargeSummary';
import { CLINIC_LABELS, formatGhs } from '../workflow/catalog';
import { isLowStock, isOutOfStock } from '../workflow/pharmacyStock';
import RecordSavedModal from '../components/RecordSavedModal';
import type { PromptKind } from '../components/ActionPrompt';
import {
  addIo,
  addWaitlist,
  admitVisit,
  bookAppointment,
  dischargeVisit,
  dispenseStock,
  downloadText,
  findDuplicatePatients,
  markMar,
  mergePatients,
  occupancy,
  qualityMetrics,
  recordTriage,
  sendDueReminders,
  sendMessage,
  setAppointmentStatus,
  transferBed,
  updateOt,
} from '../workflow/his';
import type { AppointmentStatus, ClinicId, StaffRole } from '../workflow/types';
import { canControlDepartment } from '../workflow/types';
import { btnPrimary, btnSecondary, inputClass } from './admin/adminUi';
import { DepartmentBillsPanel, DepartmentServicesPanel } from '../components/DepartmentControls';
import DepartmentShiftPanel from '../components/DepartmentShiftPanel';

function Shell({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{hint}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function AppointmentsPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const [form, setForm] = useState({
    patientId: state.patients[0]?.id ?? '',
    providerId: 'staff-doctor',
    clinic: 'GENERAL' as ClinicId,
    startsAt: new Date(Date.now() + 3600_000).toISOString().slice(0, 16),
    reason: 'Review',
    resource: 'OPD 1',
    recurring: '' as '' | 'weekly' | 'monthly',
  });

  return (
    <Shell title="Appointments" hint="Bookings, waitlists, no-shows, and reminders.">
      <Card title="Book">
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            updateCare((s) =>
              bookAppointment(s, {
                patientId: form.patientId,
                providerId: form.providerId,
                clinic: form.clinic,
                startsAt: new Date(form.startsAt).toISOString(),
                durationMin: 20,
                reason: form.reason,
                resource: form.resource,
                recurring: form.recurring || undefined,
                createdBy: user?.id ?? 'staff-reception',
              }),
            );
          }}
        >
          <select className={inputClass} value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
            {state.patients.filter((p) => !p.mergedIntoId).map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
          <select className={inputClass} value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
            {state.staff.filter((s) => s.isActive).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.role})
              </option>
            ))}
          </select>
          <select className={inputClass} value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value as ClinicId })}>
            {Object.entries(CLINIC_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <input className={inputClass} type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          <input className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason" />
          <input className={inputClass} value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} placeholder="Room / equipment" />
          <button className={btnPrimary} type="submit">
            Book
          </button>
        </form>
      </Card>
      <Card title="Diary">
        <button type="button" className={`${btnSecondary} mb-3`} onClick={() => {
          updateCare(sendDueReminders);
        }}>
          Send due reminders
        </button>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1">When</th>
              <th>Patient</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.appointments.map((a) => {
              const p = state.patients.find((x) => x.id === a.patientId);
              return (
                <tr key={a.id} className="border-t">
                  <td className="py-1">{new Date(a.startsAt).toLocaleString()}</td>
                  <td>{p ? `${p.firstName} ${p.lastName}` : a.patientId}</td>
                  <td>{a.status}</td>
                  <td className="space-x-1">
                    {(['CONFIRMED', 'NO_SHOW', 'CANCELLED', 'CHECKED_IN'] as AppointmentStatus[]).map((status) => (
                      <button key={status} type="button" className="text-xs text-clinic-700" onClick={() => updateCare((s) => setAppointmentStatus(s, a.id, status))}>
                        {status}
                      </button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title="Waitlist">
        <ul className="text-sm">
          {state.waitlist.map((w) => {
            const p = state.patients.find((x) => x.id === w.patientId);
            return (
              <li key={w.id}>
                {p?.firstName} {p?.lastName} → {CLINIC_LABELS[w.clinic]} ({w.reason})
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={`${btnSecondary} mt-2`}
          onClick={() => updateCare((s) => addWaitlist(s, form.patientId, form.clinic, form.reason))}
        >
          Add current patient to waitlist
        </button>
      </Card>
    </Shell>
  );
}

export function WardPage() {
  const { user } = useAuth();
  const { state, updateCare, removeFromBill, toggleService, updatePrice } = useCare();
  const staffId = user?.id ?? 'staff-nurse';
  const occ = occupancy(state);
  const isHead = canControlDepartment(user, 'WARD');
  const [prompt, setPrompt] = useState<{ kind: PromptKind; name: string; detail: string } | null>(null);
  return (
    <Shell title="Ward / ADT" hint="Beds, admit-transfer-discharge, MAR, and intake/output.">
      {prompt && (
        <RecordSavedModal kind={prompt.kind} patientName={prompt.name} detail={prompt.detail} onClose={() => setPrompt(null)} />
      )}
      <DepartmentShiftPanel department="WARD" />
      {isHead && (
        <DepartmentBillsPanel department="WARD" visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {occ.map((row) => (
          <div key={row.ward} className="rounded-xl border bg-white p-4">
            <p className="text-xs uppercase text-slate-500">{row.ward}</p>
            <p className="text-2xl font-semibold">
              {row.used}/{row.total}
            </p>
          </div>
        ))}
      </div>
      <Card title="Beds">
        <ul className="grid gap-2 sm:grid-cols-2">
          {state.beds.map((bed) => {
            const visit = state.visits.find((v) => v.id === bed.visitId);
            const patient = state.patients.find((p) => p.id === bed.patientId);
            return (
              <li key={bed.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {bed.label} · {bed.status}
                </p>
                {patient && <PatientIdentity patient={patient} />}
                {visit && patient && bed.status === 'OCCUPIED' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => {
                        updateCare((s) => dischargeVisit(s, visit.id, staffId));
                        setPrompt({
                          kind: 'work_done',
                          name: `${patient.firstName} ${patient.lastName}`,
                          detail: 'Patient is discharged from the ward.',
                        });
                      }}
                    >
                      Discharge
                    </button>
                    <select
                      className={inputClass}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          updateCare((s) => transferBed(s, visit.id, e.target.value, staffId));
                          setPrompt({
                            kind: 'sent_ward',
                            name: `${patient.firstName} ${patient.lastName}`,
                            detail: 'Patient is moved to a new bed. Take them there now.',
                          });
                        }
                      }}
                    >
                      <option value="">Transfer…</option>
                      {state.beds.filter((b) => b.status === 'FREE' && b.ward === 'WARD').map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {isHead && visit && (
                  <VisitChargeSummary
                    visit={visit}
                    managedDepartment="WARD"
                    onRemoveCharge={(orderId) => removeFromBill(visit.id, orderId)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title="Admit from open visits">
        <ul className="space-y-2 text-sm">
          {state.visits
            .filter((v) => v.stage !== 'COMPLETED' && !v.bedId)
            .map((v) => {
              const p = state.patients.find((x) => x.id === v.patientId);
              return (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span>
                    <PatientIdentity patient={p} /> · {v.reason}
                  </span>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      updateCare((s) => admitVisit(s, v.id, staffId, 'WARD'));
                      setPrompt({
                        kind: 'sent_ward',
                        name: p ? `${p.firstName} ${p.lastName}` : 'Patient',
                        detail: 'Patient is admitted. Take them to the ward bed.',
                      });
                    }}
                  >
                    Admit
                  </button>
                </li>
              );
            })}
        </ul>
      </Card>
      <Card title="MAR">
        <ul className="text-sm">
          {state.marEntries.map((m) => {
            const p = state.patients.find((x) => x.id === m.patientId);
            const med = state.medications.find((x) => x.id === m.medicationId);
            return (
              <li key={m.id} className="flex items-center justify-between border-t py-2">
                <span>
                  {p?.firstName} — {med?.name ?? 'Medication'} ({m.status})
                </span>
                {m.status === 'DUE' && (
                  <span className="space-x-2">
                    <button type="button" className="text-clinic-700" onClick={() => updateCare((s) => markMar(s, m.id, 'GIVEN', staffId))}>
                      Given
                    </button>
                    <button type="button" onClick={() => updateCare((s) => markMar(s, m.id, 'HELD', staffId))}>
                      Held
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title="I/O">
        <IoForm />
        <ul className="mt-3 text-sm">
          {state.ioEntries.slice(0, 12).map((row) => (
            <li key={row.id}>
              {row.kind} {row.amountMl} ml — {row.note}
            </li>
          ))}
        </ul>
      </Card>
      {isHead && (
        <DepartmentServicesPanel department="WARD" services={state.services} onToggle={toggleService} onPrice={updatePrice} />
      )}
    </Shell>
  );
}

function IoForm() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const admitted = state.visits.find((v) => v.bedId);
  const [amount, setAmount] = useState('200');
  const [kind, setKind] = useState<'IN' | 'OUT'>('IN');
  if (!admitted) return <p className="text-sm text-slate-500">Admit a patient first.</p>;
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        updateCare((s) =>
          addIo(s, {
            visitId: admitted.id,
            patientId: admitted.patientId,
            kind,
            amountMl: Number(amount) || 0,
            note: kind === 'IN' ? 'Oral / IV' : 'Urine',
            staffId: user?.id ?? 'staff-nurse',
          }),
        );
      }}
    >
      <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as 'IN' | 'OUT')}>
        <option value="IN">In</option>
        <option value="OUT">Out</option>
      </select>
      <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button className={btnPrimary} type="submit">
        Record
      </button>
    </form>
  );
}

export function TheatrePage() {
  const { user } = useAuth();
  const { state, updateCare, removeFromBill, toggleService, updatePrice } = useCare();
  const isHead = canControlDepartment(user, 'THEATRE');
  const [prompt, setPrompt] = useState<{ kind: PromptKind; name: string; detail: string } | null>(null);
  return (
    <Shell title="Theatre / OT" hint="OT board, pre-op checklist, surgical notes, anaesthesia.">
      {prompt && (
        <RecordSavedModal kind={prompt.kind} patientName={prompt.name} detail={prompt.detail} onClose={() => setPrompt(null)} />
      )}
      <DepartmentShiftPanel department="THEATRE" />
      {isHead && (
        <DepartmentBillsPanel department="THEATRE" visits={state.visits} patients={state.patients} onRemove={removeFromBill} />
      )}
      {state.otCases.length === 0 && <p className="text-sm text-slate-500">No OT cases. Order a theatre service on a consult to schedule.</p>}
      {state.otCases.map((c) => {
        const p = state.patients.find((x) => x.id === c.patientId);
        return (
          <Card key={c.id} title={`${c.procedure} · ${c.status}`}>
            <PatientIdentity patient={p} />
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={c.preopDone} onChange={(e) => updateCare((s) => updateOt(s, c.id, { preopDone: e.target.checked }))} />
              Pre-op checklist complete
            </label>
            <textarea className={`${inputClass} mt-2`} value={c.surgicalNotes} placeholder="Surgical notes" onChange={(e) => updateCare((s) => updateOt(s, c.id, { surgicalNotes: e.target.value }))} />
            <input className={`${inputClass} mt-2`} value={c.anesthesia} placeholder="Anaesthesia" onChange={(e) => updateCare((s) => updateOt(s, c.id, { anesthesia: e.target.value }))} />
            <div className="mt-2 space-x-2">
              {(['IN_THEATRE', 'RECOVERY', 'DONE'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    updateCare((s) => updateOt(s, c.id, { status }));
                    const name = p ? `${p.firstName} ${p.lastName}` : 'Patient';
                    if (status === 'IN_THEATRE') {
                      setPrompt({ kind: 'sent_theatre', name, detail: 'Take the patient into theatre now.' });
                    } else if (status === 'RECOVERY') {
                      setPrompt({ kind: 'work_done', name, detail: 'Surgery is finished. Take them to recovery.' });
                    } else {
                      setPrompt({ kind: 'sent_ward', name, detail: 'Theatre is done. Take them back to the ward.' });
                    }
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
            {isHead && (() => {
              const visit = state.visits.find((v) => v.id === c.visitId);
              return visit ? (
                <VisitChargeSummary
                  visit={visit}
                  managedDepartment="THEATRE"
                  onRemoveCharge={(orderId) => removeFromBill(visit.id, orderId)}
                />
              ) : null;
            })()}
          </Card>
        );
      })}
      {isHead && (
        <DepartmentServicesPanel department="THEATRE" services={state.services} onToggle={toggleService} onPrice={updatePrice} />
      )}
    </Shell>
  );
}

export function TriagePage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const staffId = user?.id ?? 'staff-nurse';
  const [esi, setEsi] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [prompt, setPrompt] = useState<{ kind: PromptKind; name: string; detail: string } | null>(null);
  return (
    <Shell title="Emergency / triage" hint="ESI 1–5. ESI 1–2 auto-assigns an ED bed. Fast-track uses the Emergency clinic.">
      {prompt && (
        <RecordSavedModal kind={prompt.kind} patientName={prompt.name} detail={prompt.detail} onClose={() => setPrompt(null)} />
      )}
      <Card title="Open visits">
        <ul className="space-y-3">
          {state.visits
            .filter((v) => v.stage !== 'COMPLETED')
            .map((v) => {
              const p = state.patients.find((x) => x.id === v.patientId);
              return (
                <li key={v.id} className="rounded-lg border p-3 text-sm">
                  <PatientIdentity patient={p} />
                  <p className="text-slate-500">
                    {v.reason} {v.esiScore ? `· ESI ${v.esiScore}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select className={inputClass} value={esi} onChange={(e) => setEsi(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          ESI {n}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => {
                        updateCare((s) => recordTriage(s, { visitId: v.id, esi, complaint: v.reason, staffId }));
                        const name = p ? `${p.firstName} ${p.lastName}` : 'Patient';
                        setPrompt(
                          esi <= 2
                            ? { kind: 'sent_ward', name, detail: 'Emergency. Take them to an ED bed now.' }
                            : { kind: 'sent_doctor', name, detail: 'Triage saved. Send them to the doctor.' },
                        );
                      }}
                    >
                      Score
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
      </Card>
    </Shell>
  );
}

export { default as ClaimsPage } from './ClaimsDeskPage';

export function InventoryPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  return (
    <Shell title="Inventory & assets" hint="Pharmacy stock stays here. Consumables are on Stores. Orders are on Procurement.">
      <p className="text-sm">
        <Link className="text-clinic-700 hover:underline" to="/care/stores">
          Open stores
        </Link>
        {' · '}
        <Link className="text-clinic-700 hover:underline" to="/care/procurement">
          Open procurement
        </Link>
      </p>
      <Card title="Drug stock">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              <th>Item</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(state.drugStock ?? []).map((d) => {
              const empty = isOutOfStock(d);
              const low = isLowStock(d);
              return (
              <tr key={d.id} className={`border-t ${empty ? 'bg-red-50' : low ? 'bg-amber-50' : ''}`}>
                <td className="py-1">
                  {d.name} {d.controlled ? '(controlled)' : ''}
                </td>
                <td>{d.quantity}</td>
                <td>
                  {empty ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Out of stock</span>
                  ) : low ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Low stock</span>
                  ) : (
                    <span className="text-xs text-slate-500">In stock</span>
                  )}
                </td>
                <td>{d.expiresOn}</td>
                <td>
                  <button
                    type="button"
                    disabled={empty}
                    className="text-clinic-700 disabled:cursor-not-allowed disabled:text-slate-400"
                    onClick={() =>
                      updateCare((s) =>
                        dispenseStock(s, {
                          serviceId: d.serviceId,
                          quantity: 1,
                          visitId: s.visits[0]?.id ?? '',
                          staffId: user?.id ?? 'staff-pharmacy',
                          witness: 'staff-nurse',
                        }),
                      )
                    }
                  >
                    Dispense 1
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title="Supplies / vendors / assets">
        <p className="text-sm font-medium">Supplies</p>
        <ul className="text-sm">
          {state.supplies.map((s) => (
            <li key={s.id}>
              {s.name}: {s.quantity} (reorder {s.reorderAt})
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-medium">Vendors</p>
        <ul className="text-sm">
          {state.vendors.map((v) => (
            <li key={v.id}>
              {v.name} · {v.phone}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-medium">Assets</p>
        <ul className="text-sm">
          {state.assets.map((a) => (
            <li key={a.id}>
              {a.name} @ {a.location}
              {a.kind ? ` · ${a.kind}` : ''}
              {a.nextMaintenance ? ` · next PM ${a.nextMaintenance}` : ''}
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}

export function HrPage() {
  const { state, updateCare } = useCare();
  return (
    <Shell title="HR & roster" hint="Licences, shifts, quarterly access recertification stamp.">
      <Card title="Staff credentials">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              <th>Name</th>
              <th>Licence</th>
              <th>Expires</th>
              <th>Last access review</th>
            </tr>
          </thead>
          <tbody>
            {state.staff.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-1">
                  {s.firstName} {s.lastName}
                </td>
                <td>{s.licenseNo ?? '—'}</td>
                <td>{s.licenseExpires ?? '—'}</td>
                <td>{s.lastAccessReviewAt ? new Date(s.lastAccessReviewAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className={`${btnPrimary} mt-3`}
          onClick={() =>
            updateCare((st) => ({
              ...st,
              staff: st.staff.map((s) => ({ ...s, lastAccessReviewAt: new Date().toISOString() })),
            }))
          }
        >
          Stamp quarterly access recertification
        </button>
      </Card>
      <Card title="Today’s shifts">
        <ul className="text-sm">
          {(state.shifts ?? []).filter((sh) => sh.day === new Date().toISOString().slice(0, 10)).map((sh) => {
            const s = state.staff.find((x) => x.id === sh.staffId);
            return (
              <li key={sh.id}>
                {s?.firstName} {s?.lastName} · {sh.startHour}:00–{sh.endHour}:00
                {sh.emailSent || sh.smsSent ? ' · notified' : ''}
              </li>
            );
          })}
        </ul>
        <Link to="/care/shifts" className="mt-3 inline-block text-sm text-clinic-700 hover:underline">
          Open department shift schedule
        </Link>
      </Card>
    </Shell>
  );
}

export function MessagesPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const [body, setBody] = useState('');
  const [toRole, setToRole] = useState<StaffRole>('NURSE');
  const mine = state.messages.filter((m) => m.toId === user?.id || m.toRole === user?.role || m.fromId === user?.id);
  return (
    <Shell title="Secure staff messages" hint="Role-addressed staff messages.">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim() || !user) return;
          updateCare((s) => sendMessage(s, { fromId: user.id, body, toRole }));
          setBody('');
        }}
      >
        <select className={inputClass} value={toRole} onChange={(e) => setToRole(e.target.value as StaffRole)}>
          {state.staff
            .map((s) => s.role)
            .filter((role, i, all) => all.indexOf(role) === i)
            .map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
        </select>
        <input className={`${inputClass} min-w-[16rem] flex-1`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" />
        <button className={btnPrimary} type="submit">
          Send
        </button>
      </form>
      <ul className="space-y-2">
        {mine.map((m) => (
          <li key={m.id} className="rounded-xl border bg-white p-3 text-sm">
            <p className="text-xs text-slate-500">
              {m.fromId} → {m.toRole ?? m.toId} · {new Date(m.at).toLocaleString()}
            </p>
            <p>{m.body}</p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

export function AuditPage() {
  const { state } = useCare();
  return (
    <Shell title="Audit & break-glass" hint="Append-only hashed audit trail.">
      <Card title="Break-glass">
        <ul className="text-sm">
          {state.breakGlass.map((g) => (
            <li key={g.id}>
              {g.staffId} opened {g.patientId}: {g.reason}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Log">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th>When</th>
              <th>Action</th>
              <th>Patient</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {state.auditLog.slice(0, 80).map((e) => (
              <tr key={e.id} className="border-t">
                <td className="py-1">{new Date(e.at).toLocaleString()}</td>
                <td>{e.action}</td>
                <td>{e.patientId}</td>
                <td className="font-mono">{e.hash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}

export function ReportsPage() {
  const { state } = useCare();
  const q = qualityMetrics(state);
  const csv = useMemo(() => {
    const lines = [['metric', 'value'], ['visits', q.visits], ['completed', q.completed], ['readmit72h', q.readmit72h], ['noShows', q.noShows], ['criticalLabs', q.criticalLabs]];
    return lines.map((row) => row.join(',')).join('\n');
  }, [q]);
  return (
    <Shell title="Reports" hint="Occupancy, 72-hour returns, no-shows, and critical labs.">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Visits" value={q.visits} />
        <Stat label="Completed" value={q.completed} />
        <Stat label="72h returns" value={q.readmit72h} />
        <Stat label="No-shows" value={q.noShows} />
      </div>
      <Card title="Occupancy">
        {q.occupancy.map((row) => (
          <p key={row.ward} className="text-sm">
            {row.ward}: {row.used}/{row.total}
          </p>
        ))}
      </Card>
      <button type="button" className={btnPrimary} onClick={() => downloadText('cms-quality.csv', csv, 'text/csv')}>
        Export CSV
      </button>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function MergePage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const pairs = state.patients.flatMap((p) =>
    findDuplicatePatients(state.patients, p)
      .filter((d) => d.id > p.id)
      .map((d) => ({ a: p, b: d })),
  );
  return (
    <div>
      {pairs.length === 0 && (
        <div className="rounded-xl border border-dashed bg-white px-4 py-8 text-center">
          <p className="font-medium text-slate-700">No duplicate folders</p>
          <p className="mt-1 text-sm text-slate-500">Same name, date of birth, or phone will appear here to merge.</p>
        </div>
      )}
      <ul className="mt-4 space-y-3">
        {pairs.map(({ a, b }) => (
          <li key={`${a.id}-${b.id}`} className="rounded-xl border bg-white p-4 text-sm">
            <p>
              {a.firstName} {a.lastName} ({a.hospitalNo}) vs {b.firstName} {b.lastName} ({b.hospitalNo})
            </p>
            <button
              type="button"
              className={`${btnPrimary} mt-2`}
              onClick={() => updateCare((s) => mergePatients(s, a.id, b.id, user?.id ?? 'staff-reception'))}
            >
              Merge into {a.hospitalNo}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NotificationsBanner() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const items = (state.notifications ?? [])
    .filter((n) => !n.read && (n.staffId === user?.id || (n.audience === 'staff' && !n.staffId)))
    .sort((a, b) => Number(b.kind === 'stock') - Number(a.kind === 'stock'))
    .slice(0, 3);
  if (items.length === 0) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      {items.map((n) => (
        <p key={n.id}>
          {n.title}: {n.body}
        </p>
      ))}
      <button
        type="button"
        className="mt-1 text-xs underline"
        onClick={() => updateCare((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }))}
      >
        Dismiss
      </button>
    </div>
  );
}
