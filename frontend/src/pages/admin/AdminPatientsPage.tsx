import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCare } from '../../context/CareContext';
import type { Gender, PatientRecord } from '../../workflow/types';
import { INSURANCE_OPTIONS, insuranceLabel } from '../../workflow/patientAdmin';
import { btnDanger, btnPrimary, btnSecondary, EmptyState, Field, inputClass, SearchBox } from './adminUi';

export default function AdminPatientsPage() {
  const { state, savePatient, removePatient, resetPortalPin } = useCare();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [draft, setDraft] = useState<PatientRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.patients.filter((patient) => {
      if (!needle) return true;
      const hay = `${patient.firstName} ${patient.lastName} ${patient.hospitalNo} ${patient.phone} ${patient.town ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [state.patients, query]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.9fr)]">
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-medium text-slate-900">Patient records</h2>
        <div className="mt-4">
          <SearchBox value={query} onChange={setQuery} placeholder="Search folder number, name, or phone" />
        </div>
        {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No matching patients" hint="Try a shorter search, or register the person at Reception." />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Folder</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Age</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Insurance</th>
                  <th className="px-3 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((patient) => (
                  <tr key={patient.id} className={`border-t ${draft?.id === patient.id ? 'bg-clinic-50' : ''}`}>
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-clinic-700">{patient.hospitalNo}</td>
                    <td className="px-3 py-2 font-medium">
                      {patient.firstName} {patient.lastName}
                    </td>
                    <td className="px-3 py-2">{patient.age}y</td>
                    <td className="px-3 py-2">{patient.phone || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{insuranceLabel(patient)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => setDraft(patient)} className={btnSecondary}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => {
                            void resetPortalPin(patient.id).then((pin) =>
                              setMessage(`New portal PIN for ${patient.firstName} ${patient.lastName}: ${pin}`),
                            );
                          }}
                        >
                          New PIN
                        </button>
                        {pendingDelete === patient.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                removePatient(patient.id);
                                setPendingDelete(null);
                                if (draft?.id === patient.id) setDraft(null);
                                setMessage(`Deleted ${patient.firstName} ${patient.lastName}.`);
                              }}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
                            >
                              Confirm
                            </button>
                            <button type="button" onClick={() => setPendingDelete(null)} className={btnSecondary}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setPendingDelete(patient.id)} className={btnDanger}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {draft && (
        <section className="h-fit rounded-xl border bg-white p-5">
          <h2 className="font-medium text-slate-900">Edit record</h2>
          <p className="mt-1 font-mono text-sm font-semibold text-clinic-700">{draft.hospitalNo}</p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              savePatient(draft);
              setMessage(`Saved ${draft.firstName} ${draft.lastName}.`);
              setDraft(null);
            }}
          >
            <Field label="First name">
              <input className={inputClass} value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
            </Field>
            <Field label="Last name">
              <input className={inputClass} value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
            </Field>
            <Field label="Age">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.age}
                onChange={(e) => setDraft({ ...draft, age: Number(e.target.value) })}
              />
            </Field>
            <Field label="Gender">
              <select
                className={inputClass}
                value={draft.gender}
                onChange={(e) => setDraft({ ...draft, gender: e.target.value as Gender })}
              >
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </Field>
            <Field label="Town">
              <input className={inputClass} value={draft.town ?? ''} onChange={(e) => setDraft({ ...draft, town: e.target.value })} />
            </Field>
            <Field label="Address">
              <input className={inputClass} value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
            </Field>
            <Field label="Insurance">
              <select
                className={inputClass}
                value={draft.insuranceType ?? 'CASH'}
                onChange={(e) => setDraft({ ...draft, insuranceType: e.target.value as PatientRecord['insuranceType'] })}
              >
                {INSURANCE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2 pt-1">
              <button type="submit" className={btnPrimary}>
                Save record
              </button>
              <button type="button" className={btnSecondary} onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
