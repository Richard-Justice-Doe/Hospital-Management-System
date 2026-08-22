import { useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import PatientIdentity from '../components/PatientIdentity';
import {
  addAllergy,
  addClinicalNote,
  addFamilyLink,
  addImmunization,
  addProblem,
  canReadNote,
  downloadText,
  evaluateCds,
  exportFhirPatient,
  grantBreakGlass,
  recordChartAccess,
} from '../workflow/his';
import { searchPatients } from '../workflow/store';
import VisitChargeSummary from '../components/VisitChargeSummary';
import type { NoteSensitivity } from '../workflow/types';
import { btnPrimary, btnSecondary, inputClass } from './admin/adminUi';

export default function ChartPage() {
  const { user } = useAuth();
  const { state, updateCare, removeFromBill } = useCare();
  const [query, setQuery] = useState('');
  const [patientId, setPatientId] = useState(state.patients[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [sensitivity, setSensitivity] = useState<NoteSensitivity>('GENERAL');
  const [allergy, setAllergy] = useState({ substance: '', reaction: '', severity: 'moderate' as const });
  const staffId = user?.id ?? 'staff-admin';
  const role = user?.role ?? 'ADMIN';

  const matches = searchPatients(
    state.patients.filter((p) => !p.mergedIntoId),
    query,
  );
  const patient = state.patients.find((p) => p.id === patientId);
  const alerts = patient ? evaluateCds(state, patient.id, '', []) : [];
  const notes = state.clinicalNotes.filter((n) => n.patientId === patientId);
  const restricted = notes.find((n) => n.sensitivity !== 'GENERAL');

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">Patient chart</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-white p-4">
          <input
            className={inputClass}
            placeholder="Search name, phone, or folder number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="mt-3 max-h-[28rem] space-y-1 overflow-auto">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${p.id === patientId ? 'bg-clinic-50' : 'hover:bg-slate-50'}`}
                  onClick={() => {
                    setPatientId(p.id);
                    updateCare((s) => recordChartAccess(s, staffId, p.id));
                  }}
                >
                  <PatientIdentity patient={p} />
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {p.age}y · {p.insuranceType ?? 'CASH'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 lg:col-span-2">
          {!patient ? (
            <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">Select a patient.</p>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-5">
                <h2 className="text-lg font-medium">
                  <PatientIdentity patient={patient} />
                </h2>
                <p className="text-sm text-slate-600">
                  {patient.age}y {patient.gender} · {patient.phone} · {patient.town}
                </p>
                <p className="text-sm text-slate-600">
                  Cover: {patient.insuranceType ?? 'CASH'} {patient.insuranceNumber ?? ''}
                </p>
                <button
                  type="button"
                  className={`${btnSecondary} mt-3`}
                  onClick={() =>
                    downloadText(
                      `${patient.hospitalNo}-fhir.json`,
                      JSON.stringify(exportFhirPatient(state, patient.id), null, 2),
                      'application/fhir+json',
                    )
                  }
                >
                  Export FHIR R4 JSON
                </button>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="rounded-xl border border-red-100 bg-white p-5">
                  <h2 className="font-medium text-slate-900">Remove bill</h2>
                  {state.visits.filter((v) => v.patientId === patient.id).length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No visits on this folder.</p>
                  ) : (
                    state.visits
                      .filter((v) => v.patientId === patient.id)
                      .map((visit) => (
                        <VisitChargeSummary
                          key={visit.id}
                          visit={visit}
                          managedDepartment={undefined}
                          onRemoveCharge={(orderId) => removeFromBill(visit.id, orderId)}
                        />
                      ))
                  )}
                </div>
              )}

              {alerts.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {alerts.map((a) => (
                    <p key={a.title}>
                      {a.title}: {a.detail}
                    </p>
                  ))}
                </div>
              )}

              <ChartBlock title="Allergies">
                <ul className="text-sm">
                  {state.allergies
                    .filter((a) => a.patientId === patientId)
                    .map((a) => (
                      <li key={a.id}>
                        {a.substance} — {a.reaction} ({a.severity})
                      </li>
                    ))}
                </ul>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input
                    className={inputClass}
                    placeholder="Substance"
                    value={allergy.substance}
                    onChange={(e) => setAllergy({ ...allergy, substance: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Reaction"
                    value={allergy.reaction}
                    onChange={(e) => setAllergy({ ...allergy, reaction: e.target.value })}
                  />
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      if (!allergy.substance) return;
                      updateCare((s) =>
                        addAllergy(s, {
                          patientId,
                          substance: allergy.substance,
                          reaction: allergy.reaction || 'Unknown',
                          severity: allergy.severity,
                          recordedBy: staffId,
                        }),
                      );
                      setAllergy({ substance: '', reaction: '', severity: 'moderate' });
                    }}
                  >
                    Add allergy
                  </button>
                </div>
              </ChartBlock>

              <ChartBlock title="Problem list">
                <ul className="text-sm">
                  {state.problems
                    .filter((p) => p.patientId === patientId)
                    .map((p) => (
                      <li key={p.id}>
                        {p.name} {p.icdHint ? `(${p.icdHint})` : ''} — {p.status}
                      </li>
                    ))}
                </ul>
                <AddLine
                  placeholder="New problem"
                  onAdd={(name) => updateCare((s) => addProblem(s, { patientId, name, recordedBy: staffId }))}
                />
              </ChartBlock>

              <ChartBlock title="Medications">
                <ul className="text-sm">
                  {state.medications
                    .filter((m) => m.patientId === patientId)
                    .map((m) => (
                      <li key={m.id}>
                        {m.name} — {m.sig} ({m.status})
                      </li>
                    ))}
                </ul>
              </ChartBlock>

              <ChartBlock title="Immunizations">
                <ul className="text-sm">
                  {state.immunizations
                    .filter((i) => i.patientId === patientId)
                    .map((i) => (
                      <li key={i.id}>
                        {i.vaccine} {i.dose} · {new Date(i.givenAt).toLocaleDateString()}
                      </li>
                    ))}
                </ul>
                <AddLine
                  placeholder="Vaccine name"
                  onAdd={(vaccine) =>
                    updateCare((s) =>
                      addImmunization(s, {
                        patientId,
                        vaccine,
                        dose: '1',
                        givenAt: new Date().toISOString(),
                        recordedBy: staffId,
                      }),
                    )
                  }
                />
              </ChartBlock>

              <ChartBlock title="Family links">
                <ul className="text-sm">
                  {state.familyLinks
                    .filter((f) => f.patientId === patientId)
                    .map((f) => {
                      const rel = state.patients.find((p) => p.id === f.relatedPatientId);
                      return (
                        <li key={f.id}>
                          {f.relationship} of {rel ? `${rel.firstName} ${rel.lastName}` : f.relatedPatientId}
                        </li>
                      );
                    })}
                </ul>
                <select
                  className={`${inputClass} mt-2`}
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    updateCare((s) =>
                      addFamilyLink(s, { patientId, relatedPatientId: e.target.value, relationship: 'Sibling' }),
                    );
                    e.target.value = '';
                  }}
                >
                  <option value="">Link another folder…</option>
                  {state.patients
                    .filter((p) => p.id !== patientId && !p.mergedIntoId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} ({p.hospitalNo})
                      </option>
                    ))}
                </select>
              </ChartBlock>

              <ChartBlock title="Clinical notes">
                {restricted && !canReadNote(state, restricted, staffId, role) && (
                  <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm">
                    <p>Protected psych/substance notes are hidden. Break-glass with a reason (logged).</p>
                    <textarea
                      className={`${inputClass} mt-2`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Justification"
                    />
                    <button
                      type="button"
                      className={`${btnPrimary} mt-2`}
                      onClick={() => {
                        if (!reason.trim()) return;
                        updateCare((s) => grantBreakGlass(s, { patientId, staffId, reason }));
                        setReason('');
                      }}
                    >
                      Break-glass
                    </button>
                  </div>
                )}
                <ul className="space-y-2 text-sm">
                  {notes.map((n) => {
                    const allowed = canReadNote(state, n, staffId, role);
                    return (
                      <li key={n.id} className="rounded-lg border border-slate-100 p-2">
                        <p className="text-xs uppercase text-slate-500">
                          {n.sensitivity} · {n.title}
                        </p>
                        <p>{allowed ? n.body : 'Restricted — use break-glass.'}</p>
                      </li>
                    );
                  })}
                </ul>
                <textarea
                  className={`${inputClass} mt-2`}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="New note"
                />
                <div className="mt-2 flex gap-2">
                  <select
                    className={inputClass}
                    value={sensitivity}
                    onChange={(e) => setSensitivity(e.target.value as NoteSensitivity)}
                  >
                    <option value="GENERAL">General</option>
                    <option value="PSYCH">Psych</option>
                    <option value="SUBSTANCE">Substance (42 CFR Part 2 extra protection)</option>
                  </select>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      if (!noteBody.trim()) return;
                      updateCare((s) =>
                        addClinicalNote(s, {
                          patientId,
                          sensitivity,
                          title: 'Chart note',
                          body: noteBody,
                          createdBy: staffId,
                        }),
                      );
                      setNoteBody('');
                    }}
                  >
                    Save note
                  </button>
                </div>
              </ChartBlock>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ChartBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-5">
      <h3 className="font-medium text-slate-900">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function AddLine({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue('');
      }}
    >
      <input className={inputClass} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="submit" className={btnPrimary}>
        Add
      </button>
    </form>
  );
}
